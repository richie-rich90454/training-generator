export interface AuditEntry {
  operation: string
  timestamp: string
  details?: Record<string, unknown>
}

export class AuditTrail {
  private entries: AuditEntry[] = []
  private operations = 0
  private readonly maxEntries = 10000

  record(operation: string, details?: Record<string, unknown>): void {
    this.entries.push({
      operation,
      timestamp: new Date().toISOString(),
      details
    })
    this.operations++
    if (this.entries.length > this.maxEntries) {
      this.entries.shift()
    }
  }

  getEntries(): AuditEntry[] {
    return [...this.entries]
  }

  getSummary(): { totalOperations: number; operations: Record<string, number> } {
    let ops: Record<string, number> = {}
    for (let entry of this.entries) {
      ops[entry.operation] = (ops[entry.operation] || 0) + 1
    }
    return { totalOperations: this.operations, operations: ops }
  }

  exportJSONL(): string {
    return this.entries.map(e => JSON.stringify(e)).join("\n")
  }

  clear(): void {
    this.entries = []
    this.operations = 0
  }
}
