// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { HealthChecker } from "../src/core/healthChecker.js";
import { DiagnosticsGenerator, collectLogs, summarizeItems, DiagnosticsReport } from "../src/core/diagnostics.js";
import { TrainingItem } from "../src/types/interfaces.js";
let zipState=vi.hoisted(()=>{
    let instances: any[]=[];
    return {
        installed: true,
        instances: instances,
        AdmZip: vi.fn(function(this: any){
            let instance={
                addFile: vi.fn(),
                writeZip: vi.fn((_path: string, cb?: (err: Error|null)=>void)=>cb?.(null))
            };
            instances.push(instance);
            return instance;
        })
    };
});
vi.mock("adm-zip", ()=>({
    get default(){
        return zipState.installed?zipState.AdmZip:undefined;
    }
}));
let fsState=vi.hoisted(()=>({
    files: {} as Record<string, string>,
    addFile(path: string, content: string): void{
        this.files[path]=content;
    },
    reset(): void{
        this.files={};
    }
}));
vi.mock("fs", ()=>({
    default: {
        existsSync: vi.fn((_p: string)=>true),
        mkdirSync: vi.fn((_p: string, _options?: any)=>{}),
        writeFileSync: vi.fn((p: string, data: string)=>{
            fsState.files[p]=data;
        }),
        promises: {
            readFile: vi.fn(async(p: string)=>{
                if (p in fsState.files){
                    return fsState.files[p];
                }
                let err=new Error("ENOENT") as NodeJS.ErrnoException;
                err.code="ENOENT";
                throw err;
            })
        }
    }
}));
beforeEach(()=>{
    fsState.reset();
    zipState.instances.length=0;
    zipState.installed=true;
    vi.clearAllMocks();
});
describe("DiagnosticsGenerator", ()=>{
    test("constructor stores appVersion", ()=>{
        let generator=new DiagnosticsGenerator({appVersion: "1.2.3"});
        expect(generator).toBeDefined();
    });
    test("generate returns report with all required fields", async ()=>{
        let generator=new DiagnosticsGenerator({appVersion: "1.0.0"});
        let report=await generator.generate();
        expect(report.generatedAt).toBeDefined();
        expect(report.appVersion).toBe("1.0.0");
        expect(report.platform).toBe(process.platform);
        expect(report.health).toBeDefined();
        expect(report.logs).toBeDefined();
        expect(report.settings).toBeDefined();
        expect(report.providerStatuses).toBeDefined();
        expect(report.itemSummary).toBeDefined();
    });
    test("generate includes generatedAt timestamp", async ()=>{
        let before=Date.now();
        let generator=new DiagnosticsGenerator({appVersion: "1.0.0"});
        let report=await generator.generate();
        let after=Date.now();
        expect(report.generatedAt).toBeGreaterThanOrEqual(before);
        expect(report.generatedAt).toBeLessThanOrEqual(after);
    });
    test("generate includes platform", async ()=>{
        let generator=new DiagnosticsGenerator({appVersion: "1.0.0"});
        let report=await generator.generate();
        expect(report.platform).toBe(process.platform);
    });
    test("generate includes settings from provider", async ()=>{
        let generator=new DiagnosticsGenerator({
            appVersion: "1.0.0",
            settingsProvider: ()=>({theme: "dark"})
        });
        let report=await generator.generate();
        expect(report.settings.theme).toBe("dark");
    });
    test("generate scrubs secrets from settings", async ()=>{
        let generator=new DiagnosticsGenerator({
            appVersion: "1.0.0",
            settingsProvider: ()=>({apiKey: "secret123", theme: "dark"})
        });
        let report=await generator.generate();
        expect(report.settings.apiKey).toBe("***SCRUBBED***");
        expect(report.settings.theme).toBe("dark");
    });
    test("generate includes health status", async ()=>{
        let healthChecker=new HealthChecker();
        healthChecker.register("test", ()=>({name: "test", status: "healthy", message: "ok", durationMs: 0}));
        let generator=new DiagnosticsGenerator({appVersion: "1.0.0", healthChecker});
        let report=await generator.generate();
        expect(report.health).toEqual(expect.objectContaining({overall: "healthy"}));
    });
    test("generate includes empty health when no checker", async ()=>{
        let generator=new DiagnosticsGenerator({appVersion: "1.0.0"});
        let report=await generator.generate();
        expect(report.health).toEqual({});
    });
    test("generate includes provider statuses scrubbed", async ()=>{
        let generator=new DiagnosticsGenerator({
            appVersion: "1.0.0",
            providerRegistry: {providers: [{name: "p", apiKey: "secret"}]}
        });
        let report=await generator.generate();
        expect(report.providerStatuses).toEqual({providers: [{name: "p", apiKey: "***SCRUBBED***"}]});
    });
    test("generate includes empty provider statuses when no registry", async ()=>{
        let generator=new DiagnosticsGenerator({appVersion: "1.0.0"});
        let report=await generator.generate();
        expect(report.providerStatuses).toEqual({});
    });
    test("generate includes logs from logPath", async ()=>{
        fsState.addFile("/logs/app.log", "line1\nline2\nline3");
        let generator=new DiagnosticsGenerator({appVersion: "1.0.0", logPath: "/logs/app.log"});
        let report=await generator.generate();
        expect(report.logs).toEqual(["line1", "line2", "line3"]);
    });
    test("generate includes itemSummary when sample items provided", async ()=>{
        let items: TrainingItem[]=[
            {format: "text", text: "hello"},
            {format: "instruction", instruction: "do", output: "done"}
        ];
        let generator=new DiagnosticsGenerator({appVersion: "1.0.0"});
        let report=await generator.generate(items);
        expect(report.itemSummary).toEqual({
            total: 2,
            byFormat: {text: 1, instruction: 1},
            avgLength: expect.any(Number),
            formatDetails: {
                text: {count: 1, avgLength: 5},
                instruction: {count: 1, avgLength: 6}
            }
        });
    });
    test("generate itemSummary is empty when no items", async ()=>{
        let generator=new DiagnosticsGenerator({appVersion: "1.0.0"});
        let report=await generator.generate();
        expect(report.itemSummary).toEqual({});
    });
});
describe("scrubSecrets", ()=>{
    test("redacts apiKey", ()=>{
        let generator=new DiagnosticsGenerator({appVersion: "1.0.0"});
        let result=generator.scrubSecrets({apiKey: "secret"});
        expect(result).toEqual({apiKey: "***SCRUBBED***"});
    });
    test("redacts nested secrets", ()=>{
        let generator=new DiagnosticsGenerator({appVersion: "1.0.0"});
        let result=generator.scrubSecrets({provider: {apiKey: "secret", name: "p"}});
        expect(result).toEqual({provider: {apiKey: "***SCRUBBED***", name: "p"}});
    });
    test("redacts secrets in arrays", ()=>{
        let generator=new DiagnosticsGenerator({appVersion: "1.0.0"});
        let result=generator.scrubSecrets([{token: "t1"}, {token: "t2"}]);
        expect(result).toEqual([{token: "***SCRUBBED***"}, {token: "***SCRUBBED***"}]);
    });
    test("leaves non-secrets intact", ()=>{
        let generator=new DiagnosticsGenerator({appVersion: "1.0.0"});
        let input={name: "alice", count: 42, active: true, nested: {value: "x"}};
        let result=generator.scrubSecrets(input);
        expect(result).toEqual(input);
    });
    test("redacts multiple secret patterns", ()=>{
        let generator=new DiagnosticsGenerator({appVersion: "1.0.0"});
        let result=generator.scrubSecrets({
            apiKey: "a",
            secret: "b",
            token: "c",
            password: "d",
            privateKey: "e"
        });
        expect(result).toEqual({
            apiKey: "***SCRUBBED***",
            secret: "***SCRUBBED***",
            token: "***SCRUBBED***",
            password: "***SCRUBBED***",
            privateKey: "***SCRUBBED***"
        });
    });
});
describe("collectLogs", ()=>{
    test("returns all lines when fewer than max", async ()=>{
        fsState.addFile("/logs/app.log", "a\nb\nc");
        let lines=await collectLogs("/logs/app.log", 10);
        expect(lines).toEqual(["a", "b", "c"]);
    });
    test("returns last N lines", async ()=>{
        fsState.addFile("/logs/app.log", "a\nb\nc\nd\ne");
        let lines=await collectLogs("/logs/app.log", 3);
        expect(lines).toEqual(["c", "d", "e"]);
    });
    test("handles trailing newline", async ()=>{
        fsState.addFile("/logs/app.log", "a\nb\nc\n");
        let lines=await collectLogs("/logs/app.log", 10);
        expect(lines).toEqual(["a", "b", "c"]);
    });
    test("returns empty array when file missing", async ()=>{
        let lines=await collectLogs("/logs/missing.log", 10);
        expect(lines).toEqual([]);
    });
    test("returns empty array for empty file", async ()=>{
        fsState.addFile("/logs/app.log", "");
        let lines=await collectLogs("/logs/app.log", 10);
        expect(lines).toEqual([]);
    });
});
describe("summarizeItems", ()=>{
    test("computes counts by format", ()=>{
        let items: TrainingItem[]=[
            {format: "text", text: "a"},
            {format: "text", text: "b"},
            {format: "instruction", instruction: "c", output: "d"}
        ];
        let summary=summarizeItems(items) as Record<string, any>;
        expect(summary.total).toBe(3);
        expect(summary.byFormat).toEqual({text: 2, instruction: 1});
    });
    test("computes average length", ()=>{
        let items: TrainingItem[]=[
            {format: "text", text: "hello"},
            {format: "text", text: "world"}
        ];
        let summary=summarizeItems(items) as Record<string, any>;
        expect(summary.avgLength).toBe(5);
    });
    test("handles empty array", ()=>{
        let summary=summarizeItems([]);
        expect(summary).toEqual({
            total: 0,
            byFormat: {},
            avgLength: 0,
            formatDetails: {}
        });
    });
    test("includes chatml messages length", ()=>{
        let items: TrainingItem[]=[
            {format: "chatml", messages: [{role: "user", content: "hi"}]}
        ];
        let summary=summarizeItems(items) as Record<string, any>;
        expect(summary.total).toBe(1);
        expect(summary.byFormat.chatml).toBe(1);
        expect(summary.formatDetails.chatml.avgLength).toBe(6);
    });
});
describe("exportZip", ()=>{
    test("creates zip using adm-zip", async ()=>{
        let generator=new DiagnosticsGenerator({appVersion: "1.0.0"});
        let result=await generator.exportZip("/tmp/diagnostics.zip");
        expect(result).toBe("/tmp/diagnostics.zip");
        expect(zipState.AdmZip).toHaveBeenCalled();
        expect(zipState.instances.length).toBe(1);
        let instance=zipState.instances[0];
        expect(instance.addFile).toHaveBeenCalledWith("diagnostics/report.json", expect.any(Buffer));
        expect(instance.writeZip).toHaveBeenCalledWith("/tmp/diagnostics.zip", expect.any(Function));
    });
    test("falls back to JSON when zip lib unavailable", async ()=>{
        zipState.installed=false;
        let generator=new DiagnosticsGenerator({appVersion: "1.0.0"});
        let result=await generator.exportZip("/tmp/diagnostics.zip");
        expect(result).toBe("/tmp/diagnostics.json");
        expect(fsState.files["/tmp/diagnostics.json"]).toBeDefined();
        let parsed=JSON.parse(fsState.files["/tmp/diagnostics.json"]);
        expect(parsed.appVersion).toBe("1.0.0");
    });
    test("fallback appends json extension when path has no zip", async ()=>{
        zipState.installed=false;
        let generator=new DiagnosticsGenerator({appVersion: "1.0.0"});
        let result=await generator.exportZip("/tmp/diagnostics");
        expect(result).toBe("/tmp/diagnostics.json");
    });
});
