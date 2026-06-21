import type { LogEntry } from "./logger.js"
import { getCacheStats } from "./cache.js"

export class Devtools {
  private container: HTMLElement
  private visible: boolean = false
  private logFilter: string = "all"
  private logEntries: LogEntry[] = []
  private logOutput: HTMLElement | null = null
  private cacheContent: HTMLElement | null = null
  private workerContent: HTMLElement | null = null
  private memoryContent: HTMLElement | null = null

  constructor() {
    this.container = this.createContainer()
    document.body.appendChild(this.container)
    this.bindEvents()
  }

  private createContainer(): HTMLElement {
    let panel = document.createElement("div")
    panel.id = "devtools-panel"
    panel.className = "devtools-panel"
    panel.style.display = "none"
    panel.innerHTML = `
      <div class="devtools-header">
        <h3>Devtools</h3>
        <button id="devtools-close">&times;</button>
      </div>
      <div class="devtools-tabs">
        <button class="devtools-tab active" data-tab="logs">Logs</button>
        <button class="devtools-tab" data-tab="cache">Cache</button>
        <button class="devtools-tab" data-tab="workers">Workers</button>
        <button class="devtools-tab" data-tab="memory">Memory</button>
      </div>
      <div class="devtools-content">
        <div class="devtools-tab-content active" id="devtools-logs">
          <div class="devtools-log-controls">
            <select id="devtools-log-filter">
              <option value="all">All</option>
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
            <button id="devtools-clear-logs">Clear</button>
          </div>
          <div id="devtools-log-output"></div>
        </div>
        <div class="devtools-tab-content" id="devtools-cache">
          <div id="devtools-cache-content">Loading...</div>
        </div>
        <div class="devtools-tab-content" id="devtools-workers">
          <div id="devtools-worker-content">Loading...</div>
        </div>
        <div class="devtools-tab-content" id="devtools-memory">
          <div id="devtools-memory-content">Loading...</div>
        </div>
      </div>
    `
    this.logOutput = panel.querySelector("#devtools-log-output")
    this.cacheContent = panel.querySelector("#devtools-cache-content")
    this.workerContent = panel.querySelector("#devtools-worker-content")
    this.memoryContent = panel.querySelector("#devtools-memory-content")
    return panel
  }

