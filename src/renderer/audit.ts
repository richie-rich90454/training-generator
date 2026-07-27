export interface AuditEntry {
  operation: string
  timestamp: string
  details?: Record<string, unknown>
  hash?: string
}

export class AuditTrail {
  private entries: AuditEntry[] = []
  private operations = 0
  private readonly maxEntries = 10000
  private prevHash: string = ""

  private computeHash(data: string): string {
    let hash = 5381
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) + hash + data.charCodeAt(i)) | 0
    }
    return (hash >>> 0).toString(16)
  }

  record(operation: string, details?: Record<string, unknown>): void {
    if (!operation || typeof operation !== 'string' || operation.trim().length === 0) return
    const op = operation.length > 200 ? operation.substring(0, 200) : operation
    const entry: AuditEntry = {
      operation: op,
      timestamp: new Date().toISOString(),
      details
    }
    const entryData = JSON.stringify(entry) + this.prevHash
    entry.hash = this.computeHash(entryData)
    this.prevHash = entry.hash
    this.entries.push(entry)
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

  verifyIntegrity(): boolean {
    let prev = ""
    for (const entry of this.entries) {
      const { hash, ...rest } = entry
      const expected = this.computeHash(JSON.stringify(rest) + prev)
      if (hash !== expected) return false
      prev = hash || ""
    }
    return true
  }

  clear(): void {
    this.entries = []
    this.operations = 0
    this.prevHash = ""
  }
}
