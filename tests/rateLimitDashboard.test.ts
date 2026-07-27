// @vitest-environment node
import { describe, it, expect, vi } from "vitest"
import { RateLimitTracker, RateLimitStatus, parseRateLimitHeaders } from "../src/core/rateLimitDashboard.js"
function makeHeaders(overrides: Record<string, string|number>={}): Record<string, string|number>{
    return {
        "x-ratelimit-limit": 100,
        "x-ratelimit-remaining": 95,
        "x-ratelimit-reset": 60,
        ...overrides
    }
}
describe("parseRateLimitHeaders", () => {
    it("parses standard headers", () => {
        let parsed=parseRateLimitHeaders(makeHeaders())
        expect(parsed.limit).toBe(100)
        expect(parsed.remaining).toBe(95)
        expect(parsed.resetAt).toBeGreaterThan(Date.now())
        expect(parsed.retryAfter).toBeUndefined()
    })
    it("parses retry-after seconds", () => {
        vi.useFakeTimers()
        try{
            vi.setSystemTime(1000000000000)
            let parsed=parseRateLimitHeaders({"retry-after": 120})
            expect(parsed.retryAfter).toBe(120)
            expect(parsed.resetAt).toBe(1000000000000+120000)
        }
        finally{
            vi.useRealTimers()
        }
    })
    it("parses retry-after date", () => {
        vi.useFakeTimers()
        try{
            let now=Math.floor(Date.now()/1000)*1000
            vi.setSystemTime(now)
            let date=new Date(now+90000)
            let parsed=parseRateLimitHeaders({"retry-after": date.toUTCString()})
            expect(parsed.retryAfter).toBe(90)
            expect(parsed.resetAt).toBe(date.getTime())
        }
        finally{
            vi.useRealTimers()
        }
    })
    it("parses x-ratelimit-reset as epoch seconds", () => {
        vi.useFakeTimers()
        try{
            let epochSeconds=2000000000
            vi.setSystemTime(epochSeconds*1000-5000)
            let parsed=parseRateLimitHeaders({"x-ratelimit-reset": epochSeconds})
            expect(parsed.resetAt).toBe(epochSeconds*1000)
        }
        finally{
            vi.useRealTimers()
        }
    })
    it("parses x-ratelimit-reset as relative seconds", () => {
        vi.useFakeTimers()
        try{
            let now=1000000000000
            vi.setSystemTime(now)
            let parsed=parseRateLimitHeaders({"x-ratelimit-reset": 45})
            expect(parsed.resetAt).toBe(now+45000)
        }
        finally{
            vi.useRealTimers()
        }
    })
    it("computes remaining from x-ratelimit-used", () => {
        let parsed=parseRateLimitHeaders({
            "x-ratelimit-limit": 100,
            "x-ratelimit-used": 30
        })
        expect(parsed.limit).toBe(100)
        expect(parsed.remaining).toBe(70)
    })
    it("returns defaults for empty headers", () => {
        let parsed=parseRateLimitHeaders({})
        expect(parsed.limit).toBe(0)
        expect(parsed.remaining).toBe(0)
        expect(parsed.resetAt).toBe(0)
        expect(parsed.retryAfter).toBeUndefined()
    })
})
describe("RateLimitTracker recordResponse", () => {
    it("records standard headers", () => {
        let tracker=new RateLimitTracker()
        tracker.recordResponse("openai", makeHeaders())
        let status=tracker.getStatus("openai") as RateLimitStatus
        expect(status.provider).toBe("openai")
        expect(status.limit).toBe(100)
        expect(status.remaining).toBe(95)
        expect(status.usedPercent).toBe(5)
    })
    it("records retry-after seconds", () => {
        vi.useFakeTimers()
        try{
            vi.setSystemTime(1000000000000)
            let tracker=new RateLimitTracker()
            tracker.recordResponse("openai", {"retry-after": 30})
            let status=tracker.getStatus("openai") as RateLimitStatus
            expect(status.retryAfter).toBe(30)
            expect(status.resetAt).toBe(1000000000000+30000)
        }
        finally{
            vi.useRealTimers()
        }
    })
    it("records retry-after date", () => {
        vi.useFakeTimers()
        try{
            let now=Math.floor(Date.now()/1000)*1000
            vi.setSystemTime(now)
            let date=new Date(now+120000)
            let tracker=new RateLimitTracker()
            tracker.recordResponse("openai", {"retry-after": date.toUTCString()})
            let status=tracker.getStatus("openai") as RateLimitStatus
            expect(status.retryAfter).toBe(120)
            expect(status.resetAt).toBe(date.getTime())
        }
        finally{
            vi.useRealTimers()
        }
    })
    it("uses windowMs fallback when headers lack reset", () => {
        vi.useFakeTimers()
        try{
            let now=1000000000000
            vi.setSystemTime(now)
            let tracker=new RateLimitTracker({windowMs: 30000})
            tracker.recordResponse("openai", {"x-ratelimit-limit": 100, "x-ratelimit-remaining": 80})
            let status=tracker.getStatus("openai") as RateLimitStatus
            expect(status.resetAt).toBe(now+30000)
        }
        finally{
            vi.useRealTimers()
        }
    })
    it("overwrites previous status", () => {
        let tracker=new RateLimitTracker()
        tracker.recordResponse("openai", makeHeaders({"x-ratelimit-remaining": 0}))
        expect(tracker.isRateLimited("openai")).toBe(true)
        tracker.recordResponse("openai", makeHeaders({"x-ratelimit-remaining": 50}))
        expect(tracker.isRateLimited("openai")).toBe(false)
    })
})
describe("RateLimitTracker getStatus", () => {
    it("returns provider status", () => {
        let tracker=new RateLimitTracker()
        tracker.recordResponse("openai", makeHeaders())
        let status=tracker.getStatus("openai") as RateLimitStatus
        expect(status.provider).toBe("openai")
        expect(status.limit).toBe(100)
    })
    it("returns all providers when no provider given", () => {
        let tracker=new RateLimitTracker()
        tracker.recordResponse("openai", makeHeaders())
        tracker.recordResponse("anthropic", makeHeaders({"x-ratelimit-limit": 200, "x-ratelimit-remaining": 150}))
        let statuses=tracker.getStatus() as RateLimitStatus[]
        expect(statuses.length).toBe(2)
        expect(statuses[0].provider).toBe("openai")
        expect(statuses[1].provider).toBe("anthropic")
    })
    it("returns defaults for unknown provider", () => {
        let tracker=new RateLimitTracker()
        let status=tracker.getStatus("unknown") as RateLimitStatus
        expect(status.provider).toBe("unknown")
        expect(status.limit).toBe(0)
        expect(status.remaining).toBe(0)
        expect(status.resetAt).toBe(0)
        expect(status.usedPercent).toBe(0)
    })
})
describe("RateLimitTracker isRateLimited", () => {
    it("returns true when remaining is 0", () => {
        let tracker=new RateLimitTracker()
        tracker.recordResponse("openai", makeHeaders({"x-ratelimit-remaining": 0}))
        expect(tracker.isRateLimited("openai")).toBe(true)
    })
    it("returns false when remaining is positive", () => {
        let tracker=new RateLimitTracker()
        tracker.recordResponse("openai", makeHeaders({"x-ratelimit-remaining": 10}))
        expect(tracker.isRateLimited("openai")).toBe(false)
    })
    it("returns true for unknown provider", () => {
        let tracker=new RateLimitTracker()
        expect(tracker.isRateLimited("unknown")).toBe(true)
    })
})
describe("RateLimitTracker getTimeToReset", () => {
    it("computes time to reset", () => {
        vi.useFakeTimers()
        try{
            let now=1000000000000
            vi.setSystemTime(now)
            let tracker=new RateLimitTracker()
            tracker.recordResponse("openai", makeHeaders({"x-ratelimit-reset": 60}))
            expect(tracker.getTimeToReset("openai")).toBe(60000)
        }
        finally{
            vi.useRealTimers()
        }
    })
    it("returns 0 for unknown provider", () => {
        let tracker=new RateLimitTracker()
        expect(tracker.getTimeToReset("unknown")).toBe(0)
    })
    it("returns 0 after reset passes", () => {
        vi.useFakeTimers()
        try{
            vi.setSystemTime(1000000000000)
            let tracker=new RateLimitTracker()
            tracker.recordResponse("openai", makeHeaders({"x-ratelimit-reset": 30}))
            vi.advanceTimersByTime(60000)
            expect(tracker.getTimeToReset("openai")).toBe(0)
        }
        finally{
            vi.useRealTimers()
        }
    })
})
describe("RateLimitTracker getDashboardData", () => {
    it("returns all provider statuses", () => {
        let tracker=new RateLimitTracker()
        tracker.recordResponse("openai", makeHeaders())
        tracker.recordResponse("anthropic", makeHeaders({"x-ratelimit-limit": 200, "x-ratelimit-remaining": 150}))
        let data=tracker.getDashboardData()
        expect(data.length).toBe(2)
        expect(data.map((s) => s.provider).sort()).toEqual(["anthropic", "openai"])
    })
    it("computes usedPercent correctly", () => {
        let tracker=new RateLimitTracker()
        tracker.recordResponse("openai", makeHeaders({"x-ratelimit-limit": 100, "x-ratelimit-remaining": 75}))
        let status=tracker.getDashboardData().find((s) => s.provider==="openai") as RateLimitStatus
        expect(status.usedPercent).toBe(25)
    })
    it("uses zero usedPercent when limit is zero", () => {
        let tracker=new RateLimitTracker()
        tracker.recordResponse("openai", {"retry-after": 10})
        let status=tracker.getDashboardData()[0]
        expect(status.usedPercent).toBe(0)
    })
})
