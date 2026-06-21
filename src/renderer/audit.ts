export interface AuditEntry {
  operation: string
  timestamp: string  // ISO 8601
  details?: Record<string, unknown>
}

export class AuditTrail {
  private entries: AuditEntry[] = []
  
  record(operation: string, details?: Record<string, unknown>): void {
    this.entries.push({
      operation,
      timestamp: new Date().toISOString(),
      details
    })
  }
  
  getEntries(): AuditEntry[] {
    return [...this.entries]
  }
  
  getSummary(): { totalOperations: number; operations: Record<string, number> } {
    let ops: Record<string, number> = {}
    for (let entry of this.entries) {
      ops[entry.operation] = (ops[entry.operation] || 0) + 1
    }
    return { totalOperations: this.entries.length, operations: ops }
  }
  
  exportJSONL(): string {
    return this.entries.map(e => JSON.stringify(e)).join("\n")
  }
  
  clear(): void {
    this.entries = []
  }
}