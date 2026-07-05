import{describe, test, expect, vi, beforeEach}from"vitest";
let cpState=vi.hoisted(()=>({
    spawnError: null as Error|null,
    spawnCode: 0,
    spawnStdout: "",
    spawnStderr: "",
    spawnCalls: [] as {cmd: string, args: string[], proc: any}[]
}));
vi.mock("child_process", ()=>{
    let mocked={
        spawn: vi.fn((cmd: string, args: string[])=>{
            let handlers: Record<string, Function[]>={};
            let stdoutHandlers: Record<string, Function[]>={};
            let stderrHandlers: Record<string, Function[]>={};
            let proc={
                stdout: {
                    on: vi.fn((event: string, cb: Function)=>{
                        stdoutHandlers[event]=stdoutHandlers[event]||[];
                        stdoutHandlers[event].push(cb);
                    })
                },
                stderr: {
                    on: vi.fn((event: string, cb: Function)=>{
                        stderrHandlers[event]=stderrHandlers[event]||[];
                        stderrHandlers[event].push(cb);
                    })
                },
                on: vi.fn((event: string, cb: Function)=>{
                    handlers[event]=handlers[event]||[];
                    handlers[event].push(cb);
                }),
                _emit: (event: string, ...args: any[])=>{
                    let list=handlers[event]||[];
                    for(let cb of list){
                        cb(...args);
                    }
                },
                _emitStdout: (event: string, ...args: any[])=>{
                    let list=stdoutHandlers[event]||[];
                    for(let cb of list){
                        cb(...args);
                    }
                },
                _emitStderr: (event: string, ...args: any[])=>{
                    let list=stderrHandlers[event]||[];
                    for(let cb of list){
                        cb(...args);
                    }
                }
            };
            cpState.spawnCalls.push({cmd, args, proc});
            process.nextTick(()=>{
                if(cpState.spawnStdout){
                    proc._emitStdout("data", Buffer.from(cpState.spawnStdout));
                }
                if(cpState.spawnStderr){
                    proc._emitStderr("data", Buffer.from(cpState.spawnStderr));
                }
                if(cpState.spawnError){
                    proc._emit("error", cpState.spawnError);
                }
                else{
                    proc._emit("close", cpState.spawnCode);
                }
            });
            return proc;
        })
    };
    return{
        ...mocked,
        default: mocked
    };
});
import{
    VaultProvider,
    OnePasswordCliVault,
    BitwardenCliVault,
    VaultResolver,
    parseVaultRef
}from"../src/core/vaultProvider.js";
beforeEach(()=>{
    vi.clearAllMocks();
    cpState.spawnError=null;
    cpState.spawnCode=0;
    cpState.spawnStdout="";
    cpState.spawnStderr="";
    cpState.spawnCalls=[];
});
describe("parseVaultRef", ()=>{
    test("extracts provider and path", ()=>{
        let ref=parseVaultRef("vault://op/MyVault/item/field");
        expect(ref.provider).toBe("op");
        expect(ref.path).toBe("MyVault/item/field");
    });
    test("extracts nested path", ()=>{
        let ref=parseVaultRef("vault://bw/secret/uuid");
        expect(ref.provider).toBe("bw");
        expect(ref.path).toBe("secret/uuid");
    });
    test("throws for missing provider", ()=>{
        expect(()=>parseVaultRef("vault:///secret")).toThrow("invalid vault reference");
    });
    test("throws for non-vault prefix", ()=>{
        expect(()=>parseVaultRef("http://op/secret")).toThrow("invalid vault reference");
    });
});
describe("OnePasswordCliVault", ()=>{
    test("defaults executable to op", ()=>{
        let vault=new OnePasswordCliVault({});
        expect(vault.executable).toBe("op");
        expect(vault.name).toBe("1password");
    });
    test("accepts custom executable", ()=>{
        let vault=new OnePasswordCliVault({executable: "/usr/local/bin/op"});
        expect(vault.executable).toBe("/usr/local/bin/op");
    });
    test("stores account and vault options", ()=>{
        let vault=new OnePasswordCliVault({account: "myaccount", vault: "MyVault"});
        expect(vault.account).toBe("myaccount");
        expect(vault.vault).toBe("MyVault");
    });
    test("spawns op read with full path", async()=>{
        cpState.spawnStdout="secret-value\n";
        let vault=new OnePasswordCliVault({});
        let value=await vault.get("MyVault/item/field");
        expect(value).toBe("secret-value");
        expect(cpState.spawnCalls.length).toBe(1);
        expect(cpState.spawnCalls[0].cmd).toBe("op");
        expect(cpState.spawnCalls[0].args).toEqual(["read", "op://MyVault/item/field"]);
    });
    test("spawns op read with constructor vault", async()=>{
        cpState.spawnStdout="secret-value\n";
        let vault=new OnePasswordCliVault({vault: "MyVault"});
        let value=await vault.get("item/field");
        expect(value).toBe("secret-value");
        expect(cpState.spawnCalls[0].args).toEqual(["read", "op://MyVault/item/field"]);
    });
    test("passes --account when account is set", async()=>{
        cpState.spawnStdout="secret-value\n";
        let vault=new OnePasswordCliVault({account: "myaccount", vault: "MyVault"});
        await vault.get("item/field");
        expect(cpState.spawnCalls[0].args).toEqual(["read", "op://MyVault/item/field", "--account", "myaccount"]);
    });
    test("throws when 1password CLI is not installed", async()=>{
        cpState.spawnError=new Error("ENOENT");
        let vault=new OnePasswordCliVault({});
        await expect(vault.get("MyVault/item/field")).rejects.toThrow("1password CLI not installed");
    });
    test("throws on non-zero exit", async()=>{
        cpState.spawnCode=1;
        cpState.spawnStderr="item not found";
        let vault=new OnePasswordCliVault({});
        await expect(vault.get("MyVault/item/field")).rejects.toThrow("op exited with code 1");
    });
});
describe("BitwardenCliVault", ()=>{
    test("defaults executable to bw", ()=>{
        let vault=new BitwardenCliVault({});
        expect(vault.executable).toBe("bw");
        expect(vault.name).toBe("bitwarden");
    });
    test("accepts custom executable", ()=>{
        let vault=new BitwardenCliVault({executable: "/usr/local/bin/bw"});
        expect(vault.executable).toBe("/usr/local/bin/bw");
    });
    test("spawns bw get password", async()=>{
        cpState.spawnStdout="password123\n";
        let vault=new BitwardenCliVault({});
        let value=await vault.get("uuid-123");
        expect(value).toBe("password123");
        expect(cpState.spawnCalls.length).toBe(1);
        expect(cpState.spawnCalls[0].cmd).toBe("bw");
        expect(cpState.spawnCalls[0].args).toEqual(["get", "password", "uuid-123"]);
    });
    test("throws when bitwarden CLI is not installed", async()=>{
        cpState.spawnError=new Error("ENOENT");
        let vault=new BitwardenCliVault({});
        await expect(vault.get("uuid-123")).rejects.toThrow("bitwarden CLI not installed");
    });
    test("throws on non-zero exit", async()=>{
        cpState.spawnCode=1;
        cpState.spawnStderr="not found";
        let vault=new BitwardenCliVault({});
        await expect(vault.get("uuid-123")).rejects.toThrow("bw exited with code 1");
    });
});
describe("VaultResolver", ()=>{
    test("leaves plain strings alone", async()=>{
        let resolver=new VaultResolver({providers: {}});
        let value=await resolver.resolveValue("plain string");
        expect(value).toBe("plain string");
    });
    test("resolves vault:// reference via provider", async()=>{
        let opProvider: VaultProvider={
            name: "op",
            get: vi.fn(async()=>"resolved-secret")
        };
        let resolver=new VaultResolver({providers: {op: opProvider}});
        let value=await resolver.resolveValue("vault://op/MyVault/item/field");
        expect(value).toBe("resolved-secret");
        expect(opProvider.get).toHaveBeenCalledWith("MyVault/item/field");
    });
    test("throws for unknown provider", async()=>{
        let resolver=new VaultResolver({providers: {}});
        await expect(resolver.resolveValue("vault://missing/secret")).rejects.toThrow("unknown vault provider: missing");
    });
    test("recursively resolves object values", async()=>{
        let opProvider: VaultProvider={
            name: "op",
            get: vi.fn(async(path: string)=>"resolved:" + path)
        };
        let resolver=new VaultResolver({providers: {op: opProvider}});
        let input={
            key: "vault://op/MyVault/item/field",
            plain: "keep-me",
            num: 42,
            nested: {
                password: "vault://op/MyVault/item/password"
            }
        };
        let output=await resolver.resolveObject(input);
        expect(output).toEqual({
            key: "resolved:MyVault/item/field",
            plain: "keep-me",
            num: 42,
            nested: {
                password: "resolved:MyVault/item/password"
            }
        });
    });
    test("recursively resolves arrays", async()=>{
        let opProvider: VaultProvider={
            name: "op",
            get: vi.fn(async(path: string)=>"resolved:" + path)
        };
        let resolver=new VaultResolver({providers: {op: opProvider}});
        let input={
            list: ["vault://op/a/b", "plain", {secret: "vault://op/c/d"}]
        };
        let output=await resolver.resolveObject(input);
        expect(output).toEqual({
            list: ["resolved:a/b", "plain", {secret: "resolved:c/d"}]
        });
    });
});
