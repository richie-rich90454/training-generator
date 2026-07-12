export interface TelemetryEvent{
    event: string
    timestamp: number
    sessionId: string
    properties?: Record<string, unknown>
}
export interface TelemetryStorage{
    getItem(key: string): string|null
    setItem(key: string, value: string): void
}
export interface TelemetryOptions{
    endpoint: string
    apiKey?: string
    sampleRate?: number
    enabled?: boolean
    storage?: TelemetryStorage
    fetch?: typeof fetch
}
const PII_KEYS: string[]=[
    "email",
    "name",
    "phone",
    "ssn",
    "token",
    "key",
    "password",
    "secret",
    "address",
    "authorization",
    "credential",
    "credentials",
    "ip"
]
function splitKeyWords(key: string): string[]{
    return key
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .split(/[_\s]+/)
}
export function scrubProperties(props: Record<string, unknown>): Record<string, unknown>{
    let result: Record<string, unknown>={}
    for (let key of Object.keys(props)){
        let words=splitKeyWords(key)
        let isPii=false
        for (let word of words){
            if (PII_KEYS.includes(word)){
                isPii=true
                break
            }
        }
        if (!isPii){
            result[key]=props[key]
        }
    }
    return result
}
export function generateSessionId(): string{
    let bytes=new Uint8Array(16)
    for (let i=0;i<bytes.length;i++){
        bytes[i]=Math.floor(Math.random()*256)
    }
    return Array.from(bytes).map((b)=>b.toString(16).padStart(2, "0")).join("")
}
export class Telemetry{
    private endpoint: string
    private apiKey?: string
    private sampleRate: number
    private enabled: boolean
    private storage?: TelemetryStorage
    private fetchImpl: typeof fetch
    private buffer: TelemetryEvent[]
    private sessionId: string
    constructor(options: TelemetryOptions){
        this.endpoint=options.endpoint
        this.apiKey=options.apiKey
        this.sampleRate=options.sampleRate ?? 1
        this.enabled=options.enabled ?? false
        this.storage=options.storage
        this.fetchImpl=options.fetch ?? fetch
        this.buffer=[]
        let stored=this.storage?.getItem("telemetry_session_id")
        this.sessionId=stored ?? generateSessionId()
        if (!stored && this.storage){
            this.storage.setItem("telemetry_session_id", this.sessionId)
        }
    }
    setEnabled(enabled: boolean): void{
        this.enabled=enabled
    }
    isEnabled(): boolean{
        return this.enabled
    }
    respectDoNotTrack(): boolean{
        if (typeof navigator!=="undefined" && navigator.doNotTrack==="1"){
            return true
        }
        if (typeof navigator!=="undefined" && (navigator as {globalPrivacyControl?: boolean}).globalPrivacyControl===true){
            return true
        }
        return false
    }
    track(event: string, properties?: Record<string, unknown>): void{
        if (!this.enabled){
            return
        }
        if (Math.random()>this.sampleRate){
            return
        }
        let scrubbed=properties ? scrubProperties(properties) : undefined
        let evt: TelemetryEvent={
            event,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            properties: scrubbed && Object.keys(scrubbed).length>0 ? scrubbed : undefined
        }
        this.buffer.push(evt)
    }
    async flush(): Promise<void>{
        if (this.buffer.length===0){
            return
        }
        let headers: Record<string, string>={
            "Content-Type": "application/json"
        }
        if (this.apiKey){
            headers["X-API-Key"]=this.apiKey
        }
        let body=JSON.stringify({events: this.buffer})
        let response=await this.fetchImpl(this.endpoint, {
            method: "POST",
            headers,
            body
        })
        if (!response.ok){
            throw new Error("Telemetry flush failed: "+response.status)
        }
        this.buffer=[]
    }
    getPendingCount(): number{
        return this.buffer.length
    }
}
