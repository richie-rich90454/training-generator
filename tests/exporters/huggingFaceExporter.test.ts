// @vitest-environment node
import{describe, test, expect, vi, beforeEach}from "vitest";
const parquetState=vi.hoisted(()=>({
    installed: true,
    ParquetSchema: vi.fn(),
    ParquetWriter: vi.fn(function(this: any, _schema: any, writable: any){
        this.appendRow=vi.fn(async ()=>{});
        this.close=vi.fn(async ()=>{
            writable.write(Buffer.from("parquet"));
            writable.end();
        });
    })
}));
vi.mock("axios", ()=>{
    return{
        default:{
            post: vi.fn()
        }
    };
});
vi.mock("parquetjs-lite", ()=>{
    return{
        parquet: {
            get ParquetSchema(){
                return parquetState.installed?parquetState.ParquetSchema:undefined;
            },
            get ParquetWriter(){
                return parquetState.installed?parquetState.ParquetWriter:undefined;
            }
        }
    };
});
import axios from "axios";
import{
    HuggingFaceExporter,
    computeDatasetStats,
    generateDatasetCard,
    writeParquet,
    pushToHub
}from "../../src/renderer/exporters/huggingFaceExporter.js";
import type { TrainingItem } from "../../src/types/index.js";
import { Exporter } from "../../src/renderer/exportFormats.js";
beforeEach(()=>{
    vi.clearAllMocks();
    parquetState.installed=true;
});
function createItems(): TrainingItem[]{
    return [
        { format: "instruction", instruction: "What is 2+2?", input: "", output: "4", metadata: { topic: "math" } },
        { format: "chatml", messages: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello" }] },
        { format: "text", text: "Sample text" }
    ];
}
describe("HuggingFaceExporter", ()=>{
    test("implements Exporter interface", ()=>{
        let exporter: Exporter=new HuggingFaceExporter();
        expect(exporter.name).toBe("huggingface");
        expect(exporter.mimeType).toBe("application/json");
        expect(exporter.extension).toBe(".json");
        expect(typeof exporter.export).toBe("function");
    });
    test("export returns JSON string containing jsonl and readme", ()=>{
        let exporter=new HuggingFaceExporter();
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", output: "b" }];
        let result=exporter.export(items);
        let parsed=JSON.parse(result);
        expect(typeof parsed.jsonl).toBe("string");
        expect(typeof parsed.readme).toBe("string");
    });
    test("export jsonl contains items", ()=>{
        let exporter=new HuggingFaceExporter();
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", output: "b" }];
        let result=exporter.export(items);
        let parsed=JSON.parse(result);
        expect(parsed.jsonl).toContain('"instruction":"a"');
    });
    test("export readme contains dataset title", ()=>{
        let exporter=new HuggingFaceExporter();
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", output: "b" }];
        let result=exporter.export(items, { name: "My Dataset" });
        let parsed=JSON.parse(result);
        expect(parsed.readme).toContain("# My Dataset");
    });
});
describe("generateDatasetCard", ()=>{
    test("includes YAML frontmatter", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", output: "b" }];
        let card=generateDatasetCard(items);
        expect(card.startsWith("---")).toBe(true);
        expect(card).toContain("task_categories:");
        expect(card).toContain("license: mit");
    });
    test("includes splits when provided", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", output: "b" }];
        let card=generateDatasetCard(items, { splits: ["train", "test"] });
        expect(card).toContain("splits:");
        expect(card).toContain("  - train");
        expect(card).toContain("  - test");
    });
    test("uses provided options", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "a", output: "b" }];
        let card=generateDatasetCard(items, { name: "Custom", description: "Desc", license: "apache-2.0", language: ["en", "zh"] });
        expect(card).toContain("# Custom");
        expect(card).toContain("Desc");
        expect(card).toContain("license: apache-2.0");
        expect(card).toContain("  - en");
        expect(card).toContain("  - zh");
    });
    test("includes statistics", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "abc", output: "def", metadata: { topic: "x" } }];
        let card=generateDatasetCard(items);
        expect(card).toContain("Items: 1");
        expect(card).toContain("Average instruction length:");
        expect(card).toContain("Average output length:");
    });
});
describe("computeDatasetStats", ()=>{
    test("counts formats", ()=>{
        let items=createItems();
        let stats=computeDatasetStats(items);
        expect(stats.count).toBe(3);
        expect((stats.formatCounts as Record<string, number>)["instruction"]).toBe(1);
        expect((stats.formatCounts as Record<string, number>)["chatml"]).toBe(1);
        expect((stats.formatCounts as Record<string, number>)["text"]).toBe(1);
    });
    test("computes averages", ()=>{
        let items: TrainingItem[]=[
            { format: "instruction", instruction: "short", output: "out" },
            { format: "instruction", instruction: "longer instruction", output: "longer output" }
        ];
        let stats=computeDatasetStats(items);
        expect(stats.avgInstructionLength).toBeGreaterThan(0);
        expect(stats.avgOutputLength).toBeGreaterThan(0);
    });
    test("counts metadata", ()=>{
        let items: TrainingItem[]=[
            { format: "instruction", instruction: "a", output: "b", metadata: { topic: "x" } },
            { format: "instruction", instruction: "c", output: "d" }
        ];
        let stats=computeDatasetStats(items);
        expect(stats.hasMetadataCount).toBe(1);
    });
    test("handles empty array", ()=>{
        let stats=computeDatasetStats([]);
        expect(stats.count).toBe(0);
        expect(stats.avgInstructionLength).toBe(0);
        expect(stats.avgOutputLength).toBe(0);
        expect(stats.hasMetadataCount).toBe(0);
    });
});
describe("writeParquet", ()=>{
    test("throws when parquetjs-lite not installed", async()=>{
        parquetState.installed=false;
        await expect(writeParquet([])).rejects.toThrow("parquetjs-lite not installed");
        parquetState.installed=true;
    });
    test("returns buffer when available", async()=>{
        let result=await writeParquet([{ format: "instruction", instruction: "a", output: "b" }]);
        expect(Buffer.isBuffer(result)).toBe(true);
    });
});
describe("pushToHub", ()=>{
    beforeEach(()=>{
        (axios.post as any).mockResolvedValue({ status: 200 });
    });
    test("creates repo and uploads files", async()=>{
        let result=await pushToHub({ token: "token", repoId: "user/dataset", jsonl: "{}", readme: "# Readme" });
        expect(axios.post).toHaveBeenCalledWith("https://huggingface.co/api/repos/create", expect.anything(), expect.anything());
        expect(axios.post).toHaveBeenCalledWith("https://huggingface.co/api/datasets/user/dataset/upload/main/train.jsonl", expect.anything(), expect.anything());
        expect(axios.post).toHaveBeenCalledWith("https://huggingface.co/api/datasets/user/dataset/upload/main/README.md", expect.anything(), expect.anything());
        expect(result.success).toBe(true);
        expect(result.repoUrl).toBe("https://huggingface.co/datasets/user/dataset");
    });
    test("uploads train.jsonl and README.md", async()=>{
        await pushToHub({ token: "token", repoId: "user/dataset", jsonl: "jsonl content", readme: "# Readme" });
        let calls=(axios.post as any).mock.calls;
        let uploadedFiles=calls.filter((call: any)=>call[0].includes("/upload/main/")).map((call: any)=>call[0]);
        expect(uploadedFiles).toContain("https://huggingface.co/api/datasets/user/dataset/upload/main/train.jsonl");
        expect(uploadedFiles).toContain("https://huggingface.co/api/datasets/user/dataset/upload/main/README.md");
    });
    test("includes Authorization header", async()=>{
        await pushToHub({ token: "secret-token", repoId: "user/dataset", jsonl: "{}", readme: "# Readme" });
        let calls=(axios.post as any).mock.calls;
        let hasAuth=calls.some((call: any)=>call[2]?.headers?.Authorization==="Bearer secret-token");
        expect(hasAuth).toBe(true);
    });
    test("uploads parquet when provided", async()=>{
        let parquet=Buffer.from("parquet");
        await pushToHub({ token: "token", repoId: "user/dataset", jsonl: "{}", readme: "# Readme", parquet });
        let calls=(axios.post as any).mock.calls;
        let uploadedFiles=calls.filter((call: any)=>call[0].includes("/upload/main/")).map((call: any)=>call[0]);
        expect(uploadedFiles).toContain("https://huggingface.co/api/datasets/user/dataset/upload/main/train.parquet");
    });
    test("throws on create repo error", async()=>{
        (axios.post as any).mockResolvedValueOnce({ status: 403 });
        await expect(pushToHub({ token: "token", repoId: "user/dataset", jsonl: "{}", readme: "# Readme" })).rejects.toThrow("Failed to create repo");
    });
    test("throws on upload error", async()=>{
        (axios.post as any).mockResolvedValueOnce({ status: 200 });
        (axios.post as any).mockResolvedValueOnce({ status: 500 });
        await expect(pushToHub({ token: "token", repoId: "user/dataset", jsonl: "{}", readme: "# Readme" })).rejects.toThrow("Failed to upload");
    });
});