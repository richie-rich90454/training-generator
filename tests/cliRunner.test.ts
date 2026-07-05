// @vitest-environment node
import { describe, it, expect } from "vitest"
import { Readable } from "stream"
import type { TrainingItem } from "../src/types/index.ts"
import { CliRunner, CliOptions, CliExitCode, readStdin, formatPlan } from "../src/core/cliRunner.ts"
describe("CliRunner.parseArgs",()=>{
    it("parses --stdin",()=>{
        let runner=new CliRunner()
        let opts=runner.parseArgs(["--stdin"])
        expect(opts.stdin).toBe(true)
    })
    it("parses --stdout",()=>{
        let runner=new CliRunner()
        let opts=runner.parseArgs(["--stdout"])
        expect(opts.stdout).toBe(true)
    })
    it("parses --dry-run",()=>{
        let runner=new CliRunner()
        let opts=runner.parseArgs(["--dry-run"])
        expect(opts.dryRun).toBe(true)
    })
    it("parses --profile",()=>{
        let runner=new CliRunner()
        let opts=runner.parseArgs(["--profile","default"])
        expect(opts.profile).toBe("default")
    })
    it("parses single --override",()=>{
        let runner=new CliRunner()
        let opts=runner.parseArgs(["--override","key=value"])
        expect(opts.override).toEqual({key:"value"})
    })
    it("parses multiple --override",()=>{
        let runner=new CliRunner()
        let opts=runner.parseArgs(["--override","a=1","--override","b=2"])
        expect(opts.override).toEqual({a:"1",b:"2"})
    })
    it("parses --config",()=>{
        let runner=new CliRunner()
        let opts=runner.parseArgs(["--config","cfg.json"])
        expect(opts.configPath).toBe("cfg.json")
    })
    it("parses single --input",()=>{
        let runner=new CliRunner()
        let opts=runner.parseArgs(["--input","a.txt"])
        expect(opts.input).toEqual(["a.txt"])
    })
    it("parses multiple --input",()=>{
        let runner=new CliRunner()
        let opts=runner.parseArgs(["--input","a.txt","--input","b.txt"])
        expect(opts.input).toEqual(["a.txt","b.txt"])
    })
    it("parses --output",()=>{
        let runner=new CliRunner()
        let opts=runner.parseArgs(["--output","out.jsonl"])
        expect(opts.output).toBe("out.jsonl")
    })
    it("parses --format",()=>{
        let runner=new CliRunner()
        let opts=runner.parseArgs(["--format","csv"])
        expect(opts.format).toBe("csv")
    })
})
describe("CliRunner.loadProfile",()=>{
    it("merges profile options",()=>{
        let config=JSON.stringify({profiles:{default:{format:"jsonl",output:"out.jsonl"}}})
        let runner=new CliRunner({readFile:()=>config})
        let profile=runner.loadProfile("default","config.json")
        expect(profile.format).toBe("jsonl")
        expect(profile.output).toBe("out.jsonl")
    })
    it("returns empty when profile missing",()=>{
        let config=JSON.stringify({profiles:{other:{format:"jsonl"}}})
        let runner=new CliRunner({readFile:()=>config})
        let profile=runner.loadProfile("default","config.json")
        expect(profile).toEqual({})
    })
    it("returns empty when config path missing",()=>{
        let runner=new CliRunner()
        let profile=runner.loadProfile("default")
        expect(profile).toEqual({})
    })
})
describe("CliRunner.applyOverrides",()=>{
    it("sets top-level key",()=>{
        let runner=new CliRunner()
        let opts=runner.applyOverrides({override:{format:"csv"}})
        expect(opts.format).toBe("csv")
    })
    it("sets nested key via dot notation",()=>{
        let runner=new CliRunner()
        let opts=runner.applyOverrides({override:{"a.b":"value"}})
        expect((opts.a as Record<string, unknown>).b).toBe("value")
    })
    it("creates intermediate objects",()=>{
        let runner=new CliRunner()
        let opts=runner.applyOverrides({override:{"x.y.z":"deep"}})
        expect(((opts.x as Record<string, unknown>).y as Record<string, unknown>).z).toBe("deep")
    })
})
describe("CliRunner.run",()=>{
    it("returns SUCCESS when no errors",async ()=>{
        let runner=new CliRunner({processFn:async ()=>{return {items:[],errors:[]}}})
        let code=await runner.run([])
        expect(code).toBe(CliExitCode.SUCCESS)
    })
    it("returns PARTIAL_FAILURE on errors",async ()=>{
        let runner=new CliRunner({processFn:async ()=>{return {items:[],errors:["bad"]}}})
        let code=await runner.run([])
        expect(code).toBe(CliExitCode.PARTIAL_FAILURE)
    })
    it("returns NETWORK_ERROR on network tagged errors",async ()=>{
        let runner=new CliRunner({processFn:async ()=>{return {items:[],errors:["[network] timeout"]}}})
        let code=await runner.run([])
        expect(code).toBe(CliExitCode.NETWORK_ERROR)
    })
    it("returns CONFIG_ERROR on bad config",async ()=>{
        let runner=new CliRunner({readFile:()=>"{bad json",processFn:async ()=>{return {items:[],errors:[]}}})
        let code=await runner.run(["--config","bad.json","--profile","default"])
        expect(code).toBe(CliExitCode.CONFIG_ERROR)
    })
    it("returns ABORT on cancellation",async ()=>{
        let abortError=new Error("aborted")
        abortError.name="AbortError"
        let runner=new CliRunner({processFn:async ()=>{throw abortError}})
        let code=await runner.run([])
        expect(code).toBe(CliExitCode.ABORT)
    })
    it("dryRun returns plan without processing",async ()=>{
        let output=""
        let stdout={write:(chunk: string)=>{output+=chunk}} as NodeJS.WritableStream
        let runner=new CliRunner({stdout:stdout,processFn:async ()=>{throw new Error("should not run")}})
        let code=await runner.run(["--dry-run","--input","a.txt","--output","out.jsonl","--format","jsonl"])
        expect(code).toBe(CliExitCode.SUCCESS)
        expect(output).toContain("Plan:")
        expect(output).toContain("dry-run")
    })
    it("stdin reads content and adds to input",async ()=>{
        let stream=Readable.from(["file1.txt\n","file2.txt\n"])
        let captured: CliOptions|undefined
        let runner=new CliRunner({stdin:stream,processFn:async (args: CliOptions)=>{captured=args;return {items:[],errors:[]}}})
        let code=await runner.run(["--stdin"])
        expect(code).toBe(CliExitCode.SUCCESS)
        expect(captured?.input).toEqual(["file1.txt","file2.txt"])
    })
    it("stdout writes JSONL",async ()=>{
        let output=""
        let stdout={write:(chunk: string)=>{output+=chunk}} as NodeJS.WritableStream
        let items: TrainingItem[]=[{format:"instruction",instruction:"q",output:"a"}]
        let runner=new CliRunner({stdout:stdout,processFn:async ()=>{return {items,errors:[]}}})
        let code=await runner.run(["--stdout","--format","jsonl"])
        expect(code).toBe(CliExitCode.SUCCESS)
        expect(output.trim()).toBe(JSON.stringify(items[0]))
    })
    it("output writes file",async ()=>{
        let written: {path: string,content: string}|undefined
        let items: TrainingItem[]=[{format:"text",text:"hello"}]
        let runner=new CliRunner({writeFile:(path: string,content: string)=>{written={path,content}},processFn:async ()=>{return {items,errors:[]}}})
        let code=await runner.run(["--output","out.jsonl","--format","jsonl"])
        expect(code).toBe(CliExitCode.SUCCESS)
        expect(written?.path).toBe("out.jsonl")
        expect(written?.content).toBe(JSON.stringify(items[0]))
    })
    it("merges profile options before overrides",async ()=>{
        let config=JSON.stringify({profiles:{default:{format:"json",output:"default.jsonl"}}})
        let captured: CliOptions|undefined
        let runner=new CliRunner({readFile:()=>config,processFn:async (args: CliOptions)=>{captured=args;return {items:[],errors:[]}}})
        await runner.run(["--profile","default","--config","cfg.json","--override","format=jsonl"])
        expect(captured?.format).toBe("jsonl")
        expect(captured?.output).toBe("default.jsonl")
    })
})
describe("readStdin",()=>{
    it("reads stream content",async ()=>{
        let stream=Readable.from(["hello ","world"])
        let content=await readStdin(stream)
        expect(content).toBe("hello world")
    })
})
describe("formatPlan",()=>{
    it("includes plan details",()=>{
        let plan=formatPlan({dryRun:true,input:["a.txt"],output:"out.jsonl",profile:"default",format:"jsonl",override:{foo:"bar"}})
        expect(plan).toContain("Plan:")
        expect(plan).toContain("a.txt")
        expect(plan).toContain("out.jsonl")
        expect(plan).toContain("default")
        expect(plan).toContain("foo=bar")
    })
})
