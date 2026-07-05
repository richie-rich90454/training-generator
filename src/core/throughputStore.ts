let Database: any|null=null
try {
    // @ts-ignore optional native dependency
    let mod=await import("better-sqlite3")
    Database=mod.default ?? mod
}
catch {
    Database=null
}
export interface ThroughputSample{
    sessionId: string
    timestamp: number
    tokensPerSec: number
    chunksPerSec: number
    costPer1kTokens: number
}
export interface ThroughputStorage{
    getItem(key: string): string|null
    setItem(key: string, value: string): void
}
export class InMemoryThroughputStorage implements ThroughputStorage{
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
export class ThroughputStore{
    private samples: ThroughputSample[]
    private storage: ThroughputStorage
    private dbPath?: string
    private db: any
    private readonly storageKey="tg-throughput"
    constructor(options: {dbPath?: string, storage?: ThroughputStorage}={}){
        this.samples=[]
        this.storage=options.storage??new InMemoryThroughputStorage()
        this.dbPath=options.dbPath
    }
    addSample(sample: ThroughputSample): void{
        this.samples.push(sample)
    }
    getSamples(sessionId?: string, startTime?: number, endTime?: number): ThroughputSample[]{
        return this.samples.filter((s) => {
            if (sessionId!==undefined&&s.sessionId!==sessionId){
                return false
            }
            if (startTime!==undefined&&s.timestamp<startTime){
                return false
            }
            if (endTime!==undefined&&s.timestamp>endTime){
                return false
            }
            return true
        })
    }
    getSessions(): string[]{
        let set=new Set<string>()
        for (let s of this.samples){
            set.add(s.sessionId)
        }
        return [...set]
    }
    getAggregates(sessionId?: string): {avgTokensPerSec: number, avgChunksPerSec: number, totalSamples: number}{
        let filtered=sessionId===undefined ? this.samples : this.samples.filter((s) => s.sessionId===sessionId)
        let total=filtered.length
        if (total===0){
            return {avgTokensPerSec: 0, avgChunksPerSec: 0, totalSamples: 0}
        }
        let sumTokens=0
        let sumChunks=0
        for (let s of filtered){
            sumTokens+=s.tokensPerSec
            sumChunks+=s.chunksPerSec
        }
        return {avgTokensPerSec: sumTokens/total, avgChunksPerSec: sumChunks/total, totalSamples: total}
    }
    persist(): void{
        if (this.dbPath){
            let db=this.getDb()
            this.saveToDb(db)
        }
        else{
            this.storage.setItem(this.storageKey, JSON.stringify(this.samples))
        }
    }
    load(): void{
        if (this.dbPath){
            let db=this.getDb()
            this.samples=this.loadFromDb(db)
        }
        else{
            let raw=this.storage.getItem(this.storageKey)
            if (raw===null){
                this.samples=[]
            }
            else{
                this.samples=JSON.parse(raw) as ThroughputSample[]
            }
        }
    }
    clear(): void{
        this.samples=[]
        if (this.dbPath&&this.db){
            this.db.exec("DELETE FROM throughput_samples")
        }
    }
    private getDb(): any{
        if (this.db){
            return this.db
        }
        if (!this.dbPath){
            return null
        }
        if (Database===null){
            throw new Error("better-sqlite3 unavailable")
        }
        try {
            let db=new Database(this.dbPath)
            db.exec(`CREATE TABLE IF NOT EXISTS throughput_samples (sessionId TEXT, timestamp INTEGER, tokensPerSec REAL, chunksPerSec REAL, costPer1kTokens REAL)`)
            this.db=db
            return db
        }
        catch {
            throw new Error("better-sqlite3 unavailable")
        }
    }
    private saveToDb(db: any): void{
        db.exec("DELETE FROM throughput_samples")
        let insert=db.prepare("INSERT INTO throughput_samples (sessionId, timestamp, tokensPerSec, chunksPerSec, costPer1kTokens) VALUES (?, ?, ?, ?, ?)")
        for (let s of this.samples){
            insert.run(s.sessionId, s.timestamp, s.tokensPerSec, s.chunksPerSec, s.costPer1kTokens)
        }
    }
    private loadFromDb(db: any): ThroughputSample[]{
        let rows=db.prepare("SELECT * FROM throughput_samples").all()
        return rows.map((r: any) => ({
            sessionId: r.sessionId,
            timestamp: r.timestamp,
            tokensPerSec: r.tokensPerSec,
            chunksPerSec: r.chunksPerSec,
            costPer1kTokens: r.costPer1kTokens
        }))
    }
}
export function buildChartData(samples: ThroughputSample[], bucketMs: number=1000): {labels: string[], tokensPerSec: number[], chunksPerSec: number[]}{
    if (samples.length===0){
        return {labels: [], tokensPerSec: [], chunksPerSec: []}
    }
    let sorted=[...samples].sort((a, b) => a.timestamp-b.timestamp)
    let buckets=new Map<number, {tokensSum: number, chunksSum: number, count: number}>()
    for (let s of sorted){
        let bucket=Math.floor(s.timestamp/bucketMs)*bucketMs
        let existing=buckets.get(bucket)
        if (existing){
            existing.tokensSum+=s.tokensPerSec
            existing.chunksSum+=s.chunksPerSec
            existing.count+=1
        }
        else{
            buckets.set(bucket, {tokensSum: s.tokensPerSec, chunksSum: s.chunksPerSec, count: 1})
        }
    }
    let labels: string[]=[]
    let tokensPerSec: number[]=[]
    let chunksPerSec: number[]=[]
    let keys=[...buckets.keys()].sort((a, b) => a-b)
    for (let key of keys){
        let b=buckets.get(key)!
        labels.push(new Date(key).toISOString())
        tokensPerSec.push(b.tokensSum/b.count)
        chunksPerSec.push(b.chunksSum/b.count)
    }
    return {labels, tokensPerSec, chunksPerSec}
}