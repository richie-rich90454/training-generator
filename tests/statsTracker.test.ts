// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest"
import { StatsTracker } from "../src/renderer/statsTracker.js"

describe("StatsTracker", () => {
  let tracker: StatsTracker

  beforeEach(() => {
    tracker = new StatsTracker()
  })

  it("should initialize with zero values", () => {
    expect(tracker.totalChunks).toBe(0)
    expect(tracker.successfulChunks).toBe(0)
    expect(tracker.failedChunks).toBe(0)
    expect(tracker.totalTokens).toBe(0)
    expect(tracker.startTime).toBe(0)
    expect(tracker.endTime).toBe(0)
    expect(tracker.deduplicatedCount).toBe(0)
  })

  it("should set startTime on start()", () => {
    tracker.start()
    expect(tracker.startTime).toBeGreaterThan(0)
    expect(tracker.totalChunks).toBe(0)
    expect(tracker.successfulChunks).toBe(0)
  })

  it("should reset all values on start()", () => {
    tracker.recordChunkSuccess(100)
    tracker.recordChunkFailure()
    tracker.start()
    expect(tracker.totalChunks).toBe(0)
    expect(tracker.successfulChunks).toBe(0)
    expect(tracker.failedChunks).toBe(0)
    expect(tracker.totalTokens).toBe(0)
  })

  it("should set endTime on finish()", () => {
    tracker.start()
    tracker.finish()
    expect(tracker.endTime).toBeGreaterThan(0)
  })

  it("should record successful chunk", () => {
    tracker.recordChunkSuccess(50)
    expect(tracker.totalChunks).toBe(1)
    expect(tracker.successfulChunks).toBe(1)
    expect(tracker.failedChunks).toBe(0)
    expect(tracker.totalTokens).toBe(50)
  })

  it("should record multiple successful chunks", () => {
    tracker.recordChunkSuccess(10)
    tracker.recordChunkSuccess(20)
    tracker.recordChunkSuccess(30)
    expect(tracker.totalChunks).toBe(3)
    expect(tracker.successfulChunks).toBe(3)
    expect(tracker.totalTokens).toBe(60)
  })

  it("should record failed chunk", () => {
    tracker.recordChunkFailure()
    expect(tracker.totalChunks).toBe(1)
    expect(tracker.successfulChunks).toBe(0)
    expect(tracker.failedChunks).toBe(1)
    expect(tracker.totalTokens).toBe(0)
  })

  it("should track mixed success and failure", () => {
    tracker.recordChunkSuccess(100)
    tracker.recordChunkFailure()
    tracker.recordChunkSuccess(200)
    expect(tracker.totalChunks).toBe(3)
    expect(tracker.successfulChunks).toBe(2)
    expect(tracker.failedChunks).toBe(1)
    expect(tracker.totalTokens).toBe(300)
  })

  it("should report elapsed time", () => {
    tracker.start()
    expect(tracker.elapsed).toBeGreaterThanOrEqual(0)
  })

  it("should report elapsed time after finish", () => {
    tracker.start()
    tracker.finish()
    expect(tracker.elapsed).toBeGreaterThanOrEqual(0)
  })

  it("should compute success rate as 100% when no chunks", () => {
    expect(tracker.successRate).toBe(100)
  })

  it("should compute success rate correctly", () => {
    tracker.recordChunkSuccess(100)
    tracker.recordChunkSuccess(100)
    tracker.recordChunkFailure()
    expect(tracker.successRate).toBe(67) // 2/3 = 67%
  })

  it("should compute 100% success rate", () => {
    tracker.recordChunkSuccess(100)
    tracker.recordChunkSuccess(100)
    expect(tracker.successRate).toBe(100)
  })

  it("should compute 0% success rate", () => {
    tracker.recordChunkFailure()
    tracker.recordChunkFailure()
    expect(tracker.successRate).toBe(0)
  })

  it("should generate complete report", () => {
    tracker.start()
    tracker.recordChunkSuccess(100)
    tracker.recordChunkSuccess(200)
    tracker.recordChunkFailure()
    tracker.deduplicatedCount = 5
    tracker.finish()

    let report = tracker.report
    expect(report.totalChunks).toBe(3)
    expect(report.successfulChunks).toBe(2)
    expect(report.failedChunks).toBe(1)
    expect(report.successRate).toBe(67)
    expect(report.totalTokens).toBe(300)
    expect(report.elapsedMs).toBeGreaterThanOrEqual(0)
    expect(report.elapsedFormatted).toBeTruthy()
    expect(report.deduplicatedCount).toBe(5)
    expect(report.tokensPerSecond).toBeGreaterThanOrEqual(0)
  })

  it("should format duration in ms", () => {
    tracker.start()
    // Force elapsed to be 500ms
    let report = tracker.report
    expect(report.elapsedFormatted).toMatch(/\d/)
  })

  it("should handle deduplicatedCount", () => {
    tracker.deduplicatedCount = 10
    expect(tracker.deduplicatedCount).toBe(10)
    let report = tracker.report
    expect(report.deduplicatedCount).toBe(10)
  })

  it("should handle tokensPerSecond = 0 when elapsed is 0", () => {
    let report = tracker.report
    expect(report.tokensPerSecond).toBe(0)
  })
})
describe("StatsTracker warnings", () => {
  let tracker: StatsTracker
  beforeEach(() => {
    tracker = new StatsTracker()
  })
  it("should warn on large output count", () => {
    let warnings = tracker.checkWarnings(100001)
    expect(warnings.some(w => w.includes("Large output"))).toBe(true)
  })
  it("should not warn on small output count", () => {
    let warnings = tracker.checkWarnings(100)
    expect(warnings.some(w => w.includes("Large output"))).toBe(false)
  })
  it("should warn on high chunk count", () => {
    tracker.totalChunks = 501
    let warnings = tracker.checkWarnings(0)
    expect(warnings.some(w => w.includes("High chunk count"))).toBe(true)
  })
  it("should not warn on normal chunk count", () => {
    tracker.totalChunks = 100
    let warnings = tracker.checkWarnings(0)
    expect(warnings.some(w => w.includes("High chunk count"))).toBe(false)
  })
  it("should warn on high token usage", () => {
    tracker.promptTokens = 500001
    let warnings = tracker.checkWarnings(0)
    expect(warnings.some(w => w.includes("High token usage"))).toBe(true)
  })
  it("should not warn on normal token usage", () => {
    tracker.promptTokens = 1000
    let warnings = tracker.checkWarnings(0)
    expect(warnings.some(w => w.includes("High token usage"))).toBe(false)
  })
  it("should return multiple warnings", () => {
    tracker.totalChunks = 1000
    tracker.promptTokens = 600000
    let warnings = tracker.checkWarnings(200000)
    expect(warnings.length).toBe(3)
  })
  it("should return empty array when no thresholds crossed", () => {
    tracker.totalChunks = 100
    tracker.promptTokens = 1000
    let warnings = tracker.checkWarnings(100)
    expect(warnings.length).toBe(0)
  })
})
describe("StatsTracker prompt tokens", () => {
  let tracker: StatsTracker
  beforeEach(() => {
    tracker = new StatsTracker()
  })
  it("should count prompt tokens by character length", () => {
    tracker.recordPromptTokens("a".repeat(40))
    expect(tracker.promptTokens).toBe(10)
  })
  it("should accumulate prompt tokens", () => {
    tracker.recordPromptTokens("a".repeat(40))
    tracker.recordPromptTokens("a".repeat(80))
    expect(tracker.promptTokens).toBe(30)
  })
  it("should handle empty prompt", () => {
    tracker.recordPromptTokens("")
    expect(tracker.promptTokens).toBe(0)
  })
})