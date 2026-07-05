import http from "http"
import { TrainingItem } from "../types/interfaces.js"
export interface ProcessRequest{
    source: string
    options?: Record<string, unknown>
}
export interface ApiServerOptions{
    port?: number
    token?: string
    processor?: (req: ProcessRequest)=>Promise<TrainingItem[]>
    exporter?: (format: string, items: TrainingItem[])=>Promise<Buffer|string>
    itemStore?: {
        list: ()=>TrainingItem[]
        get: (id: string)=>TrainingItem|undefined
    }
}
export class ApiServer{
    private port: number
    private token?: string
    private processor?: (req: ProcessRequest)=>Promise<TrainingItem[]>
    private exporter?: (format: string, items: TrainingItem[])=>Promise<Buffer|string>
    private itemStore?: {list: ()=>TrainingItem[]; get: (id: string)=>TrainingItem|undefined}
    private server?: http.Server
    constructor(options: ApiServerOptions={}){
        this.port=options.port??3000
        this.token=options.token
        this.processor=options.processor
        this.exporter=options.exporter
        this.itemStore=options.itemStore
    }
    getUrl(): string{
        if (this.server){
            let address=this.server.address()
            if (address&&typeof address==="object"){
                return "http://localhost:"+address.port
            }
        }
        return "http://localhost:"+this.port
    }
    async start(): Promise<void>{
        try{
            await import("express")
        }
        catch{
            throw new Error("express not installed")
        }
        return new Promise((resolve, reject)=>{
            this.server=http.createServer((req, res)=>this.handleRequest(req, res))
            this.server.once("error", reject)
            this.server.listen(this.port, ()=>{
                this.server?.off("error", reject)
                resolve()
            })
        })
    }
    async stop(): Promise<void>{
        return new Promise((resolve, reject)=>{
            if (!this.server){
                resolve()
                return
            }
            this.server.close((err)=>{
                if (err){
                    reject(err)
                }
                else{
                    this.server=undefined
                    resolve()
                }
            })
        })
    }
    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void>{
        if (this.token&&!this.authorize(req, res)){
            return
        }
        let pathname=req.url?.split("?")[0]??"/"
        let parts=pathname.split("/").filter(Boolean)
        try{
            if (req.method==="GET"&&pathname==="/healthz"){
                this.sendJson(res, 200, {status: "ok"})
                return
            }
            if (req.method==="GET"&&pathname==="/docs"){
                this.sendJson(res, 200, generateOpenApiSpec())
                return
            }
            if (req.method==="GET"&&parts.length===1&&parts[0]==="items"){
                let items=this.itemStore?this.itemStore.list():[]
                this.sendJson(res, 200, {items: items, count: items.length})
                return
            }
            if (req.method==="GET"&&parts.length===2&&parts[0]==="items"){
                let item=this.itemStore?this.itemStore.get(parts[1]):undefined
                if (!item){
                    this.sendJson(res, 404, {error: "not found"})
                    return
                }
                this.sendJson(res, 200, item)
                return
            }
            if (req.method==="POST"&&pathname==="/process"){
                await this.handleProcess(req, res)
                return
            }
            if (req.method==="POST"&&pathname==="/export"){
                await this.handleExport(req, res)
                return
            }
            this.sendJson(res, 404, {error: "not found"})
        }
        catch(error){
            let message=error instanceof Error?error.message:String(error)
            this.sendJson(res, 500, {error: message})
        }
    }
    private authorize(req: http.IncomingMessage, res: http.ServerResponse): boolean{
        let auth=req.headers["authorization"]??""
        if (auth!=="Bearer "+this.token){
            this.sendJson(res, 401, {error: "unauthorized"})
            return false
        }
        return true
    }
    private async handleProcess(req: http.IncomingMessage, res: http.ServerResponse): Promise<void>{
        let body=await this.readBody(req)
        let parsed: Record<string, unknown>
        try{
            parsed=JSON.parse(body)
        }
        catch{
            this.sendJson(res, 400, {error: "invalid JSON"})
            return
        }
        if (typeof parsed.source!=="string"){
            this.sendJson(res, 400, {error: "source is required"})
            return
        }
        if (!this.processor){
            this.sendJson(res, 501, {error: "processor not configured"})
            return
        }
        let request: ProcessRequest={
            source: parsed.source,
            options: typeof parsed.options==="object"&&parsed.options!==null?parsed.options as Record<string, unknown>:undefined
        }
        let items=await this.processor(request)
        this.sendJson(res, 200, {items: items, count: items.length})
    }
    private async handleExport(req: http.IncomingMessage, res: http.ServerResponse): Promise<void>{
        let body=await this.readBody(req)
        let parsed: Record<string, unknown>
        try{
            parsed=JSON.parse(body)
        }
        catch{
            this.sendJson(res, 400, {error: "invalid JSON"})
            return
        }
        if (typeof parsed.format!=="string"){
            this.sendJson(res, 400, {error: "format is required"})
            return
        }
        if (!this.exporter){
            this.sendJson(res, 501, {error: "exporter not configured"})
            return
        }
        let items=this.itemStore?this.itemStore.list():[]
        let result=await this.exporter(parsed.format, items)
        let contentType=this.inferContentType(parsed.format, result)
        if (Buffer.isBuffer(result)){
            res.writeHead(200, {"Content-Type": contentType, "Content-Length": String(result.length)})
            res.end(result)
        }
        else{
            let data=Buffer.from(result as string, "utf-8")
            res.writeHead(200, {"Content-Type": contentType, "Content-Length": String(data.length)})
            res.end(data)
        }
    }
    private inferContentType(format: string, result: Buffer|string): string{
        let lower=format.toLowerCase()
        if (lower==="json"){
            return "application/json"
        }
        if (lower==="csv"){
            return "text/csv"
        }
        if (lower==="xlsx"){
            return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
        if (Buffer.isBuffer(result)&&result.length>=4&&result[0]===0x50&&result[1]===0x4B&&result[2]===0x03&&result[3]===0x04){
            return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
        if (Buffer.isBuffer(result)&&result.length>=1&&result[0]===0x7B){
            return "application/json"
        }
        return "application/octet-stream"
    }
    private readBody(req: http.IncomingMessage): Promise<string>{
        return new Promise((resolve, reject)=>{
            let chunks: Buffer[]=[]
            req.on("data", (chunk)=>chunks.push(chunk as Buffer))
            req.on("end", ()=>resolve(Buffer.concat(chunks).toString("utf-8")))
            req.on("error", reject)
        })
    }
    private sendJson(res: http.ServerResponse, status: number, body: object): void{
        let data=JSON.stringify(body)
        res.writeHead(status, {"Content-Type": "application/json"})
        res.end(data)
    }
}
export function generateOpenApiSpec(): object{
    return {
        openapi: "3.0.0",
        info: {
            title: "Training Generator API",
            version: "1.0.0"
        },
        servers: [
            {
                url: "/"
            }
        ],
        paths: {
            "/healthz": {
                get: {
                    summary: "Health check",
                    responses: {
                        "200": {
                            description: "Service is healthy",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: {
                                                type: "string"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/docs": {
                get: {
                    summary: "OpenAPI specification",
                    responses: {
                        "200": {
                            description: "OpenAPI JSON spec"
                        }
                    }
                }
            },
            "/items": {
                get: {
                    summary: "List training items",
                    responses: {
                        "200": {
                            description: "List of training items",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object"
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/items/{id}": {
                get: {
                    summary: "Get training item by id",
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string"
                            }
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Training item"
                        },
                        "404": {
                            description: "Item not found"
                        }
                    }
                }
            },
            "/process": {
                post: {
                    summary: "Process source into training items",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        source: {
                                            type: "string"
                                        },
                                        options: {
                                            type: "object"
                                        }
                                    },
                                    required: ["source"]
                                }
                            }
                        }
                    },
                    responses: {
                        "200": {
                            description: "Processed items"
                        }
                    }
                }
            },
            "/export": {
                post: {
                    summary: "Export training items",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        format: {
                                            type: "string"
                                        },
                                        options: {
                                            type: "object"
                                        }
                                    },
                                    required: ["format"]
                                }
                            }
                        }
                    },
                    responses: {
                        "200": {
                            description: "Exported content"
                        }
                    }
                }
            }
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer"
                }
            }
        }
    }
}
