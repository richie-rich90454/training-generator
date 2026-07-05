// @vitest-environment node
import{describe, it, expect}from"vitest"
import{ProviderScopeEnforcer, ScopeError}from"../src/core/providerScopes.js"
import{ProviderRegistry}from"../src/renderer/provider.js"
import type{Provider, ProviderResult}from"../src/renderer/provider.js"
import type{ProviderConfig}from"../src/types/interfaces.js"
function makeMockProvider(name:string, shouldFail:boolean=false):Provider&{generateCalls:number}{
    let calls=0
    return{
        name,
        async generate(prompt:string, model:string):Promise<ProviderResult>{
            calls++
            if(shouldFail)throw new Error(`${name} failed`)
            return{text:`response from ${name}`, tokens:10, provider:name}
        },
        async healthCheck():Promise<boolean>{
            return !shouldFail
        },
        get generateCalls(){return calls}
    }
}
function makeConfig(id:string, priority:number, enabled:boolean=true):ProviderConfig{
    return{id, type:"ollama", name:id, priority, enabled}
}
describe("ScopeError", ()=>{
    it("extends Error", ()=>{
        let err=new ScopeError("test")
        expect(err).toBeInstanceOf(Error)
    })
    it("sets name to ScopeError", ()=>{
        let err=new ScopeError("test")
        expect(err.name).toBe("ScopeError")
        expect(err.message).toBe("test")
    })
})
describe("ProviderScopeEnforcer", ()=>{
    it("constructor stores scopes", ()=>{
        let enforcer=new ProviderScopeEnforcer({scopes:{p1:["read"]}})
        expect(enforcer.hasScope("p1","read")).toBe(true)
        expect(enforcer.hasScope("p1","generate")).toBe(false)
    })
    it("hasScope true when present", ()=>{
        let enforcer=new ProviderScopeEnforcer({scopes:{p1:["read","generate"]}})
        expect(enforcer.hasScope("p1","generate")).toBe(true)
    })
    it("hasScope false when absent", ()=>{
        let enforcer=new ProviderScopeEnforcer({scopes:{p1:["read"]}})
        expect(enforcer.hasScope("p1","generate")).toBe(false)
    })
    it("hasScope true when provider not configured", ()=>{
        let enforcer=new ProviderScopeEnforcer({scopes:{p1:["read"]}})
        expect(enforcer.hasScope("p2","generate")).toBe(true)
    })
    it("requireScope throws ScopeError when missing", ()=>{
        let enforcer=new ProviderScopeEnforcer({scopes:{p1:["read"]}})
        expect(()=>enforcer.requireScope("p1","generate")).toThrow(ScopeError)
    })
    it("requireScope does not throw when present", ()=>{
        let enforcer=new ProviderScopeEnforcer({scopes:{p1:["read","generate"]}})
        expect(()=>enforcer.requireScope("p1","generate")).not.toThrow()
    })
    it("setScopes updates scopes", ()=>{
        let enforcer=new ProviderScopeEnforcer({scopes:{}})
        enforcer.setScopes("p1",["generate"])
        expect(enforcer.hasScope("p1","generate")).toBe(true)
    })
    it("setScopes overrides existing scopes", ()=>{
        let enforcer=new ProviderScopeEnforcer({scopes:{p1:["read"]}})
        enforcer.setScopes("p1",["generate"])
        expect(enforcer.hasScope("p1","generate")).toBe(true)
        expect(enforcer.hasScope("p1","read")).toBe(false)
    })
    it("listProvidersWithScope filters", ()=>{
        let enforcer=new ProviderScopeEnforcer({scopes:{p1:["read","generate"],p2:["read"],p3:["generate"]}})
        let providers=enforcer.listProvidersWithScope("generate")
        expect(providers).toContain("p1")
        expect(providers).toContain("p3")
        expect(providers).not.toContain("p2")
    })
    it("listProvidersWithScope empty when none match", ()=>{
        let enforcer=new ProviderScopeEnforcer({scopes:{p1:["read"],p2:["read"]}})
        expect(enforcer.listProvidersWithScope("generate")).toEqual([])
    })
    it("supports multiple scopes per provider", ()=>{
        let enforcer=new ProviderScopeEnforcer({scopes:{p1:["read","generate","export"]}})
        expect(enforcer.hasScope("p1","read")).toBe(true)
        expect(enforcer.hasScope("p1","generate")).toBe(true)
        expect(enforcer.hasScope("p1","export")).toBe(true)
    })
})
describe("ProviderRegistry scope enforcement", ()=>{
    it("generateWithFailover uses provider with generate scope", async ()=>{
        let configs=[makeConfig("c1",1)]
        let p1=makeMockProvider("p1")
        let providers=new Map<string, Provider>([["c1",p1]])
        let registry=new ProviderRegistry(configs,providers)
        registry.setProviderScopes({c1:["generate"]})
        let result=await registry.generateWithFailover("prompt","model")
        expect(result.provider).toBe("p1")
        expect(p1.generateCalls).toBe(1)
    })
    it("generateWithFailover skips provider without generate scope", async ()=>{
        let configs=[makeConfig("c1",1),makeConfig("c2",2)]
        let p1=makeMockProvider("p1")
        let p2=makeMockProvider("p2")
        let providers=new Map<string, Provider>([["c1",p1],["c2",p2]])
        let registry=new ProviderRegistry(configs,providers)
        registry.setProviderScopes({c1:["read"],c2:["generate"]})
        let result=await registry.generateWithFailover("prompt","model")
        expect(result.provider).toBe("p2")
        expect(p1.generateCalls).toBe(0)
        expect(p2.generateCalls).toBe(1)
    })
    it("generateWithFailover defaults to all scopes when none configured", async ()=>{
        let configs=[makeConfig("c1",1)]
        let p1=makeMockProvider("p1")
        let providers=new Map<string, Provider>([["c1",p1]])
        let registry=new ProviderRegistry(configs,providers)
        let result=await registry.generateWithFailover("prompt","model")
        expect(result.provider).toBe("p1")
        expect(p1.generateCalls).toBe(1)
    })
    it("generateWithFailover throws ScopeError when no provider has generate scope", async ()=>{
        let configs=[makeConfig("c1",1),makeConfig("c2",2)]
        let p1=makeMockProvider("p1")
        let p2=makeMockProvider("p2")
        let providers=new Map<string, Provider>([["c1",p1],["c2",p2]])
        let registry=new ProviderRegistry(configs,providers)
        registry.setProviderScopes({c1:["read"],c2:["read"]})
        await expect(registry.generateWithFailover("prompt","model")).rejects.toThrow(ScopeError)
        expect(p1.generateCalls).toBe(0)
        expect(p2.generateCalls).toBe(0)
    })
    it("setProviderScopes updates existing scopes", async ()=>{
        let configs=[makeConfig("c1",1)]
        let p1=makeMockProvider("p1")
        let providers=new Map<string, Provider>([["c1",p1]])
        let registry=new ProviderRegistry(configs,providers)
        registry.setProviderScopes({c1:["read"]})
        await expect(registry.generateWithFailover("prompt","model")).rejects.toThrow(ScopeError)
        registry.setProviderScopes({c1:["generate"]})
        let result=await registry.generateWithFailover("prompt","model")
        expect(result.provider).toBe("p1")
    })
    it("generateWithFailover does not call generate on provider lacking scope", async ()=>{
        let configs=[makeConfig("c1",1)]
        let p1=makeMockProvider("p1")
        let providers=new Map<string, Provider>([["c1",p1]])
        let registry=new ProviderRegistry(configs,providers)
        registry.setProviderScopes({c1:["read"]})
        await expect(registry.generateWithFailover("prompt","model")).rejects.toThrow(ScopeError)
        expect(p1.generateCalls).toBe(0)
    })
    it("generateWithFailover succeeds with multiple scopes per provider", async ()=>{
        let configs=[makeConfig("c1",1)]
        let p1=makeMockProvider("p1")
        let providers=new Map<string, Provider>([["c1",p1]])
        let registry=new ProviderRegistry(configs,providers)
        registry.setProviderScopes({c1:["read","generate","export"]})
        let result=await registry.generateWithFailover("prompt","model")
        expect(result.provider).toBe("p1")
    })
})
