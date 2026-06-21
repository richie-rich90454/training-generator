export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string  // ISO 8601
  level: LogLevel
  module: string
  message: string
  context?: Record<string, unknown>
}

export class Logger {
  private entries: LogEntry[] = []
  private listeners: Array<(entry: LogEntry) => void> = []

  private createEntry(level: LogLevel, module: string, message: string, context?: Record<string, unknown>): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      ...(context ? { context } : {})
    }
    this.entries.push(entry)
    for (const listener of this.listeners) {
      try {
        listener(entry)
      } catch {
        // Silently ignore listener errors
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

  getEntries(): LogEntry[] {
    return [...this.entries]
  }

  getEntriesByLevel(level: LogLevel): LogEntry[] {
    return this.entries.filter(e => e.level === level)
  }

  getEntriesByModule(module: string): LogEntry[] {
    return this.entries.filter(e => e.module === module)
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