  private bindEvents(): void {
    let closeBtn = this.container.querySelector("#devtools-close")
    closeBtn?.addEventListener("click", () => this.hide())

    let tabs = this.container.querySelectorAll(".devtools-tab")
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        let tabName = (tab as HTMLElement).dataset.tab
        this.switchTab(tabName || "logs")
      })
    })

    let logFilter = this.container.querySelector("#devtools-log-filter") as HTMLSelectElement | null
    logFilter?.addEventListener("change", () => {
      this.logFilter = logFilter.value
      this.renderLogs()
    })

    let clearLogsBtn = this.container.querySelector("#devtools-clear-logs")
    clearLogsBtn?.addEventListener("click", () => {
      this.logEntries = []
      this.renderLogs()
    })
  }

  private switchTab(tabName: string): void {
    let tabs = this.container.querySelectorAll(".devtools-tab")
    tabs.forEach(t => t.classList.remove("active"))
    let activeTab = this.container.querySelector(`.devtools-tab[data-tab="${tabName}"]`)
    activeTab?.classList.add("active")

    let contents = this.container.querySelectorAll(".devtools-tab-content")
    contents.forEach(c => c.classList.remove("active"))
    let activeContent = this.container.querySelector(`#devtools-${tabName}`)
    activeContent?.classList.add("active")

    if (tabName !== "logs") {
      this.refresh()
    }
  }

  show(): void {
    this.container.style.display = "block"
    this.visible = true
    this.refresh()
  }

  hide(): void {
    this.container.style.display = "none"
    this.visible = false
  }

  toggle(): void {
    this.visible ? this.hide() : this.show()
  }

  addLog(entry: LogEntry): void {
    this.logEntries.push(entry)
    if (this.visible && this.isLogsTabActive()) {
      this.renderLogs()
    }
  }

  private isLogsTabActive(): boolean {
    let logsTab = this.container.querySelector("#devtools-logs")
    return logsTab?.classList.contains("active") ?? false
  }

  private renderLogs(): void {
    if (!this.logOutput) return
    let filtered = this.logEntries
    if (this.logFilter !== "all") {
      filtered = this.logEntries.filter(e => e.level === this.logFilter)
    }
    let html = ""
    for (let entry of filtered) {
      let levelClass = `log-level-${entry.level}`
      let time = new Date(entry.timestamp).toLocaleTimeString()
      html += `<div class="devtools-log-entry ${levelClass}">
        <span class="log-time">${time}</span>
        <span class="log-level">[${entry.level.toUpperCase()}]</span>
        <span class="log-module">${this.escapeHtml(entry.module)}</span>
        <span class="log-message">${this.escapeHtml(entry.message)}</span>
      </div>`
    }
    this.logOutput.innerHTML = html || '<div class="devtools-empty">No log entries</div>'
    this.logOutput.scrollTop = this.logOutput.scrollHeight
  }

  refresh(): void {
    this.updateCacheTab()
    this.updateWorkerTab()
    this.updateMemoryTab()
  }

  private updateCacheTab(): void {
    if (!this.cacheContent) return
    let cs = getCacheStats()
    let hitRate = cs.totalRequests > 0 ? Math.round((cs.hits / cs.totalRequests) * 100) : 0
    this.cacheContent.innerHTML = `
      <table>
        <tr><td>Cache Hits:</td><td>${cs.hits}</td></tr>
        <tr><td>Cache Misses:</td><td>${cs.misses}</td></tr>
        <tr><td>Total Requests:</td><td>${cs.totalRequests}</td></tr>
        <tr><td>Hit Rate:</td><td>${hitRate}%</td></tr>
        <tr><td>Tokens Saved:</td><td>${cs.estimatedTokensSaved.toLocaleString()}</td></tr>
        <tr><td>Est. Cost Saved:</td><td>$${cs.estimatedCostSaved.toFixed(4)}</td></tr>
      </table>
    `
  }

  private updateWorkerTab(): void {
    if (!this.workerContent) return
    let workerCount = typeof Worker !== "undefined" ? 2 : 0
    let workerStatus = typeof Worker !== "undefined"
      ? "Web Workers are available (chunk + dedup workers)"
      : "Web Workers are not supported in this environment"
    this.workerContent.innerHTML = `
      <table>
        <tr><td>Worker Pool:</td><td>${workerCount} workers</td></tr>
        <tr><td>Status:</td><td>${workerStatus}</td></tr>
        <tr><td>Types:</td><td>Chunk Worker, Dedup Worker</td></tr>
      </table>
    `
  }

  private updateMemoryTab(): void {
    if (!this.memoryContent) return
    if (performance && (performance as any).memory) {
      let mem = (performance as any).memory as {
        usedJSHeapSize: number
        totalJSHeapSize: number
        jsHeapSizeLimit: number
      }
      let usedMB = (mem.usedJSHeapSize / 1048576).toFixed(2)
      let totalMB = (mem.totalJSHeapSize / 1048576).toFixed(2)
      let limitMB = (mem.jsHeapSizeLimit / 1048576).toFixed(2)
      let usagePercent = mem.jsHeapSizeLimit > 0
        ? ((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100).toFixed(1)
        : "0"
      this.memoryContent.innerHTML = `
        <table>
          <tr><td>Used Heap:</td><td>${usedMB} MB</td></tr>
          <tr><td>Total Heap:</td><td>${totalMB} MB</td></tr>
          <tr><td>Heap Limit:</td><td>${limitMB} MB</td></tr>
          <tr><td>Usage:</td><td>${usagePercent}%</td></tr>
        </table>
      `
    } else {
      this.memoryContent.innerHTML = `
        <p>performance.memory is not available in this browser.</p>
        <p>Use Chrome/Edge with --enable-precise-memory-info flag for detailed stats.</p>
      `
    }
  }

  private escapeHtml(text: string): string {
    let div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }

  dispose(): void {
    this.logEntries = []
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
  }
}