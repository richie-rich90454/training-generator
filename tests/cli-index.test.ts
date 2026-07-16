// @vitest-environment node
// Tests for src/cli/index.ts. The CLI entrypoint calls main() at module
// load time, so we use vi.resetModules() + dynamic import to re-trigger
// main() with different process.argv values per test case. process.exit is
// stubbed as a no-op tracker so async main() does not become an unhandled
// rejection; we assert it was invoked instead of letting it throw.
import{describe,it,expect,vi,beforeEach,afterEach}from "vitest"
import path from "path"
import type{TrainingItem}from "../src/types/index.ts"

// Stub dependencies BEFORE the first import of src/cli/index.ts.
vi.mock("fs")
vi.mock("../src/cli/provider.ts",()=>({
    createCliProvider: vi.fn(()=>{
        return { name: "stub", generate: vi.fn(async () => ({ text: "", tokens: 0, provider: "stub" })) }
    })
}))
vi.mock("../src/renderer/processor.ts",async ()=>{
    return {
        default: class StubProcessor{
            provider: any
            concurrency = 3
            stats = { report: { totalChunks: 0, successfulChunks: 0, failedChunks: 0, successRate: 0, promptTokens: 0, totalTokens: 0 } }
            async processChunks(){
                return [{ format: "instruction", instruction: "Q?", input: "in", output: "A" }] as TrainingItem[]
            }
        }
    }
})
vi.mock("../src/core/fileParser.ts",async ()=>{
    return { default: class StubFileParser{ async parseFile(){ return "stub content" } } }
})
vi.mock("../src/renderer/chunker.ts",()=>({
    semanticChunk: vi.fn(() => ["chunk-1"]),
    simpleChunk: vi.fn(() => ["chunk-1"])
}))
vi.mock("../src/renderer/deduplicator.ts",()=>({
    deduplicate: vi.fn((items: any[]) => ({ items, removed: 0 }))
}))
vi.mock("../src/renderer/exportFormats.ts",()=>({
    exportJSONL: vi.fn(() => "JSONL_OUTPUT"),
    exportJSONArray: vi.fn(() => "JSON_ARRAY"),
    exportCSV: vi.fn(() => "CSV_OUTPUT")
}))
vi.mock("../src/cli/parsers.ts",()=>({
    parseQAPairs: vi.fn(() => []),
    parseConversationTurns: vi.fn(() => [])
}))
vi.mock("../src/core/proxyManager.ts",()=>({
    parseProxyUrl: vi.fn(),
    ProxyManager: class { constructor(..._args: any[]) {} }
}))

// fs is re-imported in beforeEach AFTER vi.resetModules() so the mock
// instance we set up matches the one used by the freshly-imported
// src/cli/index.ts module.
let fs: typeof import("fs")

// Reset module cache, set process.argv, and re-import src/cli/index.ts to
// re-trigger main() with the new argv. Waits for main() to flush its
// microtask queue so test assertions see final side effects.
async function importCli(argv: string[]): Promise<void> {
    Object.defineProperty(process, "argv", { value: ["node", "cli", ...argv], configurable: true })
    await import("../src/cli/index.ts")
    // Drain microtask queue so main()'s awaits complete before assertions.
    await new Promise(resolve => setImmediate(resolve))
    await new Promise(resolve => setImmediate(resolve))
}

// Wait until predicate returns truthy. Used for tests that need main() to
// reach a specific side effect before asserting.
async function waitForSideEffect(fn: () => boolean, timeoutMs = 1000): Promise<void> {
    let start = Date.now()
    while (Date.now() - start < timeoutMs) {
        if (fn()) return
        await new Promise(resolve => setImmediate(resolve))
    }
}

