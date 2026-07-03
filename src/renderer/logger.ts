export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  module: string
  message: string
  context?: Record<string, unknown>
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

export class Logger {
  private entries: LogEntry[] = []
  private listeners: Array<(entry: LogEntry) => void> = []
  private minLevel: LogLevel = 'debug'
  private readonly maxEntries = 10000

  private createEntry(level: LogLevel, module: string, message: string, context?: Record<string, unknown>): LogEntry | null {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return null
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      ...(context ? { context } : {})
    }
    this.entries.push(entry)
    if (this.entries.length > this.maxEntries) {
      this.entries.shift()
    }
    const snapshot = this.listeners.slice()
    for (const listener of snapshot) {
      try {
        listener(entry)
      } catch {
      }
    }
    return entry
  }

  debug(module: string, message: string, context?: Record<string, unknown>): void {
    this.createEntry('debug', module, message, context)
  }

  info(module: string, message: string, context?: Record<string, unknown>): void {
    this.createEntry('info', module, message, context)
  }

  warn(module: string, message: string, context?: Record<string, unknown>): void {
    this.createEntry('warn', module, message, context)
  }

  error(module: string, message: string, context?: Record<string, unknown>): void {
    this.createEntry('error', module, message, context)
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level
  }

  getEntries(): LogEntry[] {
    return this.entries.map(e => this.cloneEntry(e))
  }

  getEntriesByLevel(level: LogLevel): LogEntry[] {
    return this.entries.filter(e => e.level === level).map(e => this.cloneEntry(e))
  }

  getEntriesByModule(module: string): LogEntry[] {
    return this.entries.filter(e => e.module === module).map(e => this.cloneEntry(e))
  }

  private cloneEntry(entry: LogEntry): LogEntry {
    return JSON.parse(JSON.stringify(entry))
  }

  addListener(fn: (entry: LogEntry) => void): void {
    this.listeners.push(fn)
  }

  removeListener(fn: (entry: LogEntry) => void): void {
    const index = this.listeners.indexOf(fn)
    if (index !== -1) {
      this.listeners.splice(index, 1)
    }
  }

  exportJSONL(): string {
    return this.entries.map(e => JSON.stringify(e)).join('\n')
  }

  clear(): void {
    this.entries = []
  }
}
