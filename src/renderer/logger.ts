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
  private readonly maxListeners = 100

  private redactPII(text: string): string {
    return text
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[REDACTED_PHONE]')
      .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[REDACTED_CC]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]')
      .replace(/\b(?:sk|pk|key|token|apikey|api_key|access_token)[-_\s]?[A-Za-z0-9]{20,}\b/gi, '[REDACTED_KEY]')
  }

  private redactContext(context: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const key in context) {
      const value = context[key]
      if (typeof value === 'string') {
        result[key] = this.redactPII(value)
      } else {
        result[key] = value
      }
    }
    return result
  }

  private createEntry(level: LogLevel, module: string, message: string, context?: Record<string, unknown>): LogEntry | null {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return null
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message: this.redactPII(message),
      ...(context ? { context: this.redactContext(context) } : {})
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
    if (this.listeners.length >= this.maxListeners) {
      this.listeners.shift()
    }
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

export const logger = {
  warn(message: string, ...args: unknown[]): void {
    console.warn(message, ...args)
  }
}
