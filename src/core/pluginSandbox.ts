import * as vm from "node:vm";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { PluginPermission, PluginApi } from "./pluginSdk.js";
import type { TrainingItem } from "../types/index.js";
import type { Validator } from "../renderer/validatorFramework.js";
import type { Exporter } from "../renderer/exportFormats.js";
import type { ProviderManager } from "../renderer/provider.js";
export interface SandboxedPluginApi{
    registerProcessor: (name: string, processor: (items: TrainingItem[])=>Promise<TrainingItem[]>|TrainingItem[])=>void;
    registerValidator: (validator: Validator)=>void;
    registerExporter: (exporter: Exporter)=>void;
    registerProvider: (provider: ProviderManager)=>void;
    log: (message: string)=>void;
    fs: {readFile: (path: string)=>Promise<string>; writeFile: (path: string, content: string)=>Promise<void>}|undefined;
    fetch: ((url: string, options?: object)=>Promise<Response>)|undefined;
    settings: {get: (key: string)=>unknown; set: (key: string, value: unknown)=>void}|undefined;
}
export class PluginSandbox{
    private pluginCode: string;
    private permissions: PluginPermission[];
    private api: PluginApi;
    private allowedFsPaths: string[];
    constructor(options: {pluginCode: string; permissions: PluginPermission[]; api: PluginApi; allowedFsPaths?: string[]}){
        this.pluginCode=options.pluginCode;
        this.permissions=options.permissions;
        this.api=options.api;
        this.allowedFsPaths=options.allowedFsPaths??[];
    }
    async execute(): Promise<void>{
        let context=createSandboxContext(this.permissions, this.api, this.allowedFsPaths);
        try{
            await vm.runInNewContext(this.pluginCode, context, {timeout: 5000});
        }
        catch(err){
            let message=err instanceof Error?err.message:String(err);
            throw new Error("Sandboxed plugin error: "+message);
        }
    }
}
export function createSandboxContext(permissions: PluginPermission[], api: PluginApi, allowedFsPaths: string[]): object{
    let sandbox: Record<string, unknown>={
        console: {
            log: (...args: unknown[])=>api.log(args.map((a)=>String(a)).join(" ")),
            error: (...args: unknown[])=>api.log("ERROR: "+args.map((a)=>String(a)).join(" ")),
            warn: (...args: unknown[])=>api.log("WARN: "+args.map((a)=>String(a)).join(" "))
        },
        setTimeout: setTimeout,
        setInterval: setInterval,
        clearTimeout: clearTimeout,
        clearInterval: clearInterval,
        Buffer: Buffer,
        pluginApi: createSandboxedApi(permissions, api, allowedFsPaths)
    };
    return sandbox;
}
function createSandboxedApi(permissions: PluginPermission[], api: PluginApi, allowedFsPaths: string[]): SandboxedPluginApi{
    let has=(p: PluginPermission)=>permissions.includes(p);
    let settingsStore: Record<string, unknown>={};
    return {
        registerProcessor: api.registerProcessor.bind(api),
        registerValidator: api.registerValidator.bind(api),
        registerExporter: api.registerExporter.bind(api),
        registerProvider: has("providers")?api.registerProvider.bind(api):()=>{throw new Error("Missing permission: providers");},
        log: api.log.bind(api),
        fs: has("filesystem")?createFsWrapper(allowedFsPaths):undefined,
        fetch: wrapFetch(permissions),
        settings: has("settings")?{
            get(key: string): unknown{
                return settingsStore[key];
            },
            set(key: string, value: unknown): void{
                settingsStore[key]=value;
            }
        }:undefined
    };
}
function createFsWrapper(allowedPaths: string[]): {readFile: (path: string)=>Promise<string>; writeFile: (path: string, content: string)=>Promise<void>}{
    return {
        async readFile(filePath: string): Promise<string>{
            if(!validateFsPath(filePath, allowedPaths)){
                throw new Error("Path not allowed: "+filePath);
            }
            return fs.readFile(filePath, "utf-8");
        },
        async writeFile(filePath: string, content: string): Promise<void>{
            if(!validateFsPath(filePath, allowedPaths)){
                throw new Error("Path not allowed: "+filePath);
            }
            return fs.writeFile(filePath, content, "utf-8");
        }
    };
}
export function validateFsPath(filePath: string, allowedPaths: string[]): boolean{
    let resolved=path.resolve(filePath);
    for(let allowed of allowedPaths){
        let allowedResolved=path.resolve(allowed);
        if(resolved===allowedResolved || resolved.startsWith(allowedResolved+path.sep)){
            return true;
        }
    }
    return false;
}
export function wrapFetch(permissions: PluginPermission[]): typeof fetch|undefined{
    if(permissions.includes("network")){
        return fetch;
    }
    return undefined;
}
