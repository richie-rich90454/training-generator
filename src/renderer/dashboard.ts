export interface DashboardMetrics {
  chunksDone: number
  chunksTotal: number
  chunksPerSecond: number
  tokensPerSecond: number
  totalTokens: number
  cacheHitRate: number
  providerLatency: number
  activeProvider: string
  eta: string
  elapsed: string
}

export class Dashboard {
  private container: HTMLElement
  visible: boolean = false
  private updateInterval: number | null = null
  private startTime: number = 0
  private focusTrapHandler: ((e: Event) => void) | null = null
  private keydownHandler: ((e: Event) => void) | null = null
  private lastFocusedElement: HTMLElement | null = null
  private metrics: DashboardMetrics = {
    chunksDone: 0, chunksTotal: 0, chunksPerSecond: 0,
    tokensPerSecond: 0, totalTokens: 0, eta: "--", cacheHitRate: 0,
    providerLatency: 0, activeProvider: "--", elapsed: "0s"
  }

  constructor() {
    this.container = this.createContainer()
    document.body.appendChild(this.container)
  }

  private createContainer(): HTMLElement {
    let el = document.createElement("div")
    el.id = "dashboard-overlay"
    el.className = "dashboard-overlay"
    el.setAttribute("role", "dialog")
    el.setAttribute("aria-modal", "true")
    el.setAttribute("aria-label", "Processing dashboard")
    el.style.display = "none"
    el.innerHTML = `
      <div class="dashboard-panel" role="document">
        <div class="dashboard-header">
          <h3><i class="fas fa-tachometer-alt"></i> Processing Dashboard</h3>
          <button class="dashboard-close" aria-label="Close dashboard">&times;</button>
        </div>
        <div class="dashboard-body">
          <table>
            <tr><td>Chunks:</td><td id="dash-chunks">0 / 0</td></tr>
            <tr><td>Chunks/s:</td><td id="dash-cps">0</td></tr>
            <tr><td>Tokens/s:</td><td id="dash-tps">0</td></tr>
            <tr><td>Cache Hit Rate:</td><td id="dash-cache">0%</td></tr>
            <tr><td>Provider Latency:</td><td id="dash-latency">0 ms</td></tr>
            <tr><td>Active Provider:</td><td id="dash-provider">--</td></tr>
            <tr><td>ETA:</td><td id="dash-eta">--</td></tr>
            <tr><td>Elapsed:</td><td id="dash-elapsed">0s</td></tr>
          </table>
        </div>
      </div>
    `
    el.querySelector(".dashboard-close")!.addEventListener("click", () => this.hide())
    return el
  }

  show(): void {
    this.visible = true
    this.container.style.display = "block"
    this.lastFocusedElement = document.activeElement as HTMLElement
    this.trapFocus()
    let focusable = this.container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    )
    if (focusable.length > 0) {
      focusable[0].focus()
    }
  }

  hide(): void {
    this.visible = false
    this.container.style.display = "none"
    this.removeFocusTrap()
    if (this.lastFocusedElement && document.contains(this.lastFocusedElement)) {
      this.lastFocusedElement.focus()
      this.lastFocusedElement = null
    }
  }

  toggle(): void {
    if (this.visible) {
      this.hide()
    } else {
      this.show()
    }
  }

  update(metrics: Partial<DashboardMetrics>): void {
    Object.assign(this.metrics, metrics)
    this.render()
  }

  start(intervalMs: number = 500): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
    this.startTime = Date.now()
    this.metrics.chunksDone = 0
    this.metrics.chunksTotal = 0
    this.metrics.chunksPerSecond = 0
    this.metrics.tokensPerSecond = 0
    this.metrics.totalTokens = 0
    this.metrics.eta = "--"
    this.metrics.elapsed = "0s"
    this.metrics.cacheHitRate = 0
    this.metrics.providerLatency = 0
    this.metrics.activeProvider = "--"
    this.show()
    this.updateInterval = window.setInterval(() => this.tick(), intervalMs)
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
    this.hide()
  }

  private tick(): void {
    if (!this.visible) return
    let elapsed = (Date.now() - this.startTime) / 1000
    this.metrics.chunksPerSecond = elapsed > 0 ? Math.round(this.metrics.chunksDone / elapsed) : 0
    this.metrics.elapsed = this.formatDuration(elapsed * 1000)
    this.metrics.tokensPerSecond = elapsed > 0 && this.metrics.totalTokens > 0
      ? Math.round(this.metrics.totalTokens / elapsed)
      : 0
    if (this.metrics.chunksPerSecond > 0 && this.metrics.chunksTotal > 0) {
      let remaining = this.metrics.chunksTotal - this.metrics.chunksDone
      let etaSeconds = remaining / this.metrics.chunksPerSecond
      this.metrics.eta = this.formatDuration(etaSeconds * 1000)
    }
    this.render()
  }

  private render(): void {
    let set = (id: string, value: string) => {
      let el = this.container.querySelector("#" + id)
      if (el) el.textContent = value
    }
    set("dash-chunks", `${this.metrics.chunksDone} / ${this.metrics.chunksTotal}`)
    set("dash-cps", String(this.metrics.chunksPerSecond))
    set("dash-tps", String(this.metrics.tokensPerSecond))
    set("dash-cache", `${this.metrics.cacheHitRate}%`)
    set("dash-latency", `${this.metrics.providerLatency} ms`)
    set("dash-provider", this.metrics.activeProvider)
    set("dash-eta", this.metrics.eta)
    set("dash-elapsed", this.metrics.elapsed)
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

  private trapFocus(): void {
    if (this.focusTrapHandler) return
    let selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    this.focusTrapHandler = (e: Event) => {
      let ke = e as KeyboardEvent
      if (ke.key !== "Tab") return
      let focusable = Array.from(this.container.querySelectorAll<HTMLElement>(selector))
      if (focusable.length === 0) return
      let first = focusable[0]
      let last = focusable[focusable.length - 1]
      if (ke.shiftKey && document.activeElement === first) {
        ke.preventDefault()
        last.focus()
      } else if (!ke.shiftKey && document.activeElement === last) {
        ke.preventDefault()
        first.focus()
      }
    }
    this.keydownHandler = (e: Event) => {
      let ke = e as KeyboardEvent
      if (ke.key === "Escape") {
        ke.preventDefault()
        this.hide()
      }
    }
    document.addEventListener("keydown", this.focusTrapHandler)
    document.addEventListener("keydown", this.keydownHandler)
  }

  private removeFocusTrap(): void {
    if (this.focusTrapHandler) {
      document.removeEventListener("keydown", this.focusTrapHandler)
      this.focusTrapHandler = null
    }
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler)
      this.keydownHandler = null
    }
  }
}
