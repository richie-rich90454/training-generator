// @vitest-environment node
import { describe, it, expect, vi } from "vitest"
import { EventEmitter } from "events"
import { Writable } from "stream"
import { HookRunner, HookContext, HookConfig, buildHookEnv, isScriptCommand } from "../src/core/hookRunner.js"
let baseContext: HookContext={
    items: [{format: "text", text: "sample"}],
    options: {format: "json"},
    metadata: {runId: "run-1"}
}
function createMockChildProcess(overrides?: {exitCode?: number|null, stdoutData?: Buffer|string, stderrData?: Buffer|string, delayMs?: number}): any{
    let child=new EventEmitter() as any
    child.stdout=new EventEmitter()
    child.stderr=new EventEmitter()
    child.stdin=new Writable({
        write(chunk, _encoding, callback){
            child.stdinChunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk as string, "utf-8"))
            if (callback){
                callback()
            }
        }
    })
    child.stdinChunks=[]
    child.kill=vi.fn()
    process.nextTick(()=>{
        if (overrides?.delayMs){
            setTimeout(()=>{
                if (overrides.stdoutData!==undefined){
                    child.stdout.emit("data", Buffer.isBuffer(overrides.stdoutData)?overrides.stdoutData:Buffer.from(overrides.stdoutData, "utf-8"))
                }
                if (overrides.stderrData!==undefined){
                    child.stderr.emit("data", Buffer.isBuffer(overrides.stderrData)?overrides.stderrData:Buffer.from(overrides.stderrData, "utf-8"))
                }
                child.emit("close", overrides.exitCode??0, null)
            }, overrides.delayMs)
        }
        else{
            if (overrides?.stdoutData!==undefined){
                child.stdout.emit("data", Buffer.isBuffer(overrides.stdoutData)?overrides.stdoutData:Buffer.from(overrides.stdoutData, "utf-8"))
            }
            if (overrides?.stderrData!==undefined){
                child.stderr.emit("data", Buffer.isBuffer(overrides.stderrData)?overrides.stderrData:Buffer.from(overrides.stderrData, "utf-8"))
            }
            child.emit("close", overrides?.exitCode??0, null)
        }
    })
    return child
}
function createHangingMockChildProcess(): any{
    let child=new EventEmitter() as any
    child.stdout=new EventEmitter()
    child.stderr=new EventEmitter()
    child.stdin=new Writable({
        write(chunk, _encoding, callback){
            child.stdinChunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk as string, "utf-8"))
            if (callback){
                callback()
            }
        }
    })
    child.stdinChunks=[]
    child.kill=vi.fn(()=>{
        child.emit("close", null, "SIGTERM")
    })
    return child
}
describe("HookRunner", ()=>{
    it("runPreHooks runs all pre hooks", async()=>{
        let spawn=vi.fn()
        let runner=new HookRunner({spawn: spawn})
        let calls=0
        spawn.mockImplementation(()=>{
            calls++
            return createMockChildProcess({exitCode: 0, stdoutData: "out"+calls})
        })
        let results=await runner.runPreHooks(baseContext, {pre: ["echo 1", "echo 2"]})
        expect(results.length).toBe(2)
        expect(results[0].command).toBe("echo 1")
        expect(results[0].stdout).toBe("out1")
        expect(results[1].command).toBe("echo 2")
        expect(results[1].stdout).toBe("out2")
    })
    it("runPostHooks runs all post hooks", async()=>{
        let spawn=vi.fn()
        let runner=new HookRunner({spawn: spawn})
        spawn.mockImplementation((cmd: string)=>createMockChildProcess({exitCode: 0, stdoutData: "post-"+cmd}))
        let results=await runner.runPostHooks(baseContext, {post: ["echo post"]})
        expect(results.length).toBe(1)
        expect(results[0].command).toBe("echo post")
        expect(results[0].stdout).toBe("post-echo post")
    })
    it("shell command receives env vars", async()=>{
        let spawn=vi.fn()
        let runner=new HookRunner({spawn: spawn})
        spawn.mockReturnValue(createMockChildProcess({exitCode: 0}))
        await runner.runHook("echo hello", baseContext, {stage: "pre"})
        let opts=spawn.mock.calls[0][2]
        expect(opts.env).toMatchObject(buildHookEnv(baseContext, "pre"))
        expect(opts.env.TG_STAGE).toBe("pre")
        expect(opts.env.TG_ITEM_COUNT).toBe("1")
        expect(opts.env.TG_OPTIONS).toBe(JSON.stringify(baseContext.options))
    })
    it("shell command receives stdin JSON", async()=>{
        let spawn=vi.fn()
        let runner=new HookRunner({spawn: spawn})
        let child=createMockChildProcess({exitCode: 0})
        spawn.mockReturnValue(child)
        await runner.runHook("cat", baseContext, {stage: "pre"})
        let stdin=Buffer.concat(child.stdinChunks).toString("utf-8")
        expect(JSON.parse(stdin)).toEqual(baseContext)
    })
    it("JS hook executed when allowScripts true", async()=>{
        let defaultFn=vi.fn().mockResolvedValue({items: baseContext.items, options: baseContext.options, metadata: {processed: true}})
        let requireScript=vi.fn().mockReturnValue({default: defaultFn})
        let runner=new HookRunner({requireScript: requireScript})
        let result=await runner.runHook("hook.js", baseContext, {stage: "pre", allowScripts: true})
        expect(requireScript).toHaveBeenCalledWith("hook.js")
        expect(defaultFn).toHaveBeenCalledWith(baseContext)
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toBe(JSON.stringify({items: baseContext.items, options: baseContext.options, metadata: {processed: true}}))
    })
    it("JS hook not executed when allowScripts false", async()=>{
        let spawn=vi.fn()
        let requireScript=vi.fn()
        let runner=new HookRunner({spawn: spawn, requireScript: requireScript})
        spawn.mockReturnValue(createMockChildProcess({exitCode: 0}))
        await runner.runHook("hook.js", baseContext, {stage: "pre", allowScripts: false})
        expect(requireScript).not.toHaveBeenCalled()
        expect(spawn).toHaveBeenCalledWith("hook.js", [], expect.any(Object))
    })
    it("timeout kills long hook", async()=>{
        let spawn=vi.fn()
        let runner=new HookRunner({spawn: spawn})
        spawn.mockReturnValue(createHangingMockChildProcess())
        await expect(runner.runHook("sleep 10", baseContext, {stage: "pre", timeoutMs: 50})).rejects.toThrow("timed out")
    })
    it("non-zero exit throws", async()=>{
        let spawn=vi.fn()
        let runner=new HookRunner({spawn: spawn})
        spawn.mockReturnValue(createMockChildProcess({exitCode: 1, stderrData: "error output"}))
        await expect(runner.runHook("bad", baseContext, {stage: "pre"})).rejects.toThrow("failed with exit code 1")
    })
    it("empty config returns empty results", async()=>{
        let runner=new HookRunner({})
        let pre=await runner.runPreHooks(baseContext, {})
        let post=await runner.runPostHooks(baseContext, {})
        expect(pre).toEqual([])
        expect(post).toEqual([])
    })
    it("hook result contains stdout/stderr", async()=>{
        let spawn=vi.fn()
        let runner=new HookRunner({spawn: spawn})
        spawn.mockReturnValue(createMockChildProcess({exitCode: 0, stdoutData: "standard out", stderrData: "standard err"}))
        let result=await runner.runHook("cmd", baseContext, {stage: "pre"})
        expect(result.stdout).toBe("standard out")
        expect(result.stderr).toBe("standard err")
    })
    it("buildHookEnv returns stage item count and options JSON", ()=>{
        let env=buildHookEnv(baseContext, "post")
        expect(env.TG_STAGE).toBe("post")
        expect(env.TG_ITEM_COUNT).toBe(String(baseContext.items.length))
        expect(env.TG_OPTIONS).toBe(JSON.stringify(baseContext.options))
    })
    it("isScriptCommand true for js false otherwise", ()=>{
        expect(isScriptCommand("hook.js")).toBe(true)
        expect(isScriptCommand("hook.ts")).toBe(false)
        expect(isScriptCommand("echo hello")).toBe(false)
    })
    it("runPreHooks preserves hook order", async()=>{
        let spawn=vi.fn()
        let runner=new HookRunner({spawn: spawn})
        spawn.mockImplementation((cmd: string)=>createMockChildProcess({exitCode: 0, stdoutData: cmd}))
        let results=await runner.runPreHooks(baseContext, {pre: ["a", "b", "c"]})
        expect(results.map(r=>r.command)).toEqual(["a", "b", "c"])
    })
    it("runPostHooks passes exportResult in stdin", async()=>{
        let spawn=vi.fn()
        let runner=new HookRunner({spawn: spawn})
        let child=createMockChildProcess({exitCode: 0})
        spawn.mockReturnValue(child)
        let ctx: HookContext={...baseContext, exportResult: "exported data"}
        await runner.runPostHooks(ctx, {post: ["cat"]})
        let stdin=Buffer.concat(child.stdinChunks).toString("utf-8")
        expect(JSON.parse(stdin).exportResult).toBe("exported data")
    })
    it("JS hook synchronous default works", async()=>{
        let defaultFn=vi.fn().mockReturnValue({...baseContext, metadata: {sync: true}})
        let requireScript=vi.fn().mockReturnValue({default: defaultFn})
        let runner=new HookRunner({requireScript: requireScript})
        let result=await runner.runHook("sync.js", baseContext, {stage: "pre", allowScripts: true})
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toBe(JSON.stringify({...baseContext, metadata: {sync: true}}))
    })
    it("JS hook missing default throws", async()=>{
        let requireScript=vi.fn().mockReturnValue({})
        let runner=new HookRunner({requireScript: requireScript})
        await expect(runner.runHook("bad.js", baseContext, {stage: "pre", allowScripts: true})).rejects.toThrow("does not export a default function")
    })
    it("JS hook default rejects propagates", async()=>{
        let defaultFn=vi.fn().mockRejectedValue(new Error("script error"))
        let requireScript=vi.fn().mockReturnValue({default: defaultFn})
        let runner=new HookRunner({requireScript: requireScript})
        await expect(runner.runHook("fail.js", baseContext, {stage: "pre", allowScripts: true})).rejects.toThrow("script error")
    })
    it("shell command error event rejects", async()=>{
        let spawn=vi.fn()
        let runner=new HookRunner({spawn: spawn})
        let child=createHangingMockChildProcess()
        spawn.mockReturnValue(child)
        process.nextTick(()=>child.emit("error", new Error("spawn failed")))
        await expect(runner.runHook("cmd", baseContext, {stage: "pre"})).rejects.toThrow("spawn failed")
    })
    it("timeout calls kill on child", async()=>{
        let spawn=vi.fn()
        let runner=new HookRunner({spawn: spawn})
        let child=createHangingMockChildProcess()
        spawn.mockReturnValue(child)
        await expect(runner.runHook("sleep", baseContext, {stage: "pre", timeoutMs: 30})).rejects.toThrow("timed out")
        expect(child.kill).toHaveBeenCalled()
    })
    it("runHook defaults stage to pre", async()=>{
        let spawn=vi.fn()
        let runner=new HookRunner({spawn: spawn})
        spawn.mockReturnValue(createMockChildProcess({exitCode: 0}))
        await runner.runHook("cmd", baseContext)
        let opts=spawn.mock.calls[0][2]
        expect(opts.env.TG_STAGE).toBe("pre")
    })
    it("runPostHooks sets TG_STAGE to post", async()=>{
        let spawn=vi.fn()
        let runner=new HookRunner({spawn: spawn})
        spawn.mockReturnValue(createMockChildProcess({exitCode: 0}))
        await runner.runPostHooks(baseContext, {post: ["cmd"]})
        let opts=spawn.mock.calls[0][2]
        expect(opts.env.TG_STAGE).toBe("post")
    })
    it("durationMs is measured", async()=>{
        let spawn=vi.fn()
        let runner=new HookRunner({spawn: spawn})
        spawn.mockReturnValue(createMockChildProcess({exitCode: 0, delayMs: 30}))
        let result=await runner.runHook("cmd", baseContext, {stage: "pre"})
        expect(result.durationMs).toBeGreaterThanOrEqual(25)
    })
})
