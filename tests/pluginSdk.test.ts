import { describe, it, expect, vi } from "vitest";
import { PluginLoader, createPluginApi } from "../src/core/pluginSdk.js";
import type { TrainingItem } from "../src/types/index.js";
import type { Validator } from "../src/renderer/validatorFramework.js";
import type { Exporter } from "../src/renderer/exportFormats.js";
import type { ProviderManager } from "../src/renderer/provider.js";
function createValidManifest(): {name: string; version: string; main: string; permissions: string[]}{
    return {name: "test-plugin", version: "1.0.0", main: "index.js", permissions: ["filesystem"]};
}
describe("pluginSdk", ()=>{
    describe("validateManifest", ()=>{
        it("accepts valid manifest", ()=>{
            let loader=new PluginLoader();
            let manifest=loader.validateManifest(createValidManifest());
            expect(manifest.name).toBe("test-plugin");
            expect(manifest.version).toBe("1.0.0");
            expect(manifest.main).toBe("index.js");
            expect(manifest.permissions).toEqual(["filesystem"]);
        });
        it("rejects missing name", ()=>{
            let loader=new PluginLoader();
            let data={version: "1.0.0", main: "index.js", permissions: []};
            expect(()=>loader.validateManifest(data)).toThrow("name");
        });
        it("rejects missing version", ()=>{
            let loader=new PluginLoader();
            let data={name: "test", main: "index.js", permissions: []};
            expect(()=>loader.validateManifest(data)).toThrow("version");
        });
        it("rejects missing main", ()=>{
            let loader=new PluginLoader();
            let data={name: "test", version: "1.0.0", permissions: []};
            expect(()=>loader.validateManifest(data)).toThrow("main");
        });
        it("rejects missing permissions", ()=>{
            let loader=new PluginLoader();
            let data={name: "test", version: "1.0.0", main: "index.js"};
            expect(()=>loader.validateManifest(data)).toThrow("permissions");
        });
        it("rejects invalid permission", ()=>{
            let loader=new PluginLoader();
            let data={name: "test", version: "1.0.0", main: "index.js", permissions: ["invalid"]};
            expect(()=>loader.validateManifest(data)).toThrow("Invalid permission");
        });
        it("throws on non-object", ()=>{
            let loader=new PluginLoader();
            expect(()=>loader.validateManifest(null)).toThrow("object");
            expect(()=>loader.validateManifest("string")).toThrow("object");
        });
    });
    describe("scan", ()=>{
        it("finds manifest.json files", ()=>{
            let manifest=createValidManifest();
            let readFile=vi.fn((path: string)=>{
                if(path==="/plugins/foo/manifest.json") return JSON.stringify(manifest);
                throw new Error("not found");
            });
            let loader=new PluginLoader({pluginPaths: ["/plugins/foo"], readFile});
            let result=loader.scan();
            expect(result.length).toBe(1);
            expect(result[0].name).toBe("test-plugin");
        });
        it("skips paths with missing manifest", ()=>{
            let readFile=()=>{throw new Error("not found")};
            let loader=new PluginLoader({pluginPaths: ["/plugins/missing"], readFile});
            expect(loader.scan().length).toBe(0);
        });
        it("validates manifest before returning", ()=>{
            let readFile=()=>JSON.stringify({name: "test"});
            let loader=new PluginLoader({pluginPaths: ["/plugins/bad"], readFile});
            expect(loader.scan().length).toBe(0);
        });
    });
    describe("load", ()=>{
        it("reads manifest and invokes plugin", ()=>{
            let pluginFn=vi.fn();
            let manifest=createValidManifest();
            let readFile=vi.fn((path: string)=>{
                if(path==="/plugins/foo/manifest.json") return JSON.stringify(manifest);
                throw new Error("not found");
            });
            let requirePlugin=vi.fn((path: string)=>{
                if(path==="/plugins/foo/index.js") return pluginFn;
                throw new Error("not found");
            });
            let loader=new PluginLoader({readFile, requirePlugin});
            let loaded=loader.load("/plugins/foo/manifest.json");
            expect(loaded.manifest.name).toBe("test-plugin");
            expect(loaded.path).toBe("/plugins/foo/index.js");
            expect(pluginFn).toHaveBeenCalledWith(loaded.api);
        });
        it("handles default export", ()=>{
            let pluginFn=vi.fn();
            let manifest=createValidManifest();
            let loader=new PluginLoader({
                readFile: ()=>JSON.stringify(manifest),
                requirePlugin: ()=>({default: pluginFn})
            });
            loader.load("/plugins/foo/manifest.json");
            expect(pluginFn).toHaveBeenCalled();
        });
        it("manifest path resolved correctly", ()=>{
            let manifest={name: "test", version: "1.0.0", main: "src/main.js", permissions: []};
            let readFile=(path: string)=>JSON.stringify(manifest);
            let requirePlugin=vi.fn();
            let loader=new PluginLoader({readFile, requirePlugin});
            let loaded=loader.load("/plugins/bar/manifest.json");
            expect(loaded.path).toBe("/plugins/bar/src/main.js");
            expect(requirePlugin).toHaveBeenCalledWith("/plugins/bar/src/main.js");
        });
        it("plugin receives log function", ()=>{
            let receivedApi: unknown=null;
            let pluginFn=(api: unknown)=>{receivedApi=api};
            let manifest=createValidManifest();
            let loader=new PluginLoader({
                readFile: ()=>JSON.stringify(manifest),
                requirePlugin: ()=>pluginFn
            });
            loader.load("/plugins/foo/manifest.json");
            expect(receivedApi).not.toBeNull();
            expect(typeof (receivedApi as {log?: unknown}).log).toBe("function");
        });
    });
    describe("loadAll", ()=>{
        it("loads multiple plugins", ()=>{
            let manifest1={name: "p1", version: "1.0.0", main: "index.js", permissions: []};
            let manifest2={name: "p2", version: "1.0.0", main: "main.js", permissions: []};
            let files: Record<string, string>={
                "/plugins/p1/manifest.json": JSON.stringify(manifest1),
                "/plugins/p2/manifest.json": JSON.stringify(manifest2)
            };
            let readFile=(path: string)=>{
                let content=files[path];
                if(content===undefined) throw new Error("not found");
                return content;
            };
            let requirePlugin=vi.fn();
            let loader=new PluginLoader({pluginPaths: ["/plugins/p1", "/plugins/p2"], readFile, requirePlugin});
            let loaded=loader.loadAll();
            expect(loaded.length).toBe(2);
            expect(loaded[0].manifest.name).toBe("p1");
            expect(loaded[1].manifest.name).toBe("p2");
        });
        it("skips invalid manifests", ()=>{
            let manifest={name: "p1", version: "1.0.0", main: "index.js", permissions: []};
            let files: Record<string, string>={
                "/plugins/p1/manifest.json": JSON.stringify(manifest),
                "/plugins/p2/manifest.json": JSON.stringify({name: "bad"})
            };
            let readFile=(path: string)=>{
                let content=files[path];
                if(content===undefined) throw new Error("not found");
                return content;
            };
            let loader=new PluginLoader({pluginPaths: ["/plugins/p1", "/plugins/p2"], readFile, requirePlugin: vi.fn()});
            let loaded=loader.loadAll();
            expect(loaded.length).toBe(1);
            expect(loaded[0].manifest.name).toBe("p1");
        });
    });
    describe("createPluginApi", ()=>{
        it("registerProcessor stores processor", ()=>{
            let api=createPluginApi();
            let processor=(items: TrainingItem[])=>items;
            api.registerProcessor("p", processor);
            expect((api as unknown as {getProcessor: (name: string)=>(items: TrainingItem[])=>TrainingItem[]|undefined}).getProcessor("p")).toBe(processor);
        });
        it("registerValidator stores validator", ()=>{
            let api=createPluginApi();
            let validator={name: "v", enabled: true, threshold: 0.5, validate: (item: TrainingItem)=>({score: 1, passed: true, details: [], flags: []})} as Validator;
            api.registerValidator(validator);
            expect((api as unknown as {getValidators: ()=>Validator[]}).getValidators()).toContain(validator);
        });
        it("registerExporter stores exporter", ()=>{
            let api=createPluginApi();
            let exporter={name: "e", mimeType: "text/plain", extension: ".txt", export: (items: TrainingItem[])=>""} as Exporter;
            api.registerExporter(exporter);
            expect((api as unknown as {getExporters: ()=>Exporter[]}).getExporters()).toContain(exporter);
        });
        it("registerProvider stores provider", ()=>{
            let api=createPluginApi();
            let provider={name: "mock", generate: vi.fn()} as unknown as ProviderManager;
            api.registerProvider(provider);
            expect((api as unknown as {getProviders: ()=>ProviderManager[]}).getProviders()).toContain(provider);
        });
        it("log stores message", ()=>{
            let api=createPluginApi();
            api.log("hello");
            api.log("world");
            expect((api as unknown as {getLogs: ()=>string[]}).getLogs()).toEqual(["hello", "world"]);
        });
    });
    describe("getLoadedPlugins", ()=>{
        it("returns loaded plugins", ()=>{
            let manifest=createValidManifest();
            let loader=new PluginLoader({readFile: ()=>JSON.stringify(manifest), requirePlugin: vi.fn()});
            loader.load("/plugins/foo/manifest.json");
            let loaded=loader.getLoadedPlugins();
            expect(loaded.length).toBe(1);
            expect(loaded[0].manifest.name).toBe("test-plugin");
        });
    });
});
