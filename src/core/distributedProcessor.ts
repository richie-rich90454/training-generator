import type { TrainingItem } from "../types/interfaces.js"
import type { WebSocket, WebSocketServer } from "ws"
export type WorkMessage=
    | {type: "chunk"; id: string; chunk: string}
    | {type: "result"; id: string; items: TrainingItem[]; error?: string}
    | {type: "auth"; token: string}
    | {type: "ack"}
    | {type: "heartbeat"}
export interface CoordinatorOptions{
    port?: number
    secret?: string
    onResult?: (id: string, items: TrainingItem[])=>void
}
export class Coordinator{
    private port: number
    private secret?: string
    private onResult?: (id: string, items: TrainingItem[])=>void
    private server?: WebSocketServer
    private workers: WebSocket[]=[]
    private pendingAuth: Set<WebSocket>=new Set()
    private chunkQueue: string[]=[]
    private workerIndex: number=0
    private started: boolean=false
    constructor(options: CoordinatorOptions={}){
        this.port=options.port??8080
        this.secret=options.secret
        this.onResult=options.onResult
    }
    async start(): Promise<void>{
        let ws: typeof import("ws")
        try{
            ws=await import("ws")
        }
        catch{
            throw new Error("ws not installed")
        }
        let WebSocketServer=ws.WebSocketServer
        return new Promise((resolve, reject)=>{
            this.server=new WebSocketServer({port: this.port})
            this.server.on("connection", (socket)=>this.handleConnection(socket))
            this.server.on("listening", ()=>{
                this.started=true
                resolve()
            })
            this.server.on("error", reject)
        })
    }
    async stop(): Promise<void>{
        if(!this.server){
            return
        }
        let server=this.server
        return new Promise((resolve)=>{
            for(let worker of this.workers){
                worker.close()
            }
            this.workers=[]
            this.pendingAuth.clear()
            server.close(()=>{
                this.server=undefined
                this.started=false
                resolve()
            })
        })
    }
    distribute(chunks: string[]): void{
        for(let chunk of chunks){
            this.chunkQueue.push(chunk)
        }
        this.flushQueue()
    }
    getConnectedWorkers(): number{
        return this.workers.length
    }
    private handleConnection(socket: WebSocket): void{
        let authenticated: boolean=!this.secret
        if(!authenticated){
            this.pendingAuth.add(socket)
        }
        else{
            this.workers.push(socket)
            this.flushQueue()
        }
        socket.on("message", (raw: unknown)=>{
            let message=this.parseMessage(raw)
            if(!message){
                return
            }
            if(!authenticated){
                if(validateAuth(message, this.secret)){
                    authenticated=true
                    this.pendingAuth.delete(socket)
                    this.workers.push(socket)
                    socket.send(JSON.stringify({type: "ack"}))
                    this.flushQueue()
                }
                else{
                    socket.close()
                }
                return
            }
            if(message.type==="result"){
                this.onResult?.(message.id, message.items??[])
            }
            else if(message.type==="heartbeat"){
                // no-op
            }
        })
        socket.on("close", ()=>{
            this.pendingAuth.delete(socket)
            let index=this.workers.indexOf(socket)
            if(index>=0){
                this.workers.splice(index, 1)
            }
        })
        socket.on("error", ()=>{
            socket.close()
        })
    }
    private flushQueue(): void{
        while(this.chunkQueue.length>0&&this.workers.length>0){
            let chunk=this.chunkQueue.shift()!
            let worker=this.workers[this.workerIndex%this.workers.length]
            this.workerIndex=(this.workerIndex+1)%this.workers.length
            worker.send(JSON.stringify({type: "chunk", id: this.generateId(), chunk: chunk}))
        }
    }
    private parseMessage(raw: unknown): WorkMessage|null{
        try{
            let text: string
            if(typeof raw==="string"){
                text=raw
            }
            else if(raw instanceof Buffer){
                text=raw.toString("utf-8")
            }
            else{
                text=String(raw)
            }
            let parsed=JSON.parse(text)
            if(parsed&&typeof parsed==="object"){
                return parsed as WorkMessage
            }
        }
        catch{
            // ignore invalid messages
        }
        return null
    }
    private generateId(): string{
        return Math.random().toString(36).slice(2)+Date.now().toString(36)
    }
}
export interface WorkerOptions{
    coordinatorUrl: string
    secret?: string
    processor: (chunk: string)=>Promise<TrainingItem[]>
}
export class Worker{
    private coordinatorUrl: string
    private secret?: string
    private processor: (chunk: string)=>Promise<TrainingItem[]>
    private socket?: WebSocket
    private connected: boolean=false
    constructor(options: WorkerOptions){
        this.coordinatorUrl=options.coordinatorUrl
        this.secret=options.secret
        this.processor=options.processor
    }
    async connect(): Promise<void>{
        let ws: typeof import("ws")
        try{
            ws=await import("ws")
        }
        catch{
            throw new Error("ws not installed")
        }
        let WebSocket=ws.WebSocket
        return new Promise((resolve, reject)=>{
            this.socket=new WebSocket(this.coordinatorUrl)
            this.socket.on("open", ()=>{
                if(this.secret){
                    this.socket?.send(JSON.stringify({type: "auth", token: this.secret}))
                }
                else{
                    this.connected=true
                    resolve()
                }
            })
            this.socket.on("message", (raw: unknown)=>{
                let message=this.parseMessage(raw)
                if(!message){
                    return
                }
                if(message.type==="ack"){
                    this.connected=true
                    resolve()
                }
                else if(message.type==="chunk"){
                    this.handleChunk(message)
                }
                else if(message.type==="heartbeat"){
                    // no-op
                }
            })
            this.socket.on("error", reject)
            this.socket.on("close", ()=>{
                if(!this.connected){
                    reject(new Error("connection closed"))
                }
                this.connected=false
            })
        })
    }
    async disconnect(): Promise<void>{
        if(!this.socket){
            return
        }
        let socket=this.socket
        return new Promise((resolve)=>{
            if(socket.readyState===3){
                this.socket=undefined
                this.connected=false
                resolve()
                return
            }
            socket.on("close", ()=>{
                this.socket=undefined
                this.connected=false
                resolve()
            })
            socket.close()
        })
    }
    private async handleChunk(message: Extract<WorkMessage, {type: "chunk"}>): Promise<void>{
        try{
            let items=await this.processor(message.chunk)
            this.socket?.send(JSON.stringify({type: "result", id: message.id, items: items}))
        }
        catch(err){
            this.socket?.send(JSON.stringify({type: "result", id: message.id, items: [], error: String(err)}))
        }
    }
    private parseMessage(raw: unknown): WorkMessage|null{
        try{
            let text: string
            if(typeof raw==="string"){
                text=raw
            }
            else if(raw instanceof Buffer){
                text=raw.toString("utf-8")
            }
            else{
                text=String(raw)
            }
            let parsed=JSON.parse(text)
            if(parsed&&typeof parsed==="object"){
                return parsed as WorkMessage
            }
        }
        catch{
            // ignore invalid messages
        }
        return null
    }
}
class InMemoryWebSocket implements WebSocket{
    readyState: number=1
    peer?: InMemoryWebSocket
    private listeners: Record<string, Array<(...args: any[])=>void>>={}
    send(data: string|Buffer): void{
        this.peer?.emit("message", data)
    }
    close(): void{
        if(this.readyState===3){
            return
        }
        this.readyState=3
        this.emit("close")
        this.peer?.close()
    }
    on(event: string, listener: (...args: any[])=>void): this{
        if(!this.listeners[event]){
            this.listeners[event]=[]
        }
        this.listeners[event].push(listener)
        return this
    }
    once(event: string, listener: (...args: any[])=>void): this{
        let wrapped=(...args: any[])=>{
            this.off(event, wrapped)
            listener(...args)
        }
        this.on(event, wrapped)
        return this
    }
    off(event: string, listener: (...args: any[])=>void): this{
        let list=this.listeners[event]
        if(!list){
            return this
        }
        let index=list.indexOf(listener)
        if(index>=0){
            list.splice(index, 1)
        }
        return this
    }
    emit(event: string, ...args: any[]): void{
        let list=this.listeners[event]
        if(!list){
            return
        }
        for(let listener of list){
            listener(...args)
        }
    }
}
export function createInMemoryWebSocketPair(): {coordinator: WebSocket; worker: WebSocket}{
    let coordinator=new InMemoryWebSocket()
    let worker=new InMemoryWebSocket()
    coordinator.peer=worker
    worker.peer=coordinator
    return {coordinator: coordinator, worker: worker}
}
export function validateAuth(message: WorkMessage, secret?: string): boolean{
    if(!secret){
        return true
    }
    if(message.type!=="auth"){
        return false
    }
    return message.token===secret
}
