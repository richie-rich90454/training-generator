// @vitest-environment node
import{describe, it, expect}from"vitest"
import{ProviderRegistry}from"../src/renderer/provider.js"
import type{Provider, ProviderResult}from"../src/renderer/provider.js"
import type{ProviderConfig}from"../src/types/interfaces.js"
function makeMockProvider(name:string, shouldFail:boolean=false, failCount:number=0):Provider&{generateCalls:number}{
    let calls=0
    return{
        name,
        async generate(prompt:string, model:string):Promise<ProviderResult>{
            calls++
            if(shouldFail||(failCount>0&&calls<=failCount))throw new Error(`${name} failed`)
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
describe("ProviderRegistry", ()=>{
    it("sorts configs by priority", ()=>{
        let configs=[makeConfig("c2", 2), makeConfig("c1", 1), makeConfig("c3", 3)]
        let providers=new Map<string, Provider>([
            ["c2", makeMockProvider("p2")],
            ["c1", makeMockProvider("p1")],
            ["c3", makeMockProvider("p3")]
        ])
        let registry=new ProviderRegistry(configs, providers)
        let sorted=registry.getConfigs()
        expect(sorted[0].id).toBe("c1")
        expect(sorted[1].id).toBe("c2")
        expect(sorted[2].id).toBe("c3")
    })
    it("filters out disabled configs", ()=>{
        let configs=[makeConfig("c1", 1, true), makeConfig("c2", 2, false), makeConfig("c3", 3, true)]
        let providers=new Map<string, Provider>([
            ["c1", makeMockProvider("p1")],
            ["c2", makeMockProvider("p2")],
            ["c3", makeMockProvider("p3")]
        ])
        let registry=new ProviderRegistry(configs, providers)
        let active=registry.getConfigs()
        expect(active).toHaveLength(2)
        expect(active[0].id).toBe("c1")
        expect(active[1].id).toBe("c3")
    })
    it("getCurrentProvider returns the highest-priority healthy provider", ()=>{
        let configs=[makeConfig("c1", 1), makeConfig("c2", 2)]
        let providers=new Map<string, Provider>([
            ["c1", makeMockProvider("p1")],
            ["c2", makeMockProvider("p2")]
        ])
        let registry=new ProviderRegistry(configs, providers)
        let current=registry.getCurrentProvider()
        expect(current).not.toBeNull()
        expect(current!.name).toBe("p1")
    })
    it("getCurrentProvider returns null when all unhealthy", async ()=>{
        let configs=[makeConfig("c1", 1), makeConfig("c2", 2)]
        let providers=new Map<string, Provider>([
            ["c1", makeMockProvider("p1", true)],
            ["c2", makeMockProvider("p2", true)]
        ])
        let registry=new ProviderRegistry(configs, providers)
        for(let i=0;i<3;i++){
            try{
                await registry.generateWithFailover("prompt", "model")
            }
            catch{}
        }
        expect(registry.getCurrentProvider()).toBeNull()
    })
    it("generateWithFailover uses first healthy provider", async ()=>{
        let configs=[makeConfig("c1", 1), makeConfig("c2", 2)]
        let p1=makeMockProvider("p1")
        let p2=makeMockProvider("p2")
        let providers=new Map<string, Provider>([["c1", p1], ["c2", p2]])
        let registry=new ProviderRegistry(configs, providers)
        let result=await registry.generateWithFailover("prompt", "model")
        expect(result.provider).toBe("p1")
        expect(p1.generateCalls).toBe(1)
        expect(p2.generateCalls).toBe(0)
    })
    it("generateWithFailover fails over to next provider after 3 failures", async ()=>{
        let configs=[makeConfig("c1", 1), makeConfig("c2", 2)]
        let p1=makeMockProvider("p1", true)
        let p2=makeMockProvider("p2")
        let providers=new Map<string, Provider>([["c1", p1], ["c2", p2]])
        let registry=new ProviderRegistry(configs, providers)
        for(let i=0;i<4;i++){
            try{
                await registry.generateWithFailover("prompt", "model")
            }
            catch{}
        }
        expect(p1.generateCalls).toBe(3)
        expect(p2.generateCalls).toBe(4)
        expect(registry.getFailoverLog()).toHaveLength(1)
        expect(registry.getFailoverLog()[0].provider).toBe("c1")
    })
    it("generateWithFailover throws when all providers fail", async ()=>{
        let configs=[makeConfig("c1", 1), makeConfig("c2", 2)]
        let providers=new Map<string, Provider>([
            ["c1", makeMockProvider("p1", true)],
            ["c2", makeMockProvider("p2", true)]
        ])
        let registry=new ProviderRegistry(configs, providers)
        await expect(registry.generateWithFailover("prompt", "model")).rejects.toThrow("p2 failed")
    })
    it("generateWithFailover resets consecutiveFailures on success", async ()=>{
        let configs=[makeConfig("c1", 1)]
        let p1=makeMockProvider("p1", false, 1)
        let providers=new Map<string, Provider>([["c1", p1]])
        let registry=new ProviderRegistry(configs, providers)
        try{
            await registry.generateWithFailover("prompt", "model")
        }
        catch{}
        let result=await registry.generateWithFailover("prompt", "model")
        expect(result.provider).toBe("p1")
        expect(registry.getHealthStatus("c1")!.consecutiveFailures).toBe(0)
    })
    it("healthCheck returns ok:true with latencyMs for healthy provider", async ()=>{
        let configs=[makeConfig("c1", 1)]
        let providers=new Map<string, Provider>([["c1", makeMockProvider("p1")]])
        let registry=new ProviderRegistry(configs, providers)
        let result=await registry.healthCheck("c1")
        expect(result.ok).toBe(true)
        expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })
    it("healthCheck returns ok:false with error for unhealthy provider", async ()=>{
        let configs=[makeConfig("c1", 1)]
        let throwingProvider:Provider={
            name:"throwing",
            async generate(prompt:string, model:string):Promise<ProviderResult>{
                return{text:"ok", tokens:1, provider:"throwing"}
            },
            async healthCheck():Promise<boolean>{
                throw new Error("health check error")
            }
        }
        let providers=new Map<string, Provider>([["c1", throwingProvider]])
        let registry=new ProviderRegistry(configs, providers)
        let result=await registry.healthCheck("c1")
        expect(result.ok).toBe(false)
        expect(result.error).toBe("health check error")
    })
    it("healthCheckAll checks all providers in parallel", async ()=>{
        let configs=[makeConfig("c1", 1), makeConfig("c2", 2), makeConfig("c3", 3)]
        let providers=new Map<string, Provider>([
            ["c1", makeMockProvider("p1")],
            ["c2", makeMockProvider("p2")],
            ["c3", makeMockProvider("p3")]
        ])
        let registry=new ProviderRegistry(configs, providers)
        let results=await registry.healthCheckAll()
        expect(results.size).toBe(3)
        expect(results.get("c1")!.ok).toBe(true)
        expect(results.get("c2")!.ok).toBe(true)
        expect(results.get("c3")!.ok).toBe(true)
    })
    it("resetProvider restores a failed provider to healthy", async ()=>{
        let configs=[makeConfig("c1", 1)]
        let providers=new Map<string, Provider>([["c1", makeMockProvider("p1", true)]])
        let registry=new ProviderRegistry(configs, providers)
        for(let i=0;i<3;i++){
            try{
                await registry.generateWithFailover("prompt", "model")
            }
            catch{}
        }
        expect(registry.getHealthStatus("c1")!.isHealthy).toBe(false)
        registry.resetProvider("c1")
        expect(registry.getHealthStatus("c1")!.isHealthy).toBe(true)
        expect(registry.getHealthStatus("c1")!.consecutiveFailures).toBe(0)
    })
    it("getFailoverLog records failover events with timestamp", async ()=>{
        let configs=[makeConfig("c1", 1), makeConfig("c2", 2)]
        let providers=new Map<string, Provider>([
            ["c1", makeMockProvider("p1", true)],
            ["c2", makeMockProvider("p2", true)]
        ])
        let registry=new ProviderRegistry(configs, providers)
        let before=Date.now()
        for(let i=0;i<3;i++){
            try{
                await registry.generateWithFailover("prompt", "model")
            }
            catch{}
        }
        let after=Date.now()
        let log=registry.getFailoverLog()
        expect(log.length).toBe(2)
        expect(log[0].provider).toBe("c1")
        expect(log[0].reason).toContain("p1 failed")
        expect(log[0].timestamp).toBeGreaterThanOrEqual(before)
        expect(log[0].timestamp).toBeLessThanOrEqual(after)
        expect(log[1].provider).toBe("c2")
        expect(log[1].timestamp).toBeGreaterThanOrEqual(before)
        expect(log[1].timestamp).toBeLessThanOrEqual(after)
    })
    it("getHealthStatus returns current health state", ()=>{
        let configs=[makeConfig("c1", 1)]
        let providers=new Map<string, Provider>([["c1", makeMockProvider("p1")]])
        let registry=new ProviderRegistry(configs, providers)
        let status=registry.getHealthStatus("c1")
        expect(status).toBeDefined()
        expect(status!.consecutiveFailures).toBe(0)
        expect(status!.isHealthy).toBe(true)
        expect(status!.lastCheck).toBe(0)
        expect(status!.lastLatencyMs).toBe(0)
    })
})
