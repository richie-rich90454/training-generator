import { spawn as defaultSpawn, ChildProcess } from "child_process"
import { pathToFileURL } from "url"
import { TrainingItem } from "../types/interfaces.js"
export interface HookConfig{
    pre?: string[]
    post?: string[]
    allowScripts?: boolean
    timeoutMs?: number
}
export interface HookContext{
    items: TrainingItem[]
    options: Record<string, unknown>
    metadata: Record<string, unknown>
    exportResult?: string|Buffer
}
export interface HookResult{
    command: string
    exitCode: number
    stdout: string
    stderr: string
    durationMs: number
}
export interface HookRunnerOptions{
    spawn?: (command: string, args: string[], options: object)=>ChildProcess
    requireScript?: (path: string)=>{default?: (ctx: HookContext)=>Promise<HookContext>|HookContext}|Promise<{default?: (ctx: HookContext)=>Promise<HookContext>|HookContext}>
}
export class HookRunner{
    private spawn: (command: string, args: string[], options: object)=>ChildProcess
    private requireScript: (path: string)=>Promise<{default?: (ctx: HookContext)=>Promise<HookContext>|HookContext}>|{default?: (ctx: HookContext)=>Promise<HookContext>|HookContext}
    constructor(options: HookRunnerOptions={}){
        this.spawn=options.spawn??(defaultSpawn as unknown as (command: string, args: string[], options: object)=>ChildProcess)
        this.requireScript=options.requireScript??(async (path: string)=>{
            let mod=await import(pathToFileURL(path).href)
            return mod as {default?: (ctx: HookContext)=>Promise<HookContext>|HookContext}
        })
    }
    async runPreHooks(context: HookContext, config: HookConfig={}): Promise<HookResult[]>{
        let results: HookResult[]=[]
        if (!config.pre){
            return results
        }
        for (let command of config.pre){
            let result=await this.runHook(command, context, {stage: "pre", timeoutMs: config.timeoutMs, allowScripts: config.allowScripts})
            results.push(result)
        }
        return results
    }
    async runPostHooks(context: HookContext, config: HookConfig={}): Promise<HookResult[]>{
        let results: HookResult[]=[]
        if (!config.post){
            return results
        }
        for (let command of config.post){
            let result=await this.runHook(command, context, {stage: "post", timeoutMs: config.timeoutMs, allowScripts: config.allowScripts})
            results.push(result)
        }
        return results
    }
    async runHook(command: string, context: HookContext, options?: {timeoutMs?: number, stage: "pre"|"post", allowScripts?: boolean}): Promise<HookResult>{
        let stage=options?.stage??"pre"
        let timeoutMs=options?.timeoutMs
        let allowScripts=options?.allowScripts??false
        let start=Date.now()
        if (isScriptCommand(command)&&allowScripts){
            let module=await Promise.resolve(this.requireScript(command))
            let fn=module.default
            if (typeof fn!=="function"){
                throw new Error(`Script hook "${command}" does not export a default function`)
            }
            let result=await Promise.resolve(fn(context))
            let durationMs=Date.now()-start
            return {
                command: command,
                exitCode: 0,
                stdout: JSON.stringify(result),
                stderr: "",
                durationMs: durationMs
            }
        }
        return this.runShellHook(command, context, stage, timeoutMs, start)
    }
    private runShellHook(command: string, context: HookContext, stage: "pre"|"post", timeoutMs: number|undefined, start: number): Promise<HookResult>{
        return new Promise((resolve, reject)=>{
            let hookEnv=buildHookEnv(context, stage)
            let child=this.spawn(command, [], {
                shell: true,
                env: {...process.env, ...hookEnv},
                stdio: ["pipe", "pipe", "pipe"]
            })
            let stdoutChunks: Buffer[]=[]
            let stderrChunks: Buffer[]=[]
            let timer: NodeJS.Timeout|undefined
            let timedOut=false
            let stdinData=JSON.stringify(context)
            child.stdin?.write(stdinData, "utf-8", ()=>{
                child.stdin?.end()
            })
            child.stdout?.on("data", (chunk: unknown)=>{
                stdoutChunks.push(chunk as Buffer)
            })
            child.stderr?.on("data", (chunk: unknown)=>{
                stderrChunks.push(chunk as Buffer)
            })
            child.on("error", (error: Error)=>{
                if (timer){
                    clearTimeout(timer)
                }
                reject(error)
            })
            child.on("close", (code: number|null, signal: string|null)=>{
                if (timer){
                    clearTimeout(timer)
                }
                let durationMs=Date.now()-start
                let stdout=Buffer.concat(stdoutChunks).toString("utf-8")
                let stderr=Buffer.concat(stderrChunks).toString("utf-8")
                if (timedOut){
                    reject(new Error(`Hook "${command}" timed out after ${timeoutMs}ms`))
                    return
                }
                if (code!==0){
                    reject(new Error(`Hook "${command}" failed with exit code ${code??signal??"unknown"}: ${stderr||stdout}`))
                    return
                }
                resolve({
                    command: command,
                    exitCode: code??0,
                    stdout: stdout,
                    stderr: stderr,
                    durationMs: durationMs
                })
            })
            if (timeoutMs!==undefined&&timeoutMs>0){
                timer=setTimeout(()=>{
                    timedOut=true
                    child.kill()
                }, timeoutMs)
            }
        })
    }
}
export function buildHookEnv(context: HookContext, stage: string): Record<string, string>{
    return {
        TG_STAGE: stage,
        TG_ITEM_COUNT: String(context.items.length),
        TG_OPTIONS: JSON.stringify(context.options)
    }
}
export function isScriptCommand(command: string): boolean{
    return command.endsWith(".js")
}
