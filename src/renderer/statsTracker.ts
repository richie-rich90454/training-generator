export class StatsTracker {
  totalChunks: number = 0
  successfulChunks: number = 0
  failedChunks: number = 0
  totalTokens: number = 0
  promptTokens: number = 0
  startTime: number = 0
  endTime: number = 0
  deduplicatedCount: number = 0
  totalLatencyMs: number = 0
  latencySampleCount: number = 0

  start(): void {
    // Idempotent: only reset if not already tracking.
    // Prevents parallel workers from zeroing out cumulative metrics.
    if (this.startTime !== 0) return
    this.startTime = Date.now()
    this.totalChunks = 0
    this.successfulChunks = 0
    this.failedChunks = 0
    this.totalTokens = 0
    this.promptTokens = 0
    this.endTime = 0
    this.deduplicatedCount = 0
    this.totalLatencyMs = 0
    this.latencySampleCount = 0
  }

  finish(): void {
    this.endTime = Date.now()
  }

  recordChunkSuccess(tokens: number): void {
    this.totalChunks++
    this.successfulChunks++
    this.totalTokens += tokens
  }

  recordChunkFailure(): void {
    this.totalChunks++
    this.failedChunks++
  }

  recordPromptTokens(promptText: string): void {
    this.promptTokens += Math.ceil(promptText.length / 4)
  }

  recordLatency(ms: number): void {
    this.totalLatencyMs += ms
    this.latencySampleCount++
  }

  get averageLatencyMs(): number {
    if (this.latencySampleCount === 0) return 0
    return Math.round(this.totalLatencyMs / this.latencySampleCount)
  }

  checkWarnings(outputCount: number): string[] {
    let warnings: string[] = []
    if (outputCount > 100000) {
      warnings.push(`Large output: ${outputCount.toLocaleString("en-US")} items`)
    }
    if (this.totalChunks > 500) {
      warnings.push(`High chunk count: ${this.totalChunks} chunks`)
    }
    if (this.promptTokens > 500000) {
      warnings.push(`High token usage: ${this.promptTokens.toLocaleString("en-US")} prompt tokens`)
    }
    return warnings
  }

  get elapsed(): number {
    return this.endTime ? this.endTime - this.startTime : Date.now() - this.startTime
  }

  get successRate(): number {
    if (this.totalChunks === 0) return 0
    return Math.round((this.successfulChunks / this.totalChunks) * 100)
  }

  get report(): StatsReport {
    let elapsed = this.elapsed
    let tokensPerSecond = 0
    if (this.startTime !== 0 && elapsed >= 100) {
      tokensPerSecond = Math.round(this.totalTokens / (elapsed / 1000))
    }
    return {
      totalChunks: this.totalChunks,
      successfulChunks: this.successfulChunks,
      failedChunks: this.failedChunks,
      successRate: this.successRate,
      totalTokens: this.totalTokens,
      promptTokens: this.promptTokens,
      elapsedMs: elapsed,
      elapsedFormatted: this.formatDuration(elapsed),
      deduplicatedCount: this.deduplicatedCount,
      tokensPerSecond
    }
  }

  private formatDuration(ms: number): string {
    ms = Math.round(ms)
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    let min = Math.floor(ms / 60000)
    let sec = Math.round((ms % 60000) / 1000)
    if (sec >= 60) {
      min += Math.floor(sec / 60)
      sec = sec % 60
    }
    return `${min}m ${sec}s`
  }
}

export interface StatsReport {
  totalChunks: number
  successfulChunks: number
  failedChunks: number
  successRate: number
  totalTokens: number
  promptTokens: number
  elapsedMs: number
  elapsedFormatted: string
  deduplicatedCount: number
  tokensPerSecond: number
}
