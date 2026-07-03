export class RateLimiter {
  private tokens: number
  private lastRefill: number
  private tokensPerMinute: number
  private burstSize: number
  private _isActive: boolean
  private pausedUntil: number
  private maxWaitMs: number

  constructor(tokensPerMinute: number = 60, burstSize: number = 10, maxWaitMs: number = 300000) {
    this.tokensPerMinute = Math.max(1, tokensPerMinute)
    this.burstSize = burstSize
    this.tokens = burstSize
    this.lastRefill = Date.now()
    this._isActive = true
    this.pausedUntil = 0
    this.maxWaitMs = maxWaitMs
  }

  get isActive(): boolean {
    return this._isActive
  }

  async acquire(signal?: AbortSignal): Promise<void> {
    if (!this._isActive) return
    return this._acquireInternal(signal)
  }

  private async _acquireInternal(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw new Error("Rate limit acquire aborted")
    let now = Date.now()
    if (now < this.pausedUntil) {
      let wait = this.pausedUntil - now
      if (wait > this.maxWaitMs) wait = this.maxWaitMs
      await new Promise(resolve => setTimeout(resolve, wait))
      now = Date.now()
    }
    let elapsed = now - this.lastRefill
    if (elapsed > 0) {
      this.tokens = Math.min(this.burstSize, this.tokens + elapsed * (this.tokensPerMinute / 60000))
      this.lastRefill = now
    }
    if (this.tokens >= 1) {
      this.tokens -= 1
      return
    }
    let refillRate = this.tokensPerMinute / 60000
    let waitMs = Math.ceil((1 - this.tokens) / refillRate)
    if (waitMs > this.maxWaitMs) waitMs = this.maxWaitMs
    await new Promise(resolve => setTimeout(resolve, waitMs))
    if (signal?.aborted) throw new Error("Rate limit acquire aborted")
    return this._acquireInternal(signal)
  }

  setRate(tokensPerMinute: number): void {
    this.tokensPerMinute = Math.max(1, tokensPerMinute)
    this.tokens = Math.min(this.tokens, this.burstSize)
  }

  handleRateLimitResponse(retryAfterSeconds?: number): void {
    let seconds = retryAfterSeconds !== undefined && retryAfterSeconds > 0 ? retryAfterSeconds : 5
    this.tokens = 0
    this.pausedUntil = Date.now() + seconds * 1000
    this.lastRefill = Date.now()
  }

  disable(): void {
    this._isActive = false
  }

  enable(): void {
    this._isActive = true
  }

  reset(): void {
    this.tokens = this.burstSize
    this.lastRefill = Date.now()
    this.pausedUntil = 0
  }
}
