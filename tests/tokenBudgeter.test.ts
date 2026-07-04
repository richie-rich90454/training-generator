// @vitest-environment node
import { describe, it, expect } from "vitest"
import { estimateTokens, tokenizeApprox, TokenBudgeter, planChunkBudget, DEFAULT_TOKEN_BUDGET } from "../src/renderer/tokenBudgeter.js"
describe("estimateTokens", ()=>{
    it("should return 0 for empty string", ()=>{
        expect(estimateTokens("")).toBe(0)
    })
    it("should estimate ASCII text at 4 chars per token", ()=>{
        expect(estimateTokens("hello world")).toBe(3)
        expect(estimateTokens("abcd")).toBe(1)
        expect(estimateTokens("abcde")).toBe(2)
    })
    it("should estimate CJK chars at roughly 1 char per token", ()=>{
        expect(estimateTokens("你好世界")).toBe(4)
        expect(estimateTokens("你")).toBe(1)
    })
    it("should handle mixed CJK and ASCII text", ()=>{
        expect(estimateTokens("abc你好")).toBe(3)
    })
})
describe("tokenizeApprox", ()=>{
    it("should split on whitespace", ()=>{
        expect(tokenizeApprox("hello world")).toEqual(["hello", "world"])
        expect(tokenizeApprox("a b c")).toEqual(["a", "b", "c"])
    })
    it("should return empty array for empty string", ()=>{
        expect(tokenizeApprox("")).toEqual([])
        expect(tokenizeApprox("   ")).toEqual([])
    })
})
describe("TokenBudgeter allocate", ()=>{
    it("should allocate output tokens on happy path", ()=>{
        let b=new TokenBudgeter({maxSessionTokens:10000, reservePromptTokens:1000, maxOutputTokens:2000, minOutputTokens:100})
        expect(b.allocate(500)).toBe(2000)
    })
    it("should return 0 when budget exhausted", ()=>{
        let b=new TokenBudgeter({maxSessionTokens:1000, reservePromptTokens:100, maxOutputTokens:500, minOutputTokens:100})
        b.consume(1000)
        expect(b.allocate(100)).toBe(0)
    })
    it("should respect maxOutputTokens cap", ()=>{
        let b=new TokenBudgeter({maxSessionTokens:100000, reservePromptTokens:0, maxOutputTokens:500, minOutputTokens:100})
        expect(b.allocate(100)).toBe(500)
    })
    it("should respect minOutputTokens floor", ()=>{
        let b=new TokenBudgeter({maxSessionTokens:1000, reservePromptTokens:0, maxOutputTokens:500, minOutputTokens:100})
        expect(b.allocate(950)).toBe(100)
    })
})
describe("TokenBudgeter tracking", ()=>{
    it("should increase used counter on consume", ()=>{
        let b=new TokenBudgeter({maxSessionTokens:10000, reservePromptTokens:0, maxOutputTokens:2000, minOutputTokens:100})
        b.consume(500)
        expect(b.getStats().used).toBe(500)
    })
    it("should decrease remaining after consume", ()=>{
        let b=new TokenBudgeter({maxSessionTokens:10000, reservePromptTokens:0, maxOutputTokens:2000, minOutputTokens:100})
        expect(b.remaining()).toBe(10000)
        b.consume(3000)
        expect(b.remaining()).toBe(7000)
    })
    it("should report exhausted when over budget", ()=>{
        let b=new TokenBudgeter({maxSessionTokens:1000, reservePromptTokens:0, maxOutputTokens:500, minOutputTokens:100})
        b.consume(1000)
        expect(b.isExhausted()).toBe(true)
        b.consume(1)
        expect(b.isExhausted()).toBe(true)
    })
    it("should reset used counter", ()=>{
        let b=new TokenBudgeter({maxSessionTokens:10000, reservePromptTokens:0, maxOutputTokens:2000, minOutputTokens:100})
        b.consume(5000)
        b.reset()
        expect(b.getStats().used).toBe(0)
        expect(b.remaining()).toBe(10000)
    })
    it("should compute percentUsed in getStats", ()=>{
        let b=new TokenBudgeter({maxSessionTokens:1000, reservePromptTokens:0, maxOutputTokens:500, minOutputTokens:100})
        b.consume(250)
        let stats=b.getStats()
        expect(stats.percentUsed).toBe(25)
        expect(stats.used).toBe(250)
        expect(stats.remaining).toBe(750)
        expect(stats.total).toBe(1000)
    })
})
describe("allocateBatch", ()=>{
    it("should return array of correct length", ()=>{
        let b=new TokenBudgeter({maxSessionTokens:5000, reservePromptTokens:0, maxOutputTokens:1000, minOutputTokens:100})
        let items=[{promptTokens:500}, {promptTokens:500}, {promptTokens:500}]
        let result=b.allocateBatch(items)
        expect(result.length).toBe(3)
    })
    it("should stop allocating when exhausted", ()=>{
        let b=new TokenBudgeter({maxSessionTokens:2000, reservePromptTokens:0, maxOutputTokens:1000, minOutputTokens:100})
        let items=[{promptTokens:500}, {promptTokens:500}, {promptTokens:500}]
        let result=b.allocateBatch(items)
        expect(result[0]).toBe(1000)
        expect(result[1]).toBe(0)
        expect(result[2]).toBe(0)
    })
})
describe("allocateSmart", ()=>{
    it("should distribute proportionally to priority", ()=>{
        let b=new TokenBudgeter({maxSessionTokens:10000, reservePromptTokens:0, maxOutputTokens:10000, minOutputTokens:100})
        let items=[{promptTokens:100, priority:1}, {promptTokens:100, priority:3}]
        let result=b.allocateSmart(items)
        expect(result[1]).toBeGreaterThan(result[0])
        expect(result[0]).toBe(2450)
        expect(result[1]).toBe(7350)
    })
    it("should handle equal priority", ()=>{
        let b=new TokenBudgeter({maxSessionTokens:10000, reservePromptTokens:0, maxOutputTokens:10000, minOutputTokens:100})
        let items=[{promptTokens:100, priority:1}, {promptTokens:100, priority:1}]
        let result=b.allocateSmart(items)
        expect(result[0]).toBe(result[1])
        expect(result[0]).toBe(4900)
    })
})
describe("planChunkBudget", ()=>{
    it("should plan allocation across chunks on happy path", ()=>{
        let config={maxSessionTokens:10000, reservePromptTokens:0, maxOutputTokens:2000, minOutputTokens:100}
        let chunks=[{text:"hello world"}, {text:"foo bar"}]
        let result=planChunkBudget(chunks, config)
        expect(result.length).toBe(2)
        expect(result[0].chunkIndex).toBe(0)
        expect(result[0].skipped).toBe(false)
        expect(result[0].outputTokens).toBe(2000)
        expect(result[0].promptTokens).toBe(3)
        expect(result[1].chunkIndex).toBe(1)
        expect(result[1].skipped).toBe(false)
        expect(result[1].outputTokens).toBe(2000)
    })
    it("should skip oversized chunks", ()=>{
        let config={maxSessionTokens:100, reservePromptTokens:0, maxOutputTokens:2000, minOutputTokens:100}
        let chunks=[{text:"a".repeat(500)}]
        let result=planChunkBudget(chunks, config)
        expect(result.length).toBe(1)
        expect(result[0].skipped).toBe(true)
        expect(result[0].outputTokens).toBe(0)
        expect(result[0].promptTokens).toBe(125)
    })
    it("should handle empty array", ()=>{
        let config={maxSessionTokens:10000, reservePromptTokens:0, maxOutputTokens:2000, minOutputTokens:100}
        let result=planChunkBudget([], config)
        expect(result).toEqual([])
    })
})
describe("DEFAULT_TOKEN_BUDGET", ()=>{
    it("should have expected fields", ()=>{
        expect(DEFAULT_TOKEN_BUDGET.maxSessionTokens).toBe(1000000)
        expect(DEFAULT_TOKEN_BUDGET.reservePromptTokens).toBe(8192)
        expect(DEFAULT_TOKEN_BUDGET.maxOutputTokens).toBe(16384)
        expect(DEFAULT_TOKEN_BUDGET.minOutputTokens).toBe(256)
    })
})
