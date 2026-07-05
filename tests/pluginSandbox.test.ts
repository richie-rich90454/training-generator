import { describe, it, expect, vi } from "vitest";
import { PluginSandbox, createSandboxContext, validateFsPath, wrapFetch } from "../src/core/pluginSandbox.js";
import { createPluginApi } from "../src/core/pluginSdk.js";
import type { TrainingItem } from "../src/types/index.js";
import * as fs from "node:fs/promises";
vi.mock("node:vm", ()=>({
    runInNewContext: vi.fn((code: string, context: Record<string, unknown>)=>{
        let AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
        let keys=Object.keys(context);
        let values=keys.map((key)=>context[key]);
        let fn=new AsyncFunction(...keys, code);
        return fn(...values);
    })
}));
vi.mock("node:fs/promises", ()=>({
    readFile: vi.fn(),
    writeFile: vi.fn()
}));
function getLogs(api: unknown): string[]{
    return (api as {getLogs: ()=>string[]}).getLogs();
}
function getProcessor(api: unknown, name: string): ((items: TrainingItem[])=>TrainingItem[]|Promise<TrainingItem[]>)|undefined{
    return (api as {getProcessor: (name: string)=>((items: TrainingItem[])=>TrainingItem[]|Promise<TrainingItem[]>)|undefined}).getProcessor(name);
}
function getValidators(api: unknown): unknown[]{
    return (api as {getValidators: ()=>unknown[]}).getValidators();
}
function getExporters(api: unknown): unknown[]{
    return (api as {getExporters: ()=>unknown[]}).getExporters();
}
function getProviders(api: unknown): unknown[]{
    return (api as {getProviders: ()=>unknown[]}).getProviders();
}
describe("PluginSandbox", ()=>{
    it("executes plugin code", async ()=>{
        let api=createPluginApi();
        let sandbox=new PluginSandbox({pluginCode: "pluginApi.log('executed');", permissions: [], api});
        await sandbox.execute();
        expect(getLogs(api)).toContain("executed");
    });
    it("exposes log API", async ()=>{
        let api=createPluginApi();
        let sandbox=new PluginSandbox({pluginCode: "pluginApi.log('hello'); pluginApi.log('world');", permissions: [], api});
        await sandbox.execute();
        expect(getLogs(api)).toEqual(["hello", "world"]);
    });
    it("exposes registerProcessor", async ()=>{
        let api=createPluginApi();
        let sandbox=new PluginSandbox({pluginCode: "pluginApi.registerProcessor('p', (items)=>items);", permissions: [], api});
        await sandbox.execute();
        expect(getProcessor(api, "p")).toBeDefined();
    });
    it("exposes registerValidator", async ()=>{
        let api=createPluginApi();
        let sandbox=new PluginSandbox({pluginCode: "pluginApi.registerValidator({name: 'v'});", permissions: [], api});
        await sandbox.execute();
        expect(getValidators(api).length).toBe(1);
        expect((getValidators(api)[0] as {name: string}).name).toBe("v");
    });
    it("exposes registerExporter", async ()=>{
        let api=createPluginApi();
        let sandbox=new PluginSandbox({pluginCode: "pluginApi.registerExporter({name: 'e'});", permissions: [], api});
        await sandbox.execute();
        expect(getExporters(api).length).toBe(1);
        expect((getExporters(api)[0] as {name: string}).name).toBe("e");
    });
    it("filesystem permission grants readFile", async ()=>{
        let api=createPluginApi();
        vi.mocked(fs.readFile).mockResolvedValueOnce("hello");
        let sandbox=new PluginSandbox({pluginCode: "let content=await pluginApi.fs.readFile('/tmp/test.txt'); pluginApi.log(content);", permissions: ["filesystem"], api, allowedFsPaths: ["/tmp"]});
        await sandbox.execute();
        expect(getLogs(api)).toContain("hello");
        expect(fs.readFile).toHaveBeenCalledWith("/tmp/test.txt", "utf-8");
    });
    it("filesystem permission grants writeFile within allowed paths", async ()=>{
        let api=createPluginApi();
        vi.mocked(fs.writeFile).mockResolvedValueOnce(undefined);
        let sandbox=new PluginSandbox({pluginCode: "await pluginApi.fs.writeFile('/tmp/test.txt', 'data');", permissions: ["filesystem"], api, allowedFsPaths: ["/tmp"]});
        await sandbox.execute();
        expect(fs.writeFile).toHaveBeenCalledWith("/tmp/test.txt", "data", "utf-8");
    });
    it("filesystem permission denies readFile outside allowed paths", async ()=>{
        let api=createPluginApi();
        let sandbox=new PluginSandbox({pluginCode: "await pluginApi.fs.readFile('/etc/passwd');", permissions: ["filesystem"], api, allowedFsPaths: ["/tmp"]});
        await expect(sandbox.execute()).rejects.toThrow("Sandboxed plugin error: Path not allowed: /etc/passwd");
    });
    it("filesystem permission denies writeFile outside allowed paths", async ()=>{
        let api=createPluginApi();
        let sandbox=new PluginSandbox({pluginCode: "await pluginApi.fs.writeFile('/etc/passwd', 'x');", permissions: ["filesystem"], api, allowedFsPaths: ["/tmp"]});
        await expect(sandbox.execute()).rejects.toThrow("Sandboxed plugin error: Path not allowed: /etc/passwd");
    });
    it("network permission grants fetch", async ()=>{
        let api=createPluginApi();
        global.fetch=vi.fn(()=>Promise.resolve(new Response("ok", {status: 200}))) as unknown as typeof fetch;
        let sandbox=new PluginSandbox({pluginCode: "let res=await pluginApi.fetch('http://example.com'); pluginApi.log(String(res.status));", permissions: ["network"], api});
        await sandbox.execute();
        expect(getLogs(api)).toContain("200");
    });
    it("settings permission grants get and set", async ()=>{
        let api=createPluginApi();
        let sandbox=new PluginSandbox({pluginCode: "pluginApi.settings.set('k', 'v'); pluginApi.log(String(pluginApi.settings.get('k')));", permissions: ["settings"], api});
        await sandbox.execute();
        expect(getLogs(api)).toContain("v");
    });
    it("missing filesystem permission blocks fs access", ()=>{
        let api=createPluginApi();
        let context=createSandboxContext([], api, []);
        expect((context as {pluginApi?: {fs?: unknown}}).pluginApi?.fs).toBeUndefined();
    });
    it("missing network permission blocks fetch", ()=>{
        let api=createPluginApi();
        let context=createSandboxContext([], api, []);
        expect((context as {pluginApi?: {fetch?: unknown}}).pluginApi?.fetch).toBeUndefined();
    });
    it("missing settings permission blocks settings", ()=>{
        let api=createPluginApi();
        let context=createSandboxContext([], api, []);
        expect((context as {pluginApi?: {settings?: unknown}}).pluginApi?.settings).toBeUndefined();
    });
    it("providers permission allows registerProvider", async ()=>{
        let api=createPluginApi();
        let sandbox=new PluginSandbox({pluginCode: "pluginApi.registerProvider({name: 'mock'});", permissions: ["providers"], api});
        await sandbox.execute();
        expect(getProviders(api).length).toBe(1);
        expect((getProviders(api)[0] as {name: string}).name).toBe("mock");
    });
    it("missing providers permission throws", async ()=>{
        let api=createPluginApi();
        let sandbox=new PluginSandbox({pluginCode: "pluginApi.registerProvider({name: 'p'});", permissions: [], api});
        await expect(sandbox.execute()).rejects.toThrow("Sandboxed plugin error: Missing permission: providers");
    });
    it("sandbox catches plugin errors", async ()=>{
        let api=createPluginApi();
        let sandbox=new PluginSandbox({pluginCode: "throw new Error('boom');", permissions: [], api});
        await expect(sandbox.execute()).rejects.toThrow("Sandboxed plugin error: boom");
    });
    it("allowedFsPaths are enforced", async ()=>{
        let api=createPluginApi();
        let sandbox=new PluginSandbox({pluginCode: "await pluginApi.fs.writeFile('/outside/file.txt', 'x');", permissions: ["filesystem"], api, allowedFsPaths: ["/tmp", "/home/user"]});
        await expect(sandbox.execute()).rejects.toThrow("Sandboxed plugin error: Path not allowed: /outside/file.txt");
    });
});
describe("createSandboxContext", ()=>{
    it("includes console and timers", ()=>{
        let api=createPluginApi();
        let context=createSandboxContext([], api, []);
        expect(typeof (context as {console?: {log?: unknown}}).console?.log).toBe("function");
        expect(typeof (context as {setTimeout?: unknown}).setTimeout).toBe("function");
        expect(typeof (context as {setInterval?: unknown}).setInterval).toBe("function");
        expect(typeof (context as {Buffer?: unknown}).Buffer).toBe("function");
    });
    it("console.log routes to api.log", async ()=>{
        let api=createPluginApi();
        let sandbox=new PluginSandbox({pluginCode: "console.log('via console');", permissions: [], api});
        await sandbox.execute();
        expect(getLogs(api)).toContain("via console");
    });
});
describe("validateFsPath", ()=>{
    it("allows exact match", ()=>{
        expect(validateFsPath("/tmp", ["/tmp"])).toBe(true);
    });
    it("allows nested path", ()=>{
        expect(validateFsPath("/tmp/a/b", ["/tmp"])).toBe(true);
    });
    it("denies path outside allowed", ()=>{
        expect(validateFsPath("/etc/passwd", ["/tmp"])).toBe(false);
    });
    it("denies prefix attack", ()=>{
        expect(validateFsPath("/tmpmalicious", ["/tmp"])).toBe(false);
    });
    it("denies traversal outside allowed", ()=>{
        expect(validateFsPath("/tmp/../etc/passwd", ["/tmp"])).toBe(false);
    });
    it("checks multiple allowed paths", ()=>{
        expect(validateFsPath("/home/user/file.txt", ["/tmp", "/home/user"])).toBe(true);
        expect(validateFsPath("/tmp/file.txt", ["/tmp", "/home/user"])).toBe(true);
    });
});
describe("wrapFetch", ()=>{
    it("returns fetch with network permission", ()=>{
        let result=wrapFetch(["network"]);
        expect(typeof result).toBe("function");
    });
    it("returns undefined without network permission", ()=>{
        expect(wrapFetch([])).toBeUndefined();
        expect(wrapFetch(["filesystem", "settings"])).toBeUndefined();
    });
});
