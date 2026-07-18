export interface RunRecord{
    id: string
    name: string
    status: "queued"|"running"|"completed"|"failed"|"cancelled"
    startedAt?: number
    completedAt?: number
    config: Record<string, unknown>
    result?: Record<string, unknown>
    error?: string
}
export interface JobStorage{
    getItem(key: string): string|null
    setItem(key: string, value: string): void
}
export class InMemoryJobStorage implements JobStorage{
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
export class JobQueue{
    private items: RunRecord[]
    constructor(){
        this.items=[]
    }
    enqueue(record: RunRecord): void{
        this.items.push(record)
    }
    dequeue(): RunRecord|undefined{
        return this.items.shift()
    }
    peek(): RunRecord|undefined{
        return this.items[0]
    }
    remove(id: string): boolean{
        let index=this.items.findIndex((r) => r.id===id)
        if (index===-1){
            return false
        }
        this.items.splice(index, 1)
        return true
    }
    list(): RunRecord[]{
        return [...this.items]
    }
    clear(): void{
        this.items=[]
    }
}
export function createJobId(): string{
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
export class RunHistoryManager{
    history: RunRecord[]
    queue: JobQueue
    autosaveTimer?: any
    private storage: JobStorage
    private maxHistory: number
    private autosaveIntervalMs: number
    private readonly historyKey="tg-run-history"
    private readonly draftKey="tg-run-draft"
    constructor(options: {storage?: JobStorage, maxHistory?: number, autosaveIntervalMs?: number}={}){
        this.storage=options.storage??new InMemoryJobStorage()
        this.maxHistory=options.maxHistory??100
        this.autosaveIntervalMs=options.autosaveIntervalMs??30000
        this.history=[]
        this.queue=new JobQueue()
        this.load()
    }
    startAutosave(): void{
        this.stopAutosave()
        this.autosaveTimer=setInterval(() => {
            this.save()
        }, this.autosaveIntervalMs)
    }
    stopAutosave(): void{
        if (this.autosaveTimer){
            clearInterval(this.autosaveTimer)
            this.autosaveTimer=undefined
        }
    }
    save(): void{
        this.storage.setItem(this.historyKey, JSON.stringify(this.history))
    }
    load(): void{
        let raw=this.storage.getItem(this.historyKey)
        if (raw===null){
            this.history=[]
        }
        else{
            try{
                let parsed=JSON.parse(raw)
                this.history=Array.isArray(parsed)?parsed as RunRecord[]:[]
            }
            catch{
                this.history=[]
            }
        }
    }
    addRun(record: RunRecord): void{
        this.history.unshift(record)
        if (this.history.length>this.maxHistory){
            this.history.length=this.maxHistory
        }
    }
    updateRun(id: string, updates: Partial<RunRecord>): void{
        let index=this.history.findIndex((r) => r.id===id)
        if (index!==-1){
            this.history[index]={...this.history[index], ...updates}
        }
    }
    getRun(id: string): RunRecord|undefined{
        return this.history.find((r) => r.id===id)
    }
    deleteRun(id: string): boolean{
        let index=this.history.findIndex((r) => r.id===id)
        if (index===-1){
            return false
        }
        this.history.splice(index, 1)
        return true
    }
    listRuns(): RunRecord[]{
        return [...this.history]
    }
    queueRun(record: RunRecord): void{
        this.queue.enqueue(record)
    }
    nextJob(): RunRecord|undefined{
        return this.queue.dequeue()
    }
    autosaveDraft(draft: Record<string, unknown>): void{
        this.storage.setItem(this.draftKey, JSON.stringify(draft))
    }
    loadDraft(): Record<string, unknown>|undefined{
        let raw=this.storage.getItem(this.draftKey)
        if (raw===null||raw===""){
            return undefined
        }
        try{
            return JSON.parse(raw) as Record<string, unknown>
        }
        catch{
            return undefined
        }
    }
    clearDraft(): void{
        this.storage.setItem(this.draftKey, "")
    }
}
