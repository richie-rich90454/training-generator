import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { RateLimiter } from "../src/renderer/rateLimiter.js"
describe("RateLimiter construction", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
    })
    it("uses default configuration", () => {
        let limiter = new RateLimiter()
        expect(limiter.isActive).toBe(true)
    })
    it("applies custom tokens per minute", () => {
        let limiter = new RateLimiter(120)
        expect(limiter.isActive).toBe(true)
    })
    it("clamps tokens per minute to at least 1", () => {
        let limiter = new RateLimiter(0)
        expect(limiter.isActive).toBe(true)
    })
    it("applies custom burst size", async() => {
        let limiter = new RateLimiter(60, 2)
        await limiter.acquire()
        await limiter.acquire()
        let p = limiter.acquire()
        await vi.advanceTimersByTimeAsync(1100)
        await p
    })
    it("stores max wait ms", async() => {
        let limiter = new RateLimiter(60, 1, 5000)
        await limiter.acquire()
        let p = limiter.acquire()
        await vi.advanceTimersByTimeAsync(1100)
        await p
    })
})
describe("RateLimiter active state", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
    })
    it("reports active by default", () => {
        let limiter = new RateLimiter()
        expect(limiter.isActive).toBe(true)
    })
    it("reports inactive after disable", () => {
        let limiter = new RateLimiter()
        limiter.disable()
        expect(limiter.isActive).toBe(false)
    })
    it("reports active after enable", () => {
        let limiter = new RateLimiter()
        limiter.disable()
        limiter.enable()
        expect(limiter.isActive).toBe(true)
    })
    it("acquire resolves immediately when disabled", async() => {
        let limiter = new RateLimiter(60, 1)
        limiter.disable()
        await expect(limiter.acquire()).resolves.toBeUndefined()
    })
})
describe("RateLimiter acquire", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
    })
    it("resolves immediately when tokens available", async() => {
        let limiter = new RateLimiter(60, 10)
        await expect(limiter.acquire()).resolves.toBeUndefined()
    })
    it("consumes tokens on each acquire", async() => {
        let limiter = new RateLimiter(60, 2)
        await limiter.acquire()
        await limiter.acquire()
        let p = limiter.acquire()
        await vi.advanceTimersByTimeAsync(1100)
        await p
    })
    it("waits when tokens exhausted", async() => {
        let limiter = new RateLimiter(60, 1)
        await limiter.acquire()
        let p = limiter.acquire()
        await vi.advanceTimersByTimeAsync(900)
        let settled = false
        p.then(() => { settled = true })
        await Promise.resolve()
        expect(settled).toBe(false)
        await vi.advanceTimersByTimeAsync(200)
        await p
        expect(settled).toBe(true)
    })
    it("refills tokens over time", async() => {
        let limiter = new RateLimiter(60, 1)
        await limiter.acquire()
        let p = limiter.acquire()
        await vi.advanceTimersByTimeAsync(1100)
        await p
    })
    it("does not exceed burst size after refill", async() => {
        let limiter = new RateLimiter(60, 2)
        await limiter.acquire()
        await limiter.acquire()
        await vi.advanceTimersByTimeAsync(60000)
        await limiter.acquire()
        await limiter.acquire()
        let p = limiter.acquire()
        await vi.advanceTimersByTimeAsync(1100)
        await p
    })
    it("handles many concurrent acquires", async() => {
        let limiter = new RateLimiter(60, 1)
        let promises: Promise<void>[] = []
        for (let i = 0; i < 3; i++) {
            promises.push(limiter.acquire())
        }
        for (let i = 0; i < 2; i++) {
            await vi.advanceTimersByTimeAsync(1100)
        }
        await Promise.all(promises)
    })
    it("rejects when signal already aborted", async() => {
        let limiter = new RateLimiter(60, 1)
        let controller = new AbortController()
        controller.abort()
        await expect(limiter.acquire(controller.signal)).rejects.toThrow("Rate limit acquire aborted")
    })
    it("detects abort after wait completes", async() => {
        let limiter = new RateLimiter(60, 1)
        await limiter.acquire()
        let controller = new AbortController()
        let caught: Error|undefined
        limiter.acquire(controller.signal).catch((e: Error) => { caught = e })
        controller.abort()
        await vi.advanceTimersByTimeAsync(1100)
        expect(caught!.message).toBe("Rate limit acquire aborted")
    })
})
describe("RateLimiter pause", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
    })
    it("pauses after rate limit response", async() => {
        let limiter = new RateLimiter(60, 10)
        limiter.handleRateLimitResponse(2)
        let p = limiter.acquire()
        await vi.advanceTimersByTimeAsync(2100)
        await p
    })
    it("uses default pause duration when not specified", async() => {
        let limiter = new RateLimiter(60, 10)
        limiter.handleRateLimitResponse()
        let p = limiter.acquire()
        await vi.advanceTimersByTimeAsync(5100)
        await p
    })
    it("ignores non-positive retry after values", async() => {
        let limiter = new RateLimiter(60, 10)
        limiter.handleRateLimitResponse(-1)
        let p = limiter.acquire()
        await vi.advanceTimersByTimeAsync(5100)
        await p
    })
    it("zeros tokens on rate limit response", async() => {
        let limiter = new RateLimiter(60, 10)
        await limiter.acquire()
        limiter.handleRateLimitResponse(1)
        let p = limiter.acquire()
        await vi.advanceTimersByTimeAsync(2100)
        await p
    })
    it("clamps pause wait to max wait ms", async() => {
        let limiter = new RateLimiter(60, 10, 500)
        limiter.handleRateLimitResponse(1000)
        let p = limiter.acquire()
        await vi.advanceTimersByTimeAsync(1500)
        await p
    })
})
describe("RateLimiter rate management", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
    })
    it("updates tokens per minute", async() => {
        let limiter = new RateLimiter(60, 10)
        limiter.setRate(120)
        await limiter.acquire()
        let p = limiter.acquire()
        await vi.advanceTimersByTimeAsync(600)
        await p
    })
    it("clamps rate to minimum of 1", async() => {
        let limiter = new RateLimiter(60, 10)
        limiter.setRate(0)
        await limiter.acquire()
        let p = limiter.acquire()
        await vi.advanceTimersByTimeAsync(61000)
        await p
    })
    it("does not increase tokens beyond burst when setting rate", () => {
        let limiter = new RateLimiter(60, 2)
        limiter.setRate(120)
        expect(limiter.isActive).toBe(true)
    })
    it("resets tokens to burst", async() => {
        let limiter = new RateLimiter(60, 2)
        await limiter.acquire()
        await limiter.acquire()
        limiter.reset()
        await limiter.acquire()
    })
    it("clears pause on reset", async() => {
        let limiter = new RateLimiter(60, 10)
        limiter.handleRateLimitResponse(10)
        limiter.reset()
        await limiter.acquire()
    })
    it("updates last refill on reset", async() => {
        let limiter = new RateLimiter(60, 1)
        await limiter.acquire()
        limiter.reset()
        await limiter.acquire()
    })
})
describe("RateLimiter edge cases", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
    })
    it("handles very high tokens per minute", async() => {
        let limiter = new RateLimiter(1000000, 1)
        await limiter.acquire()
        let p = limiter.acquire()
        await vi.advanceTimersByTimeAsync(1)
        await p
    })
    it("allows re-enable after disable", async() => {
        let limiter = new RateLimiter()
        limiter.disable()
        limiter.enable()
        await expect(limiter.acquire()).resolves.toBeUndefined()
    })
    it("waits for pause to finish before refilling", async() => {
        let limiter = new RateLimiter(60, 10)
        limiter.handleRateLimitResponse(1)
        let p = limiter.acquire()
        await vi.advanceTimersByTimeAsync(1100)
        await p
    })
    it("returns immediately when enough time passed since last acquire", async() => {
        let limiter = new RateLimiter(60, 1)
        await limiter.acquire()
        await vi.advanceTimersByTimeAsync(61000)
        await expect(limiter.acquire()).resolves.toBeUndefined()
    })
    it("multiple rate limit responses extend pause", async() => {
        let limiter = new RateLimiter(60, 10)
        limiter.handleRateLimitResponse(2)
        limiter.handleRateLimitResponse(3)
        let p = limiter.acquire()
        await vi.advanceTimersByTimeAsync(3100)
        await p
    })
})
