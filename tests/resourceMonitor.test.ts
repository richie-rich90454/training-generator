// @vitest-environment node
import { describe, it, expect, vi } from "vitest"
import { ResourceMonitor, ResourceSnapshot } from "../src/core/resourceMonitor.js"
function makeSnapshot(overrides: Partial<ResourceSnapshot>={}): ResourceSnapshot{
    return {
        timestamp: Date.now(),
        tokensPerSecond: 0,
        chunksPerSecond: 0,
        memoryMB: 0,
        cpuPercent: 0,
        ...overrides
    }
}
describe("ResourceMonitor initialization", () => {
    it("should start with empty history", () => {
        let monitor=new ResourceMonitor()
        expect(monitor.getHistory()).toEqual([])
        expect(monitor.getLatest()).toBeUndefined()
        expect(monitor.getDuration()).toBe(0)
    })
    it("should accept custom options", () => {
        let monitor=new ResourceMonitor({maxDataPoints: 5, intervalMs: 500})
        expect(monitor.getHistory()).toEqual([])
    })
})
describe("ResourceMonitor record", () => {
    it("should store a snapshot", () => {
        let monitor=new ResourceMonitor()
        let snapshot=makeSnapshot({tokensPerSecond: 10, chunksPerSecond: 2})
        monitor.record(snapshot)
        expect(monitor.getHistory().length).toBe(1)
        expect(monitor.getLatest()?.tokensPerSecond).toBe(10)
        expect(monitor.getLatest()?.chunksPerSecond).toBe(2)
    })
    it("should return a copy from getHistory", () => {
        let monitor=new ResourceMonitor()
        monitor.record(makeSnapshot())
        let history=monitor.getHistory()
        history.pop()
        expect(monitor.getHistory().length).toBe(1)
    })
    it("should enforce maxDataPoints by dropping oldest", () => {
        let monitor=new ResourceMonitor({maxDataPoints: 3})
        for (let i=0;i<5;i++){
            monitor.record(makeSnapshot({timestamp: 1000+i}))
        }
        expect(monitor.getHistory().length).toBe(3)
        expect(monitor.getHistory()[0].timestamp).toBe(1002)
        expect(monitor.getHistory()[2].timestamp).toBe(1004)
    })
})
describe("ResourceMonitor capture", () => {
    it("should report zero throughput on first capture", () => {
        let monitor=new ResourceMonitor({getMemoryMB: () => 128, getCpuPercent: () => 5})
        let snapshot=monitor.capture({tokens: 0, chunks: 0})
        expect(snapshot.tokensPerSecond).toBe(0)
        expect(snapshot.chunksPerSecond).toBe(0)
        expect(snapshot.memoryMB).toBe(128)
        expect(snapshot.cpuPercent).toBe(5)
        expect(monitor.getHistory().length).toBe(1)
    })
    it("should compute throughput from deltas", () => {
        vi.useFakeTimers()
        try {
            let monitor=new ResourceMonitor({getMemoryMB: () => 64, getCpuPercent: () => 10})
            monitor.capture({tokens: 0, chunks: 0})
            vi.advanceTimersByTime(2000)
            let snapshot=monitor.capture({tokens: 200, chunks: 20})
            expect(snapshot.tokensPerSecond).toBe(100)
            expect(snapshot.chunksPerSecond).toBe(10)
        }
        finally {
            vi.useRealTimers()
        }
    })
    it("should not drop snapshots when totals decrease", () => {
        vi.useFakeTimers()
        try {
            let monitor=new ResourceMonitor({getMemoryMB: () => 0, getCpuPercent: () => 0})
            monitor.capture({tokens: 100, chunks: 10})
            vi.advanceTimersByTime(1000)
            let snapshot=monitor.capture({tokens: 50, chunks: 5})
            expect(snapshot.tokensPerSecond).toBe(-50)
            expect(snapshot.chunksPerSecond).toBe(-5)
        }
        finally {
            vi.useRealTimers()
        }
    })
})
describe("ResourceMonitor start and stop", () => {
    it("should capture on start and then at intervals", () => {
        vi.useFakeTimers()
        try {
            let collector={tokens: 0, chunks: 0}
            let monitor=new ResourceMonitor({intervalMs: 1000, getMemoryMB: () => 0, getCpuPercent: () => 0})
            monitor.start(() => collector)
            expect(monitor.getHistory().length).toBe(1)
            collector.tokens=100
            collector.chunks=10
            vi.advanceTimersByTime(1000)
            expect(monitor.getHistory().length).toBe(2)
            expect(monitor.getLatest()?.tokensPerSecond).toBe(100)
            vi.advanceTimersByTime(2000)
            expect(monitor.getHistory().length).toBe(4)
        }
        finally {
            vi.useRealTimers()
        }
    })
    it("should stop capturing", () => {
        vi.useFakeTimers()
        try {
            let monitor=new ResourceMonitor({intervalMs: 1000, getMemoryMB: () => 0, getCpuPercent: () => 0})
            monitor.start(() => ({tokens: 0, chunks: 0}))
            monitor.stop()
            vi.advanceTimersByTime(2000)
            expect(monitor.getHistory().length).toBe(1)
        }
        finally {
            vi.useRealTimers()
        }
    })
    it("should restart cleanly", () => {
        vi.useFakeTimers()
        try {
            let monitor=new ResourceMonitor({intervalMs: 1000, getMemoryMB: () => 0, getCpuPercent: () => 0})
            monitor.start(() => ({tokens: 0, chunks: 0}))
            vi.advanceTimersByTime(1000)
            monitor.start(() => ({tokens: 0, chunks: 0}))
            expect(monitor.getHistory().length).toBe(3)
            vi.advanceTimersByTime(1000)
            expect(monitor.getHistory().length).toBe(4)
        }
        finally {
            vi.useRealTimers()
        }
    })
})
describe("ResourceMonitor queries", () => {
    it("should get history within duration", () => {
        vi.useFakeTimers()
        try {
            vi.setSystemTime(10000)
            let monitor=new ResourceMonitor()
            monitor.record(makeSnapshot({timestamp: 10000-6000}))
            monitor.record(makeSnapshot({timestamp: 10000-3000}))
            monitor.record(makeSnapshot({timestamp: 10000-500}))
            expect(monitor.getHistory(2000).length).toBe(1)
            expect(monitor.getHistory(4000).length).toBe(2)
            expect(monitor.getHistory(7000).length).toBe(3)
        }
        finally {
            vi.useRealTimers()
        }
    })
    it("should compute duration", () => {
        let monitor=new ResourceMonitor()
        monitor.record(makeSnapshot({timestamp: 1000}))
        monitor.record(makeSnapshot({timestamp: 5000}))
        expect(monitor.getDuration()).toBe(4000)
    })
    it("should return a series for each metric", () => {
        let monitor=new ResourceMonitor()
        monitor.record(makeSnapshot({timestamp: 1, tokensPerSecond: 10, memoryMB: 50}))
        monitor.record(makeSnapshot({timestamp: 2, tokensPerSecond: 20, memoryMB: 60}))
        let tokens=monitor.getSeries("tokensPerSecond")
        expect(tokens.length).toBe(2)
        expect(tokens[0].value).toBe(10)
        expect(tokens[1].value).toBe(20)
        let memory=monitor.getSeries("memoryMB")
        expect(memory[0].value).toBe(50)
        expect(memory[1].value).toBe(60)
    })
    it("should compute average", () => {
        let monitor=new ResourceMonitor()
        monitor.record(makeSnapshot({tokensPerSecond: 10}))
        monitor.record(makeSnapshot({tokensPerSecond: 20}))
        monitor.record(makeSnapshot({tokensPerSecond: 30}))
        expect(monitor.getAverage("tokensPerSecond")).toBe(20)
    })
    it("should return zero average for empty history", () => {
        let monitor=new ResourceMonitor()
        expect(monitor.getAverage("tokensPerSecond")).toBe(0)
    })
    it("should compute peak", () => {
        let monitor=new ResourceMonitor()
        monitor.record(makeSnapshot({tokensPerSecond: 10}))
        monitor.record(makeSnapshot({tokensPerSecond: 50}))
        monitor.record(makeSnapshot({tokensPerSecond: 30}))
        expect(monitor.getPeak("tokensPerSecond")).toBe(50)
    })
    it("should return zero peak for empty history", () => {
        let monitor=new ResourceMonitor()
        expect(monitor.getPeak("tokensPerSecond")).toBe(0)
    })
})
describe("ResourceMonitor aggregate", () => {
    it("should bucket values by time", () => {
        let monitor=new ResourceMonitor()
        monitor.record(makeSnapshot({timestamp: 1000, tokensPerSecond: 10}))
        monitor.record(makeSnapshot({timestamp: 1500, tokensPerSecond: 20}))
        monitor.record(makeSnapshot({timestamp: 2500, tokensPerSecond: 30}))
        monitor.record(makeSnapshot({timestamp: 3100, tokensPerSecond: 50}))
        let buckets=monitor.aggregate("tokensPerSecond", 1000)
        expect(buckets.length).toBe(3)
        expect(buckets[0].timestamp).toBe(1000)
        expect(buckets[0].value).toBe(15)
        expect(buckets[1].timestamp).toBe(2000)
        expect(buckets[1].value).toBe(30)
        expect(buckets[2].timestamp).toBe(3000)
        expect(buckets[2].value).toBe(50)
    })
    it("should return empty array for invalid bucket", () => {
        let monitor=new ResourceMonitor()
        monitor.record(makeSnapshot({timestamp: 1000, tokensPerSecond: 10}))
        expect(monitor.aggregate("tokensPerSecond", 0)).toEqual([])
    })
    it("should return empty array for empty history", () => {
        let monitor=new ResourceMonitor()
        expect(monitor.aggregate("tokensPerSecond", 1000)).toEqual([])
    })
})
describe("ResourceMonitor clear", () => {
    it("should remove history and stop timer", () => {
        vi.useFakeTimers()
        try {
            let monitor=new ResourceMonitor({intervalMs: 1000, getMemoryMB: () => 0, getCpuPercent: () => 0})
            monitor.start(() => ({tokens: 0, chunks: 0}))
            vi.advanceTimersByTime(1000)
            expect(monitor.getHistory().length).toBe(2)
            monitor.clear()
            expect(monitor.getHistory()).toEqual([])
            vi.advanceTimersByTime(2000)
            expect(monitor.getHistory()).toEqual([])
        }
        finally {
            vi.useRealTimers()
        }
    })
})
describe("ResourceMonitor defaults", () => {
    it("should use default memory and cpu getters", () => {
        let monitor=new ResourceMonitor()
        let snapshot=monitor.capture({tokens: 0, chunks: 0})
        expect(typeof snapshot.memoryMB).toBe("number")
        expect(typeof snapshot.cpuPercent).toBe("number")
        expect(snapshot.memoryMB).toBeGreaterThanOrEqual(0)
        expect(snapshot.cpuPercent).toBeGreaterThanOrEqual(0)
    })
})