beforeEach(async () => {
    // Reset module cache so main() re-runs with fresh mocks each test.
    // MUST happen BEFORE we set up mock implementations, because resetModules
    // invalidates the previous mock instance.
    vi.resetModules()
    vi.clearAllMocks()
    // Re-import fs so we operate on the same mock instance that the
    // freshly-imported src/cli/index.ts will use.
    fs = await import("fs")
    vi.mocked(fs.readFileSync).mockReturnValue("")
    vi.mocked(fs.writeFileSync).mockImplementation(() => {})
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any)
    vi.mocked(fs.readdirSync).mockReturnValue([])
    vi.mocked(fs.mkdirSync).mockImplementation(() => {})
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    // process.exit: no-op tracker. Throws cause unhandled rejections because
    // main() is async; we assert on call args instead.
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as any)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe("CLI entrypoint success path", () => {
    it("processes files and writes JSONL output by default", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc1.txt" } as any
        ])
        let writtenPath: string | null = null
        let writtenContent: string | null = null
        vi.mocked(fs.writeFileSync).mockImplementation((p, c) => {
            writtenPath = p as string
            writtenContent = c as string
        })

        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl"])

        await waitForSideEffect(() => vi.mocked(fs.writeFileSync).mock.calls.length > 0)
        expect(writtenPath).toBe(path.resolve("C:/out/output.jsonl"))
        expect(writtenContent).toBe("JSONL_OUTPUT")
    })

    it("writes JSON output when extension is .json", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let writtenContent: string | null = null
        vi.mocked(fs.writeFileSync).mockImplementation((_p, c) => { writtenContent = c as string })

        await importCli(["--input", "C:/in", "--output", "C:/out/output.json"])
        await waitForSideEffect(() => vi.mocked(fs.writeFileSync).mock.calls.length > 0)

        expect(writtenContent).toBe("JSON_ARRAY")
    })

    it("writes CSV output when extension is .csv", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let writtenContent: string | null = null
        vi.mocked(fs.writeFileSync).mockImplementation((_p, c) => { writtenContent = c as string })

        await importCli(["--input", "C:/in", "--output", "C:/out/output.csv"])
        await waitForSideEffect(() => vi.mocked(fs.writeFileSync).mock.calls.length > 0)

        expect(writtenContent).toBe("CSV_OUTPUT")
    })

    it("falls back to JSONL when extension is unrecognized", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let writtenContent: string | null = null
        vi.mocked(fs.writeFileSync).mockImplementation((_p, c) => { writtenContent = c as string })

        await importCli(["--input", "C:/in", "--output", "C:/out/output.weird"])
        await waitForSideEffect(() => vi.mocked(fs.writeFileSync).mock.calls.length > 0)

        expect(writtenContent).toBe("JSONL_OUTPUT")
    })

    it("creates output directory if it does not exist", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let dirCreated = false
        // existsSync should return false ONLY for the output directory (any
        // path whose basename is "out"), true for everything else.
        vi.mocked(fs.existsSync).mockImplementation((p) => {
            let s = String(p).replace(/\\/g, "/")
            if (s.endsWith("/out")) return false
            return true
        })
        vi.mocked(fs.mkdirSync).mockImplementation(() => { dirCreated = true })

        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl"])
        await waitForSideEffect(() => dirCreated)

        expect(dirCreated).toBe(true)
    })

    it("filters input directory to supported file types only", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any,
            { isFile: () => true, name: "image.png" } as any,
            { isFile: () => true, name: "readme.md" } as any,
            { isFile: () => true, name: "notes.unknown" } as any
        ])
        let consoleLogSpy = vi.mocked(console.log)
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl"])
        await waitForSideEffect(() => consoleLogSpy.mock.calls.length > 0)
        let calls = consoleLogSpy.mock.calls.map(c => String(c[0]))
        expect(calls.some(s => s.includes("Processing: doc.txt"))).toBe(true)
        expect(calls.some(s => s.includes("Processing: readme.md"))).toBe(true)
        expect(calls.some(s => s.includes("Processing: image.png"))).toBe(false)
    })

    it("uses fallback simpleChunk when semanticChunk returns empty array", async () => {
        let chunker = await import("../src/renderer/chunker.ts")
        vi.mocked(chunker.semanticChunk).mockReturnValueOnce([])
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])

        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl"])
        await waitForSideEffect(() => vi.mocked(chunker.simpleChunk).mock.calls.length > 0)

        expect(chunker.simpleChunk).toHaveBeenCalled()
    })

    it("passes --type argument through to processing", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let consoleLogSpy = vi.mocked(console.log)
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl", "--type", "conversation"])
        await waitForSideEffect(() => consoleLogSpy.mock.calls.some(c => String(c[0]).includes("Processing type:")))
        let typeCall = consoleLogSpy.mock.calls.find(c => String(c[0]).includes("Processing type:"))
        expect(String(typeCall![0])).toContain("conversation")
    })

    it("passes --model argument through to processing", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let consoleLogSpy = vi.mocked(console.log)
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl", "--model", "mistral"])
        await waitForSideEffect(() => consoleLogSpy.mock.calls.some(c => String(c[0]).includes("Model:")))
        let modelCall = consoleLogSpy.mock.calls.find(c => String(c[0]).includes("Model:"))
        expect(String(modelCall![0])).toContain("mistral")
    })

    it("passes --provider argument through to processing", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let consoleLogSpy = vi.mocked(console.log)
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl", "--provider", "openai"])
        await waitForSideEffect(() => consoleLogSpy.mock.calls.some(c => String(c[0]).includes("Provider:")))
        let providerCall = consoleLogSpy.mock.calls.find(c => String(c[0]).includes("Provider:"))
        expect(String(providerCall![0])).toContain("openai")
    })

    it("passes --chunk-size argument through to processing", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let consoleLogSpy = vi.mocked(console.log)
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl", "--chunk-size", "4096"])
        await waitForSideEffect(() => consoleLogSpy.mock.calls.some(c => String(c[0]).includes("Chunk size:")))
        let chunkCall = consoleLogSpy.mock.calls.find(c => String(c[0]).includes("Chunk size:"))
        expect(String(chunkCall![0])).toContain("4096")
    })

    it("passes --concurrency argument through to processing", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let consoleLogSpy = vi.mocked(console.log)
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl", "--concurrency", "8"])
        await waitForSideEffect(() => consoleLogSpy.mock.calls.some(c => String(c[0]).includes("Concurrency:")))
        let concCall = consoleLogSpy.mock.calls.find(c => String(c[0]).includes("Concurrency:"))
        expect(String(concCall![0])).toContain("8")
    })

    it("initializes proxy manager when --proxy argument provided", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let consoleLogSpy = vi.mocked(console.log)
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl", "--proxy", "http://proxy:8080"])
        await waitForSideEffect(() => consoleLogSpy.mock.calls.some(c => String(c[0]).includes("Proxy:")))
        let proxyCall = consoleLogSpy.mock.calls.find(c => String(c[0]).includes("Proxy:"))
        expect(String(proxyCall![0])).toContain("http://proxy:8080")
    })

    it("loads config from --config path when provided", async () => {
        let configContent = JSON.stringify({
            input: "C:/from-config",
            output: "C:/out-from-config/output.jsonl",
            type: "conversation",
            model: "mistral",
            provider: "anthropic",
            chunkSize: 2048,
            concurrency: 5
        })
        vi.mocked(fs.readFileSync).mockImplementation((p) => {
            if (String(p).endsWith("config.json")) return configContent
            return ""
        })
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let consoleLogSpy = vi.mocked(console.log)
        await importCli(["--config", "config.json"])
        await waitForSideEffect(() => consoleLogSpy.mock.calls.some(c => String(c[0]).includes("Input directory:")))
        let inputCall = consoleLogSpy.mock.calls.find(c => String(c[0]).includes("Input directory:"))
        expect(String(inputCall![0])).toContain("from-config")
        let typeCall = consoleLogSpy.mock.calls.find(c => String(c[0]).includes("Processing type:"))
        expect(String(typeCall![0])).toContain("conversation")
    })

    it("catches and logs per-file processing errors without exiting", async () => {
        let fileParser = await import("../src/core/fileParser.ts")
        let StubFileParser = fileParser.default as any
        let callCount = 0
        let originalImpl = StubFileParser.prototype.parseFile
        StubFileParser.prototype.parseFile = async function () {
            callCount++
            if (callCount === 1) throw new Error("parse failure")
            return "good content"
        }

        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "bad.txt" } as any,
            { isFile: () => true, name: "good.txt" } as any
        ])

        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl"])
        await waitForSideEffect(() => vi.mocked(console.error).mock.calls.some(c => String(c[0]).includes("Failed to process bad.txt")))

        expect(vi.mocked(console.error)).toHaveBeenCalledWith(expect.stringContaining("Failed to process bad.txt"))
        StubFileParser.prototype.parseFile = originalImpl
    })
})

