// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest"
import type { TrainingItem } from "../src/types/interfaces.js"
import type { WorkMessage } from "../src/core/distributedProcessor.js"
import { Coordinator, Worker, createInMemoryWebSocketPair, validateAuth } from "../src/core/distributedProcessor.js"
vi.mock("ws", ()=>{
    class MockWebSocket{
        readyState: number=0
        url?: string
        peer?: MockWebSocket
        private listeners: Record<string, Array<(...args: any[])=>void>>={}
        constructor(url?: string){
            this.url=url
            if(url!==undefined){
                queueMicrotask(()=>{
                    MockWebSocketServer.lastServer?.connectClient(this)
                })
            }
        }
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
    class MockWebSocketServer{
        static lastServer?: MockWebSocketServer
        port?: number
        private listeners: Record<string, Array<(...args: any[])=>void>>={}
        clients: Set<MockWebSocket>=new Set()
        constructor(options: {port?: number}={}){
            this.port=options.port
            MockWebSocketServer.lastServer=this
            queueMicrotask(()=>{
                this.emit("listening")
            })
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
        close(callback?: ()=>void): void{
            this.emit("close")
            if(callback){
                callback()
            }
        }
        connectClient(client: MockWebSocket): void{
            let serverSocket=new MockWebSocket()
            client.peer=serverSocket
            serverSocket.peer=client
            client.readyState=1
            serverSocket.readyState=1
            this.clients.add(serverSocket)
            this.emit("connection", serverSocket)
            queueMicrotask(()=>{
                client.emit("open")
            })
        }
    }
    return {
        WebSocket: MockWebSocket,
        WebSocketServer: MockWebSocketServer,
        default: MockWebSocket
    }
})
function tick(): Promise<void>{
    return new Promise(resolve=>setTimeout(resolve, 0))
}
describe("distributedProcessor", ()=>{
    let coordinator: Coordinator|undefined
    let worker: Worker|undefined
    afterEach(async()=>{
        if(coordinator){
            await coordinator.stop()
            coordinator=undefined
        }
        if(worker){
            await worker.disconnect()
            worker=undefined
        }
    })
    it("validateAuth returns true when no secret required", ()=>{
        let message: WorkMessage={type: "auth", token: "any"}
        expect(validateAuth(message)).toBe(true)
    })
    it("validateAuth returns false for non-auth message when secret required", ()=>{
        let message: WorkMessage={type: "heartbeat"}
        expect(validateAuth(message, "secret")).toBe(false)
    })
    it("validateAuth returns false for wrong token", ()=>{
        let message: WorkMessage={type: "auth", token: "wrong"}
        expect(validateAuth(message, "secret")).toBe(false)
    })
    it("validateAuth returns true for correct token", ()=>{
        let message: WorkMessage={type: "auth", token: "secret"}
        expect(validateAuth(message, "secret")).toBe(true)
    })
    it("Coordinator starts and stops", async()=>{
        coordinator=new Coordinator({port: 0})
        await coordinator.start()
        expect(coordinator.getConnectedWorkers()).toBe(0)
        await coordinator.stop()
        expect(coordinator.getConnectedWorkers()).toBe(0)
    })
    it("getConnectedWorkers returns zero before any connection", async()=>{
        coordinator=new Coordinator({port: 0})
        await coordinator.start()
        expect(coordinator.getConnectedWorkers()).toBe(0)
    })
    it("Coordinator rejects invalid auth token", async()=>{
        coordinator=new Coordinator({port: 0, secret: "secret"})
        await coordinator.start()
        worker=new Worker({
            coordinatorUrl: "ws://localhost:0",
            secret: "wrong",
            processor: async(chunk)=>[{format: "text" as const, text: chunk}]
        })
        await expect(worker.connect()).rejects.toThrow("connection closed")
        expect(coordinator.getConnectedWorkers()).toBe(0)
    })
    it("Coordinator accepts valid auth token", async()=>{
        coordinator=new Coordinator({port: 0, secret: "secret"})
        await coordinator.start()
        worker=new Worker({
            coordinatorUrl: "ws://localhost:0",
            secret: "secret",
            processor: async(chunk)=>[{format: "text" as const, text: chunk}]
        })
        await worker.connect()
        expect(coordinator.getConnectedWorkers()).toBe(1)
    })
    it("Worker connects and disconnects without secret", async()=>{
        coordinator=new Coordinator({port: 0})
        await coordinator.start()
        worker=new Worker({
            coordinatorUrl: "ws://localhost:0",
            processor: async(chunk)=>[{format: "text" as const, text: chunk}]
        })
        await worker.connect()
        expect(coordinator.getConnectedWorkers()).toBe(1)
        await worker.disconnect()
        expect(coordinator.getConnectedWorkers()).toBe(0)
    })
    it("Coordinator distributes chunks to a single worker", async()=>{
        coordinator=new Coordinator({port: 0})
        await coordinator.start()
        let received: string[]=[]
        worker=new Worker({
            coordinatorUrl: "ws://localhost:0",
            processor: async(chunk)=>{
                received.push(chunk)
                return [{format: "text" as const, text: chunk}]
            }
        })
        await worker.connect()
        coordinator.distribute(["chunk1", "chunk2"])
        await tick()
        expect(received).toEqual(["chunk1", "chunk2"])
    })
    it("Worker processes chunk and sends result", async()=>{
        let results: {id: string; items: TrainingItem[]}[]=[]
        coordinator=new Coordinator({
            port: 0,
            onResult: (id, items)=>results.push({id, items})
        })
        await coordinator.start()
        worker=new Worker({
            coordinatorUrl: "ws://localhost:0",
            processor: async(chunk)=>[{format: "instruction" as const, instruction: chunk, output: "out"}]
        })
        await worker.connect()
        coordinator.distribute(["hello"])
        await tick()
        expect(results).toHaveLength(1)
        expect(results[0].items[0].instruction).toBe("hello")
    })
    it("Coordinator distributes chunks round-robin", async()=>{
        coordinator=new Coordinator({port: 0})
        await coordinator.start()
        let worker1Received: string[]=[]
        let worker2Received: string[]=[]
        worker=new Worker({
            coordinatorUrl: "ws://localhost:0",
            processor: async(chunk)=>{
                worker1Received.push(chunk)
                return []
            }
        })
        let worker2=new Worker({
            coordinatorUrl: "ws://localhost:0",
            processor: async(chunk)=>{
                worker2Received.push(chunk)
                return []
            }
        })
        await worker.connect()
        await worker2.connect()
        coordinator.distribute(["a", "b", "c", "d"])
        await tick()
        expect(worker1Received).toEqual(["a", "c"])
        expect(worker2Received).toEqual(["b", "d"])
        await worker2.disconnect()
    })
    it("Coordinator queues chunks when no workers connected", async()=>{
        let received: string[]=[]
        coordinator=new Coordinator({
            port: 0,
            onResult: (_id, items)=>{
                for(let item of items){
                    if(item.format==="text"&&item.text){
                        received.push(item.text)
                    }
                }
            }
        })
        await coordinator.start()
        coordinator.distribute(["chunk1", "chunk2"])
        worker=new Worker({
            coordinatorUrl: "ws://localhost:0",
            processor: async(chunk)=>[{format: "text" as const, text: chunk}]
        })
        await worker.connect()
        await tick()
        expect(received).toEqual(["chunk1", "chunk2"])
    })
    it("Worker sends error result when processor throws", async()=>{
        let results: {id: string; items: TrainingItem[]}[]=[]
        coordinator=new Coordinator({
            port: 0,
            onResult: (id, items)=>results.push({id, items})
        })
        await coordinator.start()
        worker=new Worker({
            coordinatorUrl: "ws://localhost:0",
            processor: async(chunk)=>{
                throw new Error("fail "+chunk)
            }
        })
        await worker.connect()
        coordinator.distribute(["bad"])
        await tick()
        expect(results).toHaveLength(1)
        expect(results[0].items).toEqual([])
    })
    it("Coordinator handles heartbeat from worker", async()=>{
        coordinator=new Coordinator({port: 0})
        await coordinator.start()
        worker=new Worker({
            coordinatorUrl: "ws://localhost:0",
            processor: async(chunk)=>[{format: "text" as const, text: chunk}]
        })
        await worker.connect()
        expect(coordinator.getConnectedWorkers()).toBe(1)
        let {WebSocket: WS}=await import("ws")
        let socket=new WS("ws://localhost:0")
        await tick()
        expect(coordinator.getConnectedWorkers()).toBe(2)
        socket.send(JSON.stringify({type: "heartbeat"}))
        await tick()
        expect(coordinator.getConnectedWorkers()).toBe(2)
        socket.close()
        await tick()
        expect(coordinator.getConnectedWorkers()).toBe(1)
    })
    it("createInMemoryWebSocketPair routes messages between sockets", async()=>{
        let {coordinator, worker}=createInMemoryWebSocketPair()
        let coordinatorReceived: WorkMessage|undefined
        let workerReceived: WorkMessage|undefined
        coordinator.on("message", (data: string)=>{
            coordinatorReceived=JSON.parse(data) as WorkMessage
        })
        worker.on("message", (data: string)=>{
            workerReceived=JSON.parse(data) as WorkMessage
        })
        coordinator.send(JSON.stringify({type: "chunk", id: "1", chunk: "c"}))
        worker.send(JSON.stringify({type: "result", id: "1", items: []}))
        await tick()
        expect(workerReceived?.type).toBe("chunk")
        expect(coordinatorReceived?.type).toBe("result")
    })
    it("Coordinator stop closes connected workers", async()=>{
        coordinator=new Coordinator({port: 0})
        await coordinator.start()
        worker=new Worker({
            coordinatorUrl: "ws://localhost:0",
            processor: async(chunk)=>[{format: "text" as const, text: chunk}]
        })
        await worker.connect()
        expect(coordinator.getConnectedWorkers()).toBe(1)
        await coordinator.stop()
        expect(coordinator.getConnectedWorkers()).toBe(0)
    })
    it("getConnectedWorkers decreases after disconnect", async()=>{
        coordinator=new Coordinator({port: 0})
        await coordinator.start()
        worker=new Worker({
            coordinatorUrl: "ws://localhost:0",
            processor: async(chunk)=>[{format: "text" as const, text: chunk}]
        })
        await worker.connect()
        expect(coordinator.getConnectedWorkers()).toBe(1)
        await worker.disconnect()
        expect(coordinator.getConnectedWorkers()).toBe(0)
    })
    it("Coordinator handles empty distribute", async()=>{
        coordinator=new Coordinator({port: 0})
        await coordinator.start()
        worker=new Worker({
            coordinatorUrl: "ws://localhost:0",
            processor: async(chunk)=>[{format: "text" as const, text: chunk}]
        })
        await worker.connect()
        coordinator.distribute([])
        await tick()
        expect(coordinator.getConnectedWorkers()).toBe(1)
    })
    it("Worker returns empty result for empty chunk", async()=>{
        let results: {id: string; items: TrainingItem[]}[]=[]
        coordinator=new Coordinator({
            port: 0,
            onResult: (id, items)=>results.push({id, items})
        })
        await coordinator.start()
        worker=new Worker({
            coordinatorUrl: "ws://localhost:0",
            processor: async(_chunk)=>[]
        })
        await worker.connect()
        coordinator.distribute(["chunk"])
        await tick()
        expect(results).toHaveLength(1)
        expect(results[0].items).toEqual([])
    })
})
