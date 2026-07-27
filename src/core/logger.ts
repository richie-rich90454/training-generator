import fs from "fs"
import path from "path"
export type LogLevel = "debug" | "info" | "warn" | "error"
export interface LogEntry{
    timestamp: string
    level: LogLevel
    message: string
    context?: Record<string, unknown>
    trace?: string[]
}
const PII_PATTERNS: RegExp[]=[
    /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g,
    /\b\d{3}-\d{2}-\d{4}\b/g,
    /\b(?:\d{4}[ -]?){3}\d{4}\b/g
]
const LOG_PII_KEYS: string[]=["email", "name", "phone", "ssn", "token", "key", "password", "secret", "authorization", "credential", "credentials"]
function redactPiiInString(s: string): string{
    let result=s
    for(let pattern of PII_PATTERNS){
        result=result.replace(pattern, "[REDACTED]")
    }
    return result
}
function isLogPiiKey(key: string): boolean{
    let words=key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[_\s]+/)
    for(let word of words){
        if(LOG_PII_KEYS.includes(word)){
            return true
        }
    }
    return false
}
function scrubContextKeys(ctx: Record<string, unknown>): Record<string, unknown>{
    let result: Record<string, unknown>={}
    for(let key of Object.keys(ctx)){
        if(!isLogPiiKey(key)){
            result[key]=redactPiiInValue(ctx[key])
        }
    }
    return result
}
function redactPiiInValue(value: unknown): unknown{
    if(typeof value==="string"){
        return redactPiiInString(value)
    }
    if(Array.isArray(value)){
        return value.map(redactPiiInValue)
    }
    if(value && typeof value==="object"){
        return scrubContextKeys(value as Record<string, unknown>)
    }
    return value
}
export interface LoggerOptions{
    level?: LogLevel
    console?: boolean
    file?: string
    maxSizeBytes?: number
    maxFiles?: number
    format?: "json" | "text"
}
export function levelToNumber(level: LogLevel): number{
    switch (level){
        case "debug":
            return 0
        case "info":
            return 1
        case "warn":
            return 2
        case "error":
            return 3
    }
}
export function formatLogEntry(entry: LogEntry, format: "json" | "text"): string{
    if (format === "json"){
        return JSON.stringify(entry)
    }
    let parts: string[] = [entry.timestamp, entry.level.toUpperCase(), entry.message]
    if (entry.context && Object.keys(entry.context).length > 0){
        parts.push(JSON.stringify(entry.context))
    }
    if (entry.trace && entry.trace.length > 0){
        parts.push(entry.trace.join("\n"))
    }
    return parts.join(" ")
}
export class Logger{
    private level: LogLevel
    private consoleEnabled: boolean
    private file?: string
    private maxSizeBytes: number
    private maxFiles: number
    private format: "json" | "text"
    private boundContext?: Record<string, unknown>
    constructor(options: LoggerOptions = {}){
        this.level = options.level ?? "info"
        this.consoleEnabled = options.console ?? false
        this.file = options.file
        this.maxSizeBytes = options.maxSizeBytes ?? 5 * 1024 * 1024
        this.maxFiles = options.maxFiles ?? 5
        this.format = options.format ?? "json"
        this.boundContext = undefined
    }
    private mergeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined{
        if (!this.boundContext && !context){
            return undefined
        }
        if (!this.boundContext){
            if (!context){
                return undefined
            }
            return Object.keys(context).length > 0 ? context : undefined
        }
        if (!context){
            return Object.keys(this.boundContext).length > 0 ? this.boundContext : undefined
        }
        let merged = {...this.boundContext, ...context}
        return Object.keys(merged).length > 0 ? merged : undefined
    }
    private buildEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry{
        let entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message: redactPiiInString(message)
        }
        let merged = this.mergeContext(context)
        if (merged){
            let scrubbed = scrubContextKeys(merged)
            if (Object.keys(scrubbed).length > 0){
                entry.context = scrubbed
            }
        }
        if (level === "error"){
            let err = new Error()
            if (err.stack){
                entry.trace = err.stack.split("\n")
            }
        }
        return entry
    }
    log(level: LogLevel, message: string, context?: Record<string, unknown>): void{
        if (levelToNumber(level) < levelToNumber(this.level)){
            return
        }
        let entry = this.buildEntry(level, message, context)
        this.emit(entry)
    }
    debug(message: string, context?: Record<string, unknown>): void{
        this.log("debug", message, context)
    }
    info(message: string, context?: Record<string, unknown>): void{
        this.log("info", message, context)
    }
    warn(message: string, context?: Record<string, unknown>): void{
        this.log("warn", message, context)
    }
    error(message: string, context?: Record<string, unknown>): void{
        this.log("error", message, context)
    }
    child(context: Record<string, unknown>): Logger{
        let child = new Logger({
            level: this.level,
            console: this.consoleEnabled,
            file: this.file,
            maxSizeBytes: this.maxSizeBytes,
            maxFiles: this.maxFiles,
            format: this.format
        })
        child.boundContext = this.mergeContext(context)
        return child
    }
    rotateIfNeeded(): void{
        if (!this.file){
            return
        }
        if (!fs.existsSync(this.file)){
            return
        }
        let stats = fs.statSync(this.file)
        if (stats.size <= this.maxSizeBytes){
            return
        }
        if (this.maxFiles <= 1){
            fs.unlinkSync(this.file)
            return
        }
        for (let i = this.maxFiles - 1; i >= 1; i--){
            let src = this.file + "." + String(i)
            if (i === this.maxFiles - 1){
                if (fs.existsSync(src)){
                    fs.unlinkSync(src)
                }
            }
            else{
                let dst = this.file + "." + String(i + 1)
                if (fs.existsSync(src)){
                    fs.renameSync(src, dst)
                }
            }
        }
        fs.renameSync(this.file, this.file + ".1")
    }
    getLogPath(): string | undefined{
        return this.file
    }
    private emit(entry: LogEntry): void{
        let line = formatLogEntry(entry, this.format) + "\n"
        if (this.consoleEnabled){
            console.log(line.trimEnd())
        }
        if (this.file){
            this.rotateIfNeeded()
            let dir = path.dirname(this.file)
            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir, {recursive: true})
            }
            fs.appendFileSync(this.file, line, "utf8")
        }
    }
}