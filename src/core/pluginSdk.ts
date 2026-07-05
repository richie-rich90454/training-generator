import type { TrainingItem } from "../types/index.js";
import type { Validator } from "../renderer/validatorFramework.js";
import type { Exporter } from "../renderer/exportFormats.js";
import type { ProviderManager } from "../renderer/provider.js";
export type PluginPermission="filesystem"|"network"|"settings"|"providers"|"clipboard";
export interface PluginManifest{
    name: string;
    version: string;
    main: string;
    permissions: PluginPermission[];
    hooks?: {pre?: string[]; post?: string[]};
    description?: string;
    author?: string;
}
export interface LoadedPlugin{
    manifest: PluginManifest;
    path: string;
    api: PluginApi;
}
export interface PluginApi{
    registerProcessor: (name: string, processor: (items: TrainingItem[])=>Promise<TrainingItem[]>|TrainingItem[])=>void;
    registerValidator: (validator: Validator)=>void;
    registerExporter: (exporter: Exporter)=>void;
    registerProvider: (provider: ProviderManager)=>void;
    log: (message: string)=>void;
}
type Processor=(items: TrainingItem[])=>Promise<TrainingItem[]>|TrainingItem[];
export function createPluginApi(): PluginApi{
    let processors: Record<string, Processor>={};
    let validators: Validator[]=[];
    let exporters: Exporter[]=[];
    let providers: ProviderManager[]=[];
    let logs: string[]=[];
    return {
        registerProcessor(name: string, processor: Processor): void{
            processors[name]=processor;
        },
        registerValidator(validator: Validator): void{
            validators.push(validator);
        },
        registerExporter(exporter: Exporter): void{
            exporters.push(exporter);
        },
        registerProvider(provider: ProviderManager): void{
            providers.push(provider);
        },
        log(message: string): void{
            logs.push(message);
        },
        getProcessor(name: string): Processor|undefined{
            return processors[name];
        },
        getValidators(): Validator[]{
            return validators;
        },
        getExporters(): Exporter[]{
            return exporters;
        },
        getProviders(): ProviderManager[]{
            return providers;
        },
        getLogs(): string[]{
            return logs;
        }
    } as PluginApi;
}
export interface PluginLoaderOptions{
    pluginPaths?: string[];
    readFile?: (path: string)=>string;
    requirePlugin?: (path: string)=>unknown;
}
export class PluginLoader{
    private pluginPaths: string[];
    private readFile: (path: string)=>string;
    private requirePlugin: (path: string)=>unknown;
    private loadedPlugins: LoadedPlugin[]=[];
    constructor(options?: PluginLoaderOptions){
        this.pluginPaths=options?.pluginPaths??[];
        this.readFile=options?.readFile??((path: string)=>{throw new Error(`readFile not provided: ${path}`)});
        this.requirePlugin=options?.requirePlugin??((path: string)=>{throw new Error(`requirePlugin not provided: ${path}`)});
    }
    scan(): PluginManifest[]{
        let manifests: PluginManifest[]=[];
        for(let pluginPath of this.pluginPaths){
            let manifestPath=this.resolvePath(pluginPath, "manifest.json");
            try{
                let content=this.readFile(manifestPath);
                let parsed=JSON.parse(content);
                let manifest=this.validateManifest(parsed);
                manifests.push(manifest);
            }
            catch{
                continue;
            }
        }
        return manifests;
    }
    load(manifestPath: string): LoadedPlugin{
        let content=this.readFile(manifestPath);
        let parsed=JSON.parse(content);
        let manifest=this.validateManifest(parsed);
        let dir=this.dirname(manifestPath);
        let mainPath=this.resolvePath(dir, manifest.main);
        let api=createPluginApi();
        let pluginModule=this.requirePlugin(mainPath);
        if(typeof pluginModule==="function"){
            (pluginModule as (api: PluginApi)=>void)(api);
        }
        else if(pluginModule && typeof pluginModule==="object" && "default" in pluginModule){
            let defaultExport=(pluginModule as {default: unknown}).default;
            if(typeof defaultExport==="function"){
                (defaultExport as (api: PluginApi)=>void)(api);
            }
        }
        let loaded: LoadedPlugin={manifest, path: mainPath, api};
        this.loadedPlugins.push(loaded);
        return loaded;
    }
    loadAll(): LoadedPlugin[]{
        let loaded: LoadedPlugin[]=[];
        for(let pluginPath of this.pluginPaths){
            let manifestPath=this.resolvePath(pluginPath, "manifest.json");
            try{
                loaded.push(this.load(manifestPath));
            }
            catch{
                continue;
            }
        }
        return loaded;
    }
    getLoadedPlugins(): LoadedPlugin[]{
        return this.loadedPlugins;
    }
    validateManifest(manifest: unknown): PluginManifest{
        if(!manifest || typeof manifest!=="object"){
            throw new Error("Manifest must be an object");
        }
        let m=manifest as Record<string, unknown>;
        if(typeof m.name!=="string"){
            throw new Error("Manifest missing required field: name");
        }
        if(typeof m.version!=="string"){
            throw new Error("Manifest missing required field: version");
        }
        if(typeof m.main!=="string"){
            throw new Error("Manifest missing required field: main");
        }
        if(!Array.isArray(m.permissions)){
            throw new Error("Manifest missing required field: permissions");
        }
        for(let permission of m.permissions){
            if(!this.isValidPermission(permission as string)){
                throw new Error(`Invalid permission: ${permission}`);
            }
        }
        return {
            name: m.name as string,
            version: m.version as string,
            main: m.main as string,
            permissions: m.permissions as PluginPermission[],
            hooks: m.hooks as {pre?: string[]; post?: string[]}|undefined,
            description: m.description as string|undefined,
            author: m.author as string|undefined
        };
    }
    private isValidPermission(permission: string): permission is PluginPermission{
        let validPermissions: PluginPermission[]=["filesystem", "network", "settings", "providers", "clipboard"];
        return validPermissions.includes(permission as PluginPermission);
    }
    private resolvePath(dir: string, file: string): string{
        let sep=dir.includes("\\")?"\\":"/";
        if(dir.endsWith(sep)){
            return dir+file;
        }
        return dir+sep+file;
    }
    private dirname(p: string): string{
        let idx=Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
        if(idx<0){
            return ".";
        }
        return p.slice(0, idx);
    }
}
