// @vitest-environment node
import { describe, it, expect, vi } from "vitest"
import { ThroughputStore, InMemoryThroughputStorage, buildChartData, ThroughputSample } from "../src/core/throughputStore.js"
const {mockDatabase}=vi.hoisted(() => {
    return {mockDatabase: vi.fn()}
})
vi.mock("better-sqlite3", () => {
    return {default: mockDatabase}
})
function createMockDatabase(initial: ThroughputSample[]=[]): any{
    let rows: ThroughputSample[]=[...initial]
    return {
        exec: vi.fn((sql: string) => {
            if (sql.includes("DELETE FROM")){
                rows=[]
            }
        }),
        prepare: vi.fn((sql: string) => {
            if (sql.includes("INSERT")){
                return {
                    run: vi.fn((sessionId: string, timestamp: number, tokensPerSec: number, chunksPerSec: number, costPer1kTokens: number) => {
                        rows.push({sessionId, timestamp, tokensPerSec, chunksPerSec, costPer1kTokens})
                    })
                }
            }
            if (sql.includes("SELECT")){
                return {
                    all: vi.fn(() => rows)
                }
            }
            return {run: vi.fn(), all: vi.fn(() => [])}
        })
    }
}
mockDatabase.mockImplementation(function () { return createMockDatabase() })
function makeSample(overrides: Partial<ThroughputSample>={}): ThroughputSample{
    return {
        sessionId: "s1",
        timestamp: 1000,
        tokensPerSec: 10,
        chunksPerSec: 5,
        costPer1kTokens: 0.001,
        ...overrides
    }
}
describe("ThroughputStore", () => {
    it("addSample stores sample", () => {
        let store=new ThroughputStore()
        let sample=makeSample()
        store.addSample(sample)
        expect(store.getSamples()).toEqual([sample])
    })
    it("getSamples returns all samples when no filters", () => {
        let store=new ThroughputStore()
        store.addSample(makeSample({sessionId: "a"}))
        store.addSample(makeSample({sessionId: "b"}))
        expect(store.getSamples().length).toBe(2)
    })
    it("getSamples filters by session", () => {
        let store=new ThroughputStore()
        store.addSample(makeSample({sessionId: "a"}))
        store.addSample(makeSample({sessionId: "b"}))
        expect(store.getSamples("a").length).toBe(1)
        expect(store.getSamples("a")[0].sessionId).toBe("a")
    })
    it("getSamples filters by time range", () => {
        let store=new ThroughputStore()
        store.addSample(makeSample({timestamp: 100}))
        store.addSample(makeSample({timestamp: 500}))
        store.addSample(makeSample({timestamp: 900}))
        expect(store.getSamples(undefined, 200, 800).length).toBe(1)
        expect(store.getSamples(undefined, 200, 800)[0].timestamp).toBe(500)
    })
    it("getSamples combines session and time filters", () => {
        let store=new ThroughputStore()
        store.addSample(makeSample({sessionId: "a", timestamp: 100}))
        store.addSample(makeSample({sessionId: "a", timestamp: 500}))
        store.addSample(makeSample({sessionId: "b", timestamp: 500}))
        expect(store.getSamples("a", 200, 800).length).toBe(1)
        expect(store.getSamples("a", 200, 800)[0].timestamp).toBe(500)
    })
    it("getSessions returns unique ids", () => {
        let store=new ThroughputStore()
        store.addSample(makeSample({sessionId: "a"}))
        store.addSample(makeSample({sessionId: "b"}))
        store.addSample(makeSample({sessionId: "a"}))
        expect(store.getSessions()).toEqual(["a", "b"])
    })
    it("getAggregates computes averages", () => {
        let store=new ThroughputStore()
        store.addSample(makeSample({tokensPerSec: 10, chunksPerSec: 5}))
        store.addSample(makeSample({tokensPerSec: 30, chunksPerSec: 15}))
        let agg=store.getAggregates()
        expect(agg.avgTokensPerSec).toBe(20)
        expect(agg.avgChunksPerSec).toBe(10)
        expect(agg.totalSamples).toBe(2)
    })
    it("getAggregates filters by session", () => {
        let store=new ThroughputStore()
        store.addSample(makeSample({sessionId: "a", tokensPerSec: 10, chunksPerSec: 5}))
        store.addSample(makeSample({sessionId: "b", tokensPerSec: 30, chunksPerSec: 15}))
        let agg=store.getAggregates("a")
        expect(agg.avgTokensPerSec).toBe(10)
        expect(agg.avgChunksPerSec).toBe(5)
        expect(agg.totalSamples).toBe(1)
    })
    it("getAggregates returns zero for empty", () => {
        let store=new ThroughputStore()
        let agg=store.getAggregates()
        expect(agg).toEqual({avgTokensPerSec: 0, avgChunksPerSec: 0, totalSamples: 0})
    })
    it("persist saves to storage fallback", () => {
        let storage=new InMemoryThroughputStorage()
        let store=new ThroughputStore({storage})
        store.addSample(makeSample())
        store.persist()
        let raw=storage.getItem("tg-throughput")
        expect(raw).not.toBeNull()
        let parsed=JSON.parse(raw!)
        expect(parsed.length).toBe(1)
    })
    it("load restores from storage", () => {
        let storage=new InMemoryThroughputStorage()
        let store=new ThroughputStore({storage})
        store.addSample(makeSample({sessionId: "saved"}))
        store.persist()
        let other=new ThroughputStore({storage})
        other.load()
        expect(other.getSamples().length).toBe(1)
        expect(other.getSamples()[0].sessionId).toBe("saved")
    })
    it("load empty storage leaves samples empty", () => {
        let storage=new InMemoryThroughputStorage()
        let store=new ThroughputStore({storage})
        store.load()
        expect(store.getSamples()).toEqual([])
    })
    it("persist saves to SQLite when available", () => {
        let store=new ThroughputStore({dbPath: ":memory:"})
        store.addSample(makeSample({sessionId: "sqlite"}))
        store.persist()
        store.load()
        expect(store.getSamples().length).toBe(1)
        expect(store.getSamples()[0].sessionId).toBe("sqlite")
    })
    it("load restores all fields from SQLite", () => {
        let store=new ThroughputStore({dbPath: ":memory:"})
        store.addSample(makeSample({sessionId: "full", timestamp: 1234, tokensPerSec: 12.5, chunksPerSec: 6.5, costPer1kTokens: 0.05}))
        store.persist()
        store.load()
        let s=store.getSamples()[0]
        expect(s).toEqual(makeSample({sessionId: "full", timestamp: 1234, tokensPerSec: 12.5, chunksPerSec: 6.5, costPer1kTokens: 0.05}))
    })
    it("SQLite path throws if unavailable (mocked)", async () => {
        vi.resetModules()
        vi.doMock("better-sqlite3", () => {
            return {default: vi.fn(function () { throw new Error("unavailable") })}
        })
        let { ThroughputStore }=await import("../src/core/throughputStore.js")
        let store=new ThroughputStore({dbPath: ":memory:"})
        expect(() => store.persist()).toThrow("better-sqlite3 unavailable")
        vi.doUnmock("better-sqlite3")
    })
    it("clear removes all samples", () => {
        let store=new ThroughputStore()
        store.addSample(makeSample())
        store.clear()
        expect(store.getSamples()).toEqual([])
    })
    it("clear removes SQLite rows", () => {
        let store=new ThroughputStore({dbPath: ":memory:"})
        store.addSample(makeSample())
        store.persist()
        store.clear()
        store.load()
        expect(store.getSamples()).toEqual([])
    })
})
describe("buildChartData", () => {
    it("returns empty arrays for empty samples", () => {
        let result=buildChartData([])
        expect(result.labels).toEqual([])
        expect(result.tokensPerSec).toEqual([])
        expect(result.chunksPerSec).toEqual([])
    })
    it("buckets samples and averages values", () => {
        let samples: ThroughputSample[]=[
            makeSample({timestamp: 0, tokensPerSec: 10, chunksPerSec: 5}),
            makeSample({timestamp: 500, tokensPerSec: 30, chunksPerSec: 15}),
            makeSample({timestamp: 1000, tokensPerSec: 20, chunksPerSec: 10})
        ]
        let result=buildChartData(samples, 1000)
        expect(result.labels.length).toBe(2)
        expect(result.tokensPerSec[0]).toBe(20)
        expect(result.chunksPerSec[0]).toBe(10)
        expect(result.tokensPerSec[1]).toBe(20)
        expect(result.chunksPerSec[1]).toBe(10)
    })
    it("sorts buckets by time", () => {
        let samples: ThroughputSample[]=[
            makeSample({timestamp: 2000, tokensPerSec: 1, chunksPerSec: 1}),
            makeSample({timestamp: 1000, tokensPerSec: 2, chunksPerSec: 2})
        ]
        let result=buildChartData(samples, 1000)
        expect(result.tokensPerSec[0]).toBe(2)
        expect(result.tokensPerSec[1]).toBe(1)
    })
    it("uses default bucket size", () => {
        let samples: ThroughputSample[]=[
            makeSample({timestamp: 0, tokensPerSec: 10, chunksPerSec: 5}),
            makeSample({timestamp: 500, tokensPerSec: 30, chunksPerSec: 15})
        ]
        let result=buildChartData(samples)
        expect(result.labels.length).toBe(1)
        expect(result.tokensPerSec[0]).toBe(20)
    })
})