import http from "http"
import axios from "axios"
export interface WebhookOutputOptions{
    url: string
    token?: string
    maxRetries?: number
    retryDelayMs?: number
}
export interface WebhookSendResult{
    success: boolean
    status?: number
    attempts: number
}
export class WebhookOutput{
    private url: string
    private token?: string
    private maxRetries: number
    private retryDelayMs: number
    constructor(options: WebhookOutputOptions){
        this.url=options.url
        this.token=options.token
        this.maxRetries=options.maxRetries??3
        this.retryDelayMs=options.retryDelayMs??1000
    }
    async send(payload: object): Promise<WebhookSendResult>{
        let attempts=0
        let lastStatus: number|undefined
        let lastError: Error|undefined
        while (attempts<=this.maxRetries){
            attempts++
            try{
                let headers: Record<string, string>={
                    "Content-Type": "application/json"
                }
                if (this.token){
                    headers["Authorization"]="Bearer "+this.token
                }
                let response=await axios.post(this.url, payload, {
                    headers: headers,
                    timeout: 30000
                })
                if (response.status>=200&&response.status<300){
                    return {
                        success: true,
                        status: response.status,
                        attempts: attempts
                    }
                }
                lastStatus=response.status
                if (response.status>=400&&response.status<500){
                    break
                }
            }
            catch(error){
                lastError=error instanceof Error?error:new Error(String(error))
            }
            if (attempts>this.maxRetries){
                break
            }
            let delay=this.retryDelayMs*Math.pow(2, attempts-1)
            await new Promise(resolve=>setTimeout(resolve, delay))
        }
        return {
            success: false,
            status: lastStatus,
            attempts: attempts
        }
    }
}
export interface WebhookInputOptions{
    port?: number
    token?: string
    onUpload?: (files: Buffer[], metadata: Record<string, unknown>)=>void|Promise<void>
}
export class WebhookInput{
    private port: number
    private token?: string
    private onUpload?: (files: Buffer[], metadata: Record<string, unknown>)=>void|Promise<void>
    private server?: http.Server
    constructor(options: WebhookInputOptions={}){
        this.port=options.port??3000
        this.token=options.token
        this.onUpload=options.onUpload
    }
    getPort(): number{
        if (this.server){
            let address=this.server.address()
            if (address&&typeof address==="object"){
                return address.port
            }
        }
        return this.port
    }
    async start(): Promise<void>{
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
        let pathname=req.url?.split("?")[0]??"/"
        if (req.method==="GET"&&pathname==="/health"){
            this.sendJson(res, 200, {status: "ok"})
            return
        }
        if (req.method==="POST"&&pathname==="/upload"){
            if (!this.authorize(req, res)){
                return
            }
            let contentType=req.headers["content-type"]??""
            if (!contentType.includes("multipart/form-data")){
                this.sendJson(res, 400, {error: "expected multipart/form-data"})
                return
            }
            try{
                let result=await parseMultipartBody(req)
                if (this.onUpload){
                    await this.onUpload(result.files, result.metadata)
                }
                this.sendJson(res, 200, {received: result.files.length})
            }
            catch(error){
                let message=error instanceof Error?error.message:String(error)
                this.sendJson(res, 400, {error: message})
            }
            return
        }
        this.sendJson(res, 404, {error: "not found"})
    }
    private authorize(req: http.IncomingMessage, res: http.ServerResponse): boolean{
        if (!this.token){
            return true
        }
        let rawAuth=req.headers["authorization"]??""
        let auth=Array.isArray(rawAuth)?rawAuth.join(", "):rawAuth
        if (auth!=="Bearer "+this.token){
            this.sendJson(res, 401, {error: "unauthorized"})
            return false
        }
        return true
    }
    private sendJson(res: http.ServerResponse, status: number, body: object): void{
        let data=JSON.stringify(body)
        res.writeHead(status, {"Content-Type": "application/json"})
        res.end(data)
    }
}
export interface MultipartParseResult{
    files: Buffer[]
    metadata: Record<string, unknown>
}
const MAX_BODY_SIZE=50*1024*1024

export async function parseMultipartBody(req: http.IncomingMessage): Promise<MultipartParseResult>{
    let contentType=req.headers["content-type"]??""
    let boundaryMatch=contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
    if (!boundaryMatch){
        throw new Error("missing multipart boundary")
    }
    let boundary=Buffer.from("--"+(boundaryMatch[1]??boundaryMatch[2]).trim())
    let chunks: Buffer[]=[]
    let size=0
    for await (let chunk of req){
        size+=(chunk as Buffer).length
        if(size>MAX_BODY_SIZE){
            req.destroy()
            throw new Error("request body too large")
        }
        chunks.push(chunk as Buffer)
    }
    let body=Buffer.concat(chunks)
    let files: Buffer[]=[]
    let metadata: Record<string, unknown>={}
    let parts=splitBuffer(body, boundary)
    for (let part of parts){
        let headerEnd=part.indexOf(Buffer.from("\r\n\r\n"))
        if (headerEnd===-1){
            continue
        }
        let headerBytes=part.subarray(0, headerEnd)
        let data=part.subarray(headerEnd+4)
        if (data.length>=2&&data.subarray(data.length-2).toString()==="\r\n"){
            data=data.subarray(0, data.length-2)
        }
        let headers=headerBytes.toString("utf-8").split("\r\n")
        let disposition=headers.find(h=>h.toLowerCase().startsWith("content-disposition"))
        if (!disposition){
            continue
        }
        let nameMatch=disposition.match(/name="([^"]+)"/i)
        let filenameMatch=disposition.match(/filename="([^"]*)"/i)
        let name=nameMatch?decodeHeaderValue(nameMatch[1]):""
        if (filenameMatch){
            if (name==="file"||name.startsWith("file[")){
                files.push(data)
            }
        }
        else if (name){
            metadata[name]=data.toString("utf-8")
        }
    }
    return {files: files, metadata: metadata}
}
function splitBuffer(buffer: Buffer, delimiter: Buffer): Buffer[]{
    let parts: Buffer[]=[]
    let start=0
    while (true){
        let index=buffer.indexOf(delimiter, start)
        if (index===-1){
            break
        }
        let end=index+delimiter.length
        if (buffer.length>=end+2&&buffer.subarray(end, end+2).toString()==="\r\n"){
            end+=2
        }
        else if (buffer.length>=end+2&&buffer.subarray(end, end+2).toString()==="--"){
            end+=2
        }
        let next=buffer.indexOf(delimiter, end)
        if (next===-1){
            break
        }
        parts.push(buffer.subarray(end, next))
        start=next
    }
    return parts
}
function decodeHeaderValue(value: string): string{
    return value.replace(/\\"/g, "\"")
}
export async function createWebhookApp(token?: string): Promise<any>{
    let expressModule: any
    try{
        let moduleName="express"
        expressModule=await import(moduleName)
    }
    catch{
        throw new Error("express not installed")
    }
    let express=expressModule.default??expressModule
    let app=express()
    app.use(express.json())
    app.get("/health", (req: any, res: any)=>{
        res.json({status: "ok"})
    })
    app.post("/upload", async(req: any, res: any, next: any)=>{
        if (token){
            let auth=req.headers?.authorization??req.get?.("authorization")??""
            if (auth!=="Bearer "+token){
                res.status(401).json({error: "unauthorized"})
                return
            }
        }
        try{
            let result=await parseMultipartBody(req)
            res.json({received: result.files.length})
        }
        catch(error){
            res.status(400).json({error: String(error)})
        }
    })
    return app
}