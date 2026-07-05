export interface CrashEvent{
    id: string
    timestamp: number
    level: "fatal" | "error" | "warning" | "info"
    message: string
    exception?: {type: string, value: string, stack?: string}
    breadcrumbs?: {message: string, timestamp: number, category?: string}[]
    tags?: Record<string, string>
}
export interface CrashReporterConfig{
    dsn?: string
    enabled: boolean
    sampleRate?: number
    environment?: string
    release?: string
    beforeSend?: (event: CrashEvent)=>CrashEvent | null
}
export type CrashTransport=(event: CrashEvent)=>Promise<void>
export function generateEventId(): string{
    let bytes=new Uint8Array(16)
    for (let i=0;i<bytes.length;i++){
        bytes[i]=Math.floor(Math.random()*256)
    }
    return Array.from(bytes).map((b)=>b.toString(16).padStart(2, "0")).join("")
}
export class CrashReporter{
    private config: CrashReporterConfig
    private transport?: CrashTransport
    private buffer: CrashEvent[]
    private breadcrumbs: {message: string, timestamp: number, category?: string}[]
    private tags: Record<string, string>
    private installed: boolean
    constructor(options: {config: CrashReporterConfig, transport?: CrashTransport}){
        this.config=options.config
        this.transport=options.transport
        this.buffer=[]
        this.breadcrumbs=[]
        this.tags={}
        this.installed=false
    }
    init(): void{
        if (!this.config.enabled||this.installed){
            return
        }
        this.installed=true
        if (typeof process!=="undefined"&&process.on){
            process.on("uncaughtException", this.handleUncaughtException)
            process.on("unhandledRejection", this.handleUnhandledRejection)
        }
    }
    captureException(error: Error, context?: Record<string, unknown>): void{
        if (!this.config.enabled){
            return
        }
        let event=this.createEvent(error.message, "error")
        if (!event){
            return
        }
        event.exception={
            type: error.name,
            value: error.message,
            stack: error.stack
        }
        if (context){
            let contextTags=this.contextToTags(context)
            event.tags={...event.tags, ...contextTags}
        }
        this.enqueue(event)
    }
    captureMessage(message: string, level?: "fatal" | "error" | "warning" | "info"): void{
        if (!this.config.enabled){
            return
        }
        let event=this.createEvent(message, level??"info")
        if (!event){
            return
        }
        this.enqueue(event)
    }
    addBreadcrumb(message: string, category?: string): void{
        this.breadcrumbs.push({message, timestamp: Date.now(), category})
        if (this.breadcrumbs.length>100){
            this.breadcrumbs.shift()
        }
    }
    setTag(key: string, value: string): void{
        this.tags[key]=value
    }
    getPendingCount(): number{
        return this.buffer.length
    }
    async flush(): Promise<void>{
        if (!this.transport||this.buffer.length===0){
            return
        }
        let events=this.buffer.slice()
        this.buffer=[]
        for (let event of events){
            await this.transport(event)
        }
    }
    private handleUncaughtException=(error: Error): void=>{
        this.captureException(error)
    }
    private handleUnhandledRejection=(reason: unknown): void=>{
        let message=reason instanceof Error ? reason.message : String(reason)
        this.captureMessage(message, "error")
    }
    private createEvent(message: string, level: "fatal" | "error" | "warning" | "info"): CrashEvent | null{
        let event: CrashEvent={
            id: generateEventId(),
            timestamp: Date.now(),
            level,
            message,
            breadcrumbs: this.breadcrumbs.length>0 ? this.breadcrumbs.slice() : undefined,
            tags: Object.keys(this.tags).length>0 ? {...this.tags} : undefined
        }
        if (this.config.beforeSend){
            let result=this.config.beforeSend(event)
            if (!result){
                return null
            }
            event=result
        }
        return event
    }
    private enqueue(event: CrashEvent): void{
        if (Math.random()>(this.config.sampleRate??1)){
            return
        }
        this.buffer.push(event)
    }
    private contextToTags(context: Record<string, unknown>): Record<string, string>{
        let tags: Record<string, string>={}
        for (let key of Object.keys(context)){
            let value=context[key]
            if (typeof value==="string"||typeof value==="number"||typeof value==="boolean"){
                tags[key]=String(value)
            }
        }
        return tags
    }
}