describe("CLI entrypoint error paths", () => {
    it("exits with error when --input is missing", async () => {
        await importCli(["--output", "C:/out/output.jsonl"])
        await waitForSideEffect(() => vi.mocked(process.exit).mock.calls.length > 0)
        expect(vi.mocked(console.error)).toHaveBeenCalledWith(expect.stringContaining("--input <dir> is required"))
        expect(vi.mocked(process.exit)).toHaveBeenCalledWith(1)
    })

    it("exits with error when --output is missing", async () => {
        await importCli(["--input", "C:/in"])
        await waitForSideEffect(() => vi.mocked(process.exit).mock.calls.length > 0)
        expect(vi.mocked(console.error)).toHaveBeenCalledWith(expect.stringContaining("--output <file> is required"))
        expect(vi.mocked(process.exit)).toHaveBeenCalledWith(1)
    })

    it("exits with error when input directory does not exist", async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false)
        await importCli(["--input", "C:/missing", "--output", "C:/out/output.jsonl"])
        await waitForSideEffect(() => vi.mocked(process.exit).mock.calls.length > 0)
        expect(vi.mocked(console.error)).toHaveBeenCalledWith(expect.stringContaining("input directory does not exist"))
        expect(vi.mocked(process.exit)).toHaveBeenCalledWith(1)
    })

    it("exits with error when input path is not a directory", async () => {
        vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any)
        await importCli(["--input", "C:/file.txt", "--output", "C:/out/output.jsonl"])
        await waitForSideEffect(() => vi.mocked(process.exit).mock.calls.length > 0)
        expect(vi.mocked(console.error)).toHaveBeenCalledWith(expect.stringContaining("input directory does not exist"))
        expect(vi.mocked(process.exit)).toHaveBeenCalledWith(1)
    })

    it("exits with error when no supported files found in input directory", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "image.png" } as any,
            { isFile: () => true, name: "video.mp4" } as any
        ])
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl"])
        await waitForSideEffect(() => vi.mocked(process.exit).mock.calls.length > 0)
        expect(vi.mocked(console.error)).toHaveBeenCalledWith(expect.stringContaining("no supported files found"))
        expect(vi.mocked(process.exit)).toHaveBeenCalledWith(1)
    })

    it("exits with error when config file fails to load", async () => {
        vi.mocked(fs.readFileSync).mockImplementation((p) => {
            if (String(p).endsWith("bad-config.json")) throw new Error("ENOENT")
            return ""
        })
        await importCli(["--config", "bad-config.json"])
        await waitForSideEffect(() => vi.mocked(process.exit).mock.calls.length > 0)
        expect(vi.mocked(console.error)).toHaveBeenCalledWith(expect.stringContaining("Failed to load config file"))
        expect(vi.mocked(process.exit)).toHaveBeenCalledWith(1)
    })

    it("handles fatal error in main() with top-level catch", async () => {
        vi.mocked(fs.readdirSync).mockImplementation(() => { throw new Error("fatal IO error") })
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl"])
        await waitForSideEffect(() => vi.mocked(console.error).mock.calls.some(c => String(c[0] ?? c[1] ?? "").includes("Fatal error")))
        // The top-level catch logs: console.error("Fatal error:", errorMessage)
        // Two-argument call — match first arg with the literal label.
        expect(vi.mocked(console.error)).toHaveBeenCalledWith(
            expect.stringContaining("Fatal error"),
            expect.anything()
        )
    })
})

