// @vitest-environment node
import {describe, it, expect} from "vitest"
import {computePercentile, benchmarkProvider, benchmarkProviders, formatBenchmarkTable, DEFAULT_BENCHMARK_CONFIG} from "../src/renderer/providerBenchmark.js"
import type {Provider, ProviderResult} from "../src/renderer/provider.js"
function makeMockProvider(name:string, delayMs:number, shouldFail:boolean=false, failPattern?:number):Provider{
    let calls=0
    return{
        name,
        async generate():Promise<ProviderResult>{
            calls++
            if(shouldFail||(failPattern&&calls%failPattern===0))throw new Error(`${name} failed`)
            await new Promise(r=>setTimeout(r, delayMs))
            return{text:"ok", tokens:1, provider:name}
        }
    }
}
describe("computePercentile", ()=>{
    it("returns 0 for empty array", ()=>{
        expect(computePercentile([], 50)).toBe(0)
    })
    it("computes p50, p95, p99 correctly for [10,20,30,40,50]", ()=>{
        let values=[10, 20, 30, 40, 50]
        expect(computePercentile(values, 50)).toBe(30)
        expect(computePercentile(values, 95)).toBe(50)
        expect(computePercentile(values, 99)).toBe(50)
    })
    it("returns the single value for a single-element array", ()=>{
        expect(computePercentile([42], 50)).toBe(42)
        expect(computePercentile([42], 95)).toBe(42)
        expect(computePercentile([42], 99)).toBe(42)
    })
})
describe("benchmarkProvider", ()=>{
    it("returns correct stats for a succeeding provider", async ()=>{
        let provider=makeMockProvider("success-provider", 10)
        let result=await benchmarkProvider(provider, {prompt:"test", model:"m", runs:3})
        expect(result.providerName).toBe("success-provider")
        expect(result.samples).toBe(3)
        expect(result.successCount).toBe(3)
        expect(result.errorCount).toBe(0)
        expect(result.latencies.length).toBe(3)
        expect(result.errors.length).toBe(0)
        expect(result.p50).toBeGreaterThanOrEqual(0)
        expect(result.p95).toBeGreaterThanOrEqual(result.p50)
        expect(result.p99).toBeGreaterThanOrEqual(result.p95)
        expect(result.mean).toBeGreaterThanOrEqual(0)
        expect(result.min).toBeLessThanOrEqual(result.max)
        expect(result.min).toBeGreaterThanOrEqual(0)
    })
    it("returns errorCount=runs, successCount=0, empty latencies for always-failing provider", async ()=>{
        let provider=makeMockProvider("fail-provider", 10, true)
        let result=await benchmarkProvider(provider, {prompt:"test", model:"m", runs:3})
        expect(result.successCount).toBe(0)
        expect(result.errorCount).toBe(3)
        expect(result.latencies.length).toBe(0)
        expect(result.errors.length).toBe(3)
        expect(result.p50).toBe(0)
        expect(result.p95).toBe(0)
        expect(result.p99).toBe(0)
        expect(result.mean).toBe(0)
        expect(result.min).toBe(0)
        expect(result.max).toBe(0)
    })
    it("returns successCount=1, errorCount=2 for provider failing 2 of 3 runs", async ()=>{
        let calls=0
        let provider:Provider={
            name:"fail-2-of-3",
            async generate():Promise<ProviderResult>{
                calls++
                if(calls<=2)throw new Error("fail-2-of-3 failed")
                await new Promise(r=>setTimeout(r, 10))
                return{text:"ok", tokens:1, provider:"fail-2-of-3"}
            }
        }
        let result=await benchmarkProvider(provider, {prompt:"test", model:"m", runs:3})
        expect(result.successCount).toBe(1)
        expect(result.errorCount).toBe(2)
        expect(result.latencies.length).toBe(1)
        expect(result.errors.length).toBe(2)
    })
})
describe("benchmarkProviders", ()=>{
    it("runs all providers in parallel and returns results for each", async ()=>{
        let providers=[
            makeMockProvider("p1", 10),
            makeMockProvider("p2", 10),
            makeMockProvider("p3", 10)
        ]
        let results=await benchmarkProviders(providers, {prompt:"test", model:"m", runs:2})
        expect(results.length).toBe(3)
        expect(results[0].providerName).toBe("p1")
        expect(results[1].providerName).toBe("p2")
        expect(results[2].providerName).toBe("p3")
        expect(results[0].successCount).toBe(2)
        expect(results[1].successCount).toBe(2)
        expect(results[2].successCount).toBe(2)
    })
    it("handles a provider that throws by returning a BenchmarkResult with error", async ()=>{
        let throwingProvider:Provider={
            name:"thrower",
            async generate():Promise<ProviderResult>{
                throw new Error("immediate throw")
            }
        }
        let results=await benchmarkProviders([throwingProvider], {prompt:"test", model:"m", runs:2})
        expect(results.length).toBe(1)
        expect(results[0].providerName).toBe("thrower")
        expect(results[0].successCount).toBe(0)
        expect(results[0].errorCount).toBe(2)
        expect(results[0].errors.length).toBe(2)
        expect(results[0].errors[0]).toContain("immediate throw")
    })
})
describe("formatBenchmarkTable", ()=>{
    it("produces a string with header and one row per result", ()=>{
        let results=[
            {providerName:"p1", samples:3, latencies:[10, 20, 30], p50:20, p95:30, p99:30, mean:20, min:10, max:30, successCount:3, errorCount:0, errors:[]},
            {providerName:"p2", samples:3, latencies:[15, 25, 35], p50:25, p95:35, p99:35, mean:25, min:15, max:35, successCount:3, errorCount:0, errors:[]}
        ]
        let table=formatBenchmarkTable(results)
        let lines=table.split("\n")
        expect(lines.length).toBe(4)
        expect(lines[0]).toContain("Provider")
        expect(lines[0]).toContain("P50")
        expect(lines[0]).toContain("P95")
        expect(lines[0]).toContain("P99")
        expect(lines[0]).toContain("Errors")
        expect(lines[1]).toBe("-".repeat(lines[0].length))
        expect(lines[2]).toContain("p1")
        expect(lines[3]).toContain("p2")
    })
})
describe("DEFAULT_BENCHMARK_CONFIG", ()=>{
    it("has runs=5", ()=>{
        expect(DEFAULT_BENCHMARK_CONFIG.runs).toBe(5)
    })
})
