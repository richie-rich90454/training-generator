import path from "path"
import FileParser from "./fileParser.ts"
export interface WatchEvent{
    type: "add"|"change"|"unlink"
    path: string
    stats?: {size: number, mtime: number}
}
export interface FolderWatcherOptions{
    ignored?: string|string[]
    persistent?: boolean
    debounceMs?: number
    onEvent?: (event: WatchEvent)=>void
}
export interface FolderWatcherConfig{
    folders: string[]
    options?: FolderWatcherOptions
}
let fileParser=new FileParser()
let defaultIgnored=["*.tmp", "~$*", ".*.swp", ".DS_Store", "Thumbs.db"]
export function isSupportedFile(filePath: string): boolean{
    let ext=path.extname(filePath).toLowerCase().replace(".", "")
    if(ext==="htm"){
        ext="html"
    }
    return fileParser.supportedFormats.includes(ext)
}
export async function createWatcherInstance(folders: string[], options?: FolderWatcherOptions): Promise<any>{
    let chokidarModule: any
    try{
        chokidarModule=await import("chokidar")
    }
    catch{
        throw new Error("chokidar not installed")
    }
    let chokidar=chokidarModule.default||chokidarModule
    let ignored=options?.ignored!==undefined?options.ignored:defaultIgnored
    let persistent=options?.persistent!==undefined?options.persistent:true
    let watcher=chokidar.watch(folders, {
        ignored: ignored,
        persistent: persistent,
        ignoreInitial: false
    })
    return watcher
}
export class FolderWatcher{
    folders: string[]
    options: FolderWatcherOptions
    watcher: any
    queue: WatchEvent[]
    debounceTimers: Map<string, ReturnType<typeof setTimeout>>
    constructor(config: FolderWatcherConfig){
        this.folders=config.folders
        this.options=config.options||{}
        this.watcher=null
        this.queue=[]
        this.debounceTimers=new Map()
    }
    async start(): Promise<void>{
        this.watcher=await createWatcherInstance(this.folders, this.options)
        this.watcher.on("add", (filePath: string, stats: any)=>{
            this.handleEvent("add", filePath, stats)
        })
        this.watcher.on("change", (filePath: string, stats: any)=>{
            this.handleEvent("change", filePath, stats)
        })
        this.watcher.on("unlink", (filePath: string)=>{
            this.handleEvent("unlink", filePath)
        })
    }
    private handleEvent(type: "add"|"change"|"unlink", filePath: string, stats?: any): void{
        if(!isSupportedFile(filePath)){
            return
        }
        let key=type+":"+filePath
        let existing=this.debounceTimers.get(key)
        if(existing){
            clearTimeout(existing)
        }
        let debounceMs=this.options.debounceMs!==undefined?this.options.debounceMs:500
        let timer=setTimeout(()=>{
            this.debounceTimers.delete(key)
            let event: WatchEvent={
                type: type,
                path: filePath,
                stats: stats?{size: stats.size, mtime: this.extractMtime(stats)}:undefined
            }
            this.queue.push(event)
            if(this.options.onEvent){
                this.options.onEvent(event)
            }
        }, debounceMs)
        this.debounceTimers.set(key, timer)
    }
    private extractMtime(stats: any): number{
        if(typeof stats.mtimeMs==="number"){
            return stats.mtimeMs
        }
        if(stats.mtime instanceof Date){
            return stats.mtime.getTime()
        }
        return Date.now()
    }
    async stop(): Promise<void>{
        if(this.watcher){
            await this.watcher.close()
            this.watcher=null
        }
        for(let timer of this.debounceTimers.values()){
            clearTimeout(timer)
        }
        this.debounceTimers.clear()
    }
    getQueue(): WatchEvent[]{
        return this.queue
    }
    clearQueue(): void{
        this.queue=[]
    }
}