describe("CLI argument parsing edge cases", () => {
    it("uses default values when no arguments provided (exits due to missing input)", async () => {
        await importCli([])
        await waitForSideEffect(() => vi.mocked(process.exit).mock.calls.length > 0)
        expect(vi.mocked(console.error)).toHaveBeenCalledWith(expect.stringContaining("--input <dir> is required"))
    })

    it("ignores unrecognized arguments", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        await importCli([
            "--input", "C:/in",
            "--output", "C:/out/output.jsonl",
            "--unknown-flag", "ignored-value",
            "--another-unknown"
        ])
        await waitForSideEffect(() => vi.mocked(fs.writeFileSync).mock.calls.length > 0)
        // Should have completed successfully (writeOutput was called)
        expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalled()
    })

    it("uses default type when --type not provided", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let consoleLogSpy = vi.mocked(console.log)
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl"])
        await waitForSideEffect(() => consoleLogSpy.mock.calls.some(c => String(c[0]).includes("Processing type:")))
        let typeCall = consoleLogSpy.mock.calls.find(c => String(c[0]).includes("Processing type:"))
        expect(String(typeCall![0])).toContain("instruction")
    })

    it("uses default model when --model not provided", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let consoleLogSpy = vi.mocked(console.log)
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl"])
        await waitForSideEffect(() => consoleLogSpy.mock.calls.some(c => String(c[0]).includes("Model:")))
        let modelCall = consoleLogSpy.mock.calls.find(c => String(c[0]).includes("Model:"))
        expect(String(modelCall![0])).toContain("llama3")
    })

    it("uses default provider when --provider not provided", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let consoleLogSpy = vi.mocked(console.log)
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl"])
        await waitForSideEffect(() => consoleLogSpy.mock.calls.some(c => String(c[0]).includes("Provider:")))
        let providerCall = consoleLogSpy.mock.calls.find(c => String(c[0]).includes("Provider:"))
        expect(String(providerCall![0])).toContain("ollama")
    })

    it("uses default chunk size when --chunk-size not provided", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let consoleLogSpy = vi.mocked(console.log)
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl"])
        await waitForSideEffect(() => consoleLogSpy.mock.calls.some(c => String(c[0]).includes("Chunk size:")))
        let chunkCall = consoleLogSpy.mock.calls.find(c => String(c[0]).includes("Chunk size:"))
        expect(String(chunkCall![0])).toContain("8000")
    })

    it("uses default concurrency when --concurrency not provided", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let consoleLogSpy = vi.mocked(console.log)
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl"])
        await waitForSideEffect(() => consoleLogSpy.mock.calls.some(c => String(c[0]).includes("Concurrency:")))
        let concCall = consoleLogSpy.mock.calls.find(c => String(c[0]).includes("Concurrency:"))
        expect(String(concCall![0])).toContain("3")
    })

    it("falls back to default chunk size when --chunk-size value is invalid", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let consoleLogSpy = vi.mocked(console.log)
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl", "--chunk-size", "not-a-number"])
        await waitForSideEffect(() => consoleLogSpy.mock.calls.some(c => String(c[0]).includes("Chunk size:")))
        let chunkCall = consoleLogSpy.mock.calls.find(c => String(c[0]).includes("Chunk size:"))
        expect(String(chunkCall![0])).toContain("8000")
    })

    it("falls back to default concurrency when --concurrency value is invalid", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        let consoleLogSpy = vi.mocked(console.log)
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl", "--concurrency", "invalid"])
        await waitForSideEffect(() => consoleLogSpy.mock.calls.some(c => String(c[0]).includes("Concurrency:")))
        let concCall = consoleLogSpy.mock.calls.find(c => String(c[0]).includes("Concurrency:"))
        expect(String(concCall![0])).toContain("3")
    })

    it("ignores --input flag when next argument is missing", async () => {
        await importCli(["--output", "C:/out/output.jsonl", "--input"])
        await waitForSideEffect(() => vi.mocked(process.exit).mock.calls.length > 0)
        expect(vi.mocked(console.error)).toHaveBeenCalledWith(expect.stringContaining("--input <dir> is required"))
    })

    it("ignores --output flag when next argument is missing", async () => {
        await importCli(["--input", "C:/in", "--output"])
        await waitForSideEffect(() => vi.mocked(process.exit).mock.calls.length > 0)
        expect(vi.mocked(console.error)).toHaveBeenCalledWith(expect.stringContaining("--output <file> is required"))
    })
})

describe("CLI output statistics", () => {
    it("reports total items generated in summary", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl"])
        await waitForSideEffect(() => vi.mocked(console.error).mock.calls.some(c => String(c[0]).includes("Total items generated:")))
        expect(vi.mocked(console.error)).toHaveBeenCalledWith(expect.stringContaining("Total items generated:"))
    })

    it("reports time elapsed in seconds", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl"])
        await waitForSideEffect(() => vi.mocked(console.error).mock.calls.some(c => String(c[0]).includes("Time elapsed:")))
        expect(vi.mocked(console.error)).toHaveBeenCalledWith(expect.stringContaining("Time elapsed:"))
    })

    it("reports output path in summary", async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            { isFile: () => true, name: "doc.txt" } as any
        ])
        await importCli(["--input", "C:/in", "--output", "C:/out/output.jsonl"])
        await waitForSideEffect(() => vi.mocked(console.error).mock.calls.some(c => String(c[0]).includes("Output written to:")))
        expect(vi.mocked(console.error)).toHaveBeenCalledWith(expect.stringContaining("Output written to:"))
    })
})
