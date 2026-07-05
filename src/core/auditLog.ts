import crypto from "crypto"
export interface AuditEntry{
    id: string
    timestamp: number
    action: string
    actor: string
    resource: string
    details: Record<string, unknown>
    prevHash: string
    hash: string
}
export interface AuditStorage{
    getItem(key: string): string|null
    setItem(key: string, value: string): void
}
export class InMemoryAuditStorage implements AuditStorage{
    private store: Record<string, string>
    constructor(){
        this.store={}
    }
    getItem(key: string): string|null{
        return this.store[key]??null
    }
    setItem(key: string, value: string): void{
        this.store[key]=value
    }
}
function createEntryId(): string{
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
export function computeHash(entry: Omit<AuditEntry, "hash">): string{
    let payload=JSON.stringify(entry)
    return crypto.createHash("sha256").update(payload).digest("hex")
}
export function createGenesisEntry(): AuditEntry{
    let entryWithoutHash: Omit<AuditEntry, "hash">={
        id: createEntryId(),
        timestamp: Date.now(),
        action: "genesis",
        actor: "system",
        resource: "audit-log",
        details: {},
        prevHash: "0"
    }
    return {
        ...entryWithoutHash,
        hash: computeHash(entryWithoutHash)
    }
}
export class AuditLog{
    private entries: AuditEntry[]
    private storage: AuditStorage
    private readonly storageKey="tg-audit-log"
    constructor(options: {storage?: AuditStorage}={}){
        this.storage=options.storage??new InMemoryAuditStorage()
        this.entries=[]
    }
    append(action: string, actor: string, resource: string, details: Record<string, unknown>={}): AuditEntry{
        let prevHash="0"
        if (this.entries.length>0){
            prevHash=this.entries[this.entries.length-1].hash
        }
        let entryWithoutHash: Omit<AuditEntry, "hash">={
            id: createEntryId(),
            timestamp: Date.now(),
            action,
            actor,
            resource,
            details,
            prevHash
        }
        let entry: AuditEntry={
            ...entryWithoutHash,
            hash: computeHash(entryWithoutHash)
        }
        this.entries.push(entry)
        return entry
    }
    getEntries(): AuditEntry[]{
        return [...this.entries]
    }
    verifyChain(): {valid: boolean, brokenAt?: number}{
        let entries=this.getEntries()
        for (let i=0;i<entries.length;i++){
            let entry=entries[i]
            let {hash, ...withoutHash}=entry
            if (hash!==computeHash(withoutHash as Omit<AuditEntry, "hash">)){
                return {valid: false, brokenAt: i}
            }
            if (i>0 && entry.prevHash!==entries[i-1].hash){
                return {valid: false, brokenAt: i}
            }
        }
        return {valid: true}
    }
    exportCsv(): string{
        let headers=["id", "timestamp", "action", "actor", "resource", "details", "prevHash", "hash"]
        let rows=[headers.join(",")]
        for (let entry of this.entries){
            let values=[
                this.escapeCsv(entry.id),
                this.escapeCsv(String(entry.timestamp)),
                this.escapeCsv(entry.action),
                this.escapeCsv(entry.actor),
                this.escapeCsv(entry.resource),
                this.escapeCsv(JSON.stringify(entry.details)),
                this.escapeCsv(entry.prevHash),
                this.escapeCsv(entry.hash)
            ]
            rows.push(values.join(","))
        }
        return rows.join("\n")
    }
    private escapeCsv(value: string): string{
        if (value.includes(",")||value.includes('"')||value.includes("\n")||value.includes("\r")){
            return `"${value.replace(/"/g, '""')}"`
        }
        return value
    }
    exportJson(): string{
        return JSON.stringify(this.entries, null, 2)
    }
    load(): void{
        let raw=this.storage.getItem(this.storageKey)
        if (raw===null){
            this.entries=[]
        }
        else{
            this.entries=JSON.parse(raw) as AuditEntry[]
        }
    }
    save(): void{
        this.storage.setItem(this.storageKey, JSON.stringify(this.entries))
    }
}
