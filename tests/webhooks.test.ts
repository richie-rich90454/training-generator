import{describe, test, expect, vi, beforeEach, afterEach}from"vitest"
import{Readable}from"stream"
import http from"http"
const{mockExpressJson, mockAppUse, mockAppGet, mockAppPost, createMockApp}=vi.hoisted(()=>{
    let mockExpressJson=vi.fn()
    let mockAppUse=vi.fn()
    let mockAppGet=vi.fn()
    let mockAppPost=vi.fn()
    let createMockApp=()=>{
        return{
            use: mockAppUse,
            get: mockAppGet,
            post: mockAppPost
        }
    }
    return{
        mockExpressJson: mockExpressJson,
        mockAppUse: mockAppUse,
        mockAppGet: mockAppGet,
        mockAppPost: mockAppPost,
        createMockApp: createMockApp
    }
})
vi.mock("express", ()=>{
    return{
        default: Object.assign(()=>createMockApp(), {
            json: ()=>mockExpressJson
        })
    }
})
vi.mock("axios", ()=>{
    return{
        default:{
            post: vi.fn()
        }
    }
})
import axios from"axios"
import{WebhookOutput, WebhookInput, createWebhookApp, parseMultipartBody}from"../src/core/webhooks.js"
function encodeMultipart(boundary: string, parts: {name: string, value?: string, filename?: string, data?: Buffer, contentType?: string}[]): Buffer{
    let chunks: Buffer[]=[]
    for (let part of parts){
        chunks.push(Buffer.from("--"+boundary+"\r\n"))
        if (part.filename!==undefined){
            let header="Content-Disposition: form-data; name=\""+part.name+"\"; filename=\""+part.filename+"\"\r\n"
            if (part.contentType){
                header+="Content-Type: "+part.contentType+"\r\n"
            }
            chunks.push(Buffer.from(header))
        }
        else{
            chunks.push(Buffer.from("Content-Disposition: form-data; name=\""+part.name+"\"\r\n"))
        }
        chunks.push(Buffer.from("\r\n"))
        if (part.data){
            chunks.push(part.data)
        }
        else if (part.value!==undefined){
            chunks.push(Buffer.from(part.value))
        }
        chunks.push(Buffer.from("\r\n"))
    }
    chunks.push(Buffer.from("--"+boundary+"--\r\n"))
    return Buffer.concat(chunks)
}
function mockReq(body: Buffer, contentType: string): http.IncomingMessage{
    let req=new Readable({read(){}}) as unknown as http.IncomingMessage
    req.headers={"content-type": contentType}
    process.nextTick(()=>{
        req.push(body)
        req.push(null)
    })
    return req
}
function request(port: number, options: http.RequestOptions, body?: Buffer): Promise<{status: number, body: string}>{
    return new Promise((resolve, reject)=>{
        let req=http.request({...options, port: port}, (res)=>{
            let chunks: Buffer[]=[]
            res.on("data", (chunk)=>{
                chunks.push(chunk as Buffer)
            })
            res.on("end", ()=>{
                resolve({status: res.statusCode??0, body: Buffer.concat(chunks).toString("utf-8")})
            })
        })
        req.on("error", reject)
        if (body){
            req.write(body)
        }
        req.end()
    })
}
beforeEach(()=>{
    vi.clearAllMocks()
})
describe("WebhookOutput", ()=>{
    test("sends POST with JSON", async()=>{
        (axios.post as any).mockResolvedValue({status: 200, data: {ok: true}})
        let output=new WebhookOutput({url: "https://example.com/hook"})
        let result=await output.send({batch: 1})
        expect(axios.post).toHaveBeenCalledWith("https://example.com/hook", {batch: 1}, expect.objectContaining({headers: {"Content-Type": "application/json"}}))
        expect(result.success).toBe(true)
        expect(result.status).toBe(200)
        expect(result.attempts).toBe(1)
    })
    test("adds bearer token", async()=>{
        (axios.post as any).mockResolvedValue({status: 202})
        let output=new WebhookOutput({url: "https://example.com/hook", token: "secret"})
        await output.send({x: 1})
        expect(axios.post).toHaveBeenCalledWith("https://example.com/hook", {x: 1}, expect.objectContaining({headers: {"Content-Type": "application/json", "Authorization": "Bearer secret"}}))
    })
    test("omits authorization without token", async()=>{
        (axios.post as any).mockResolvedValue({status: 200})
        let output=new WebhookOutput({url: "https://example.com/hook"})
        await output.send({x: 1})
        let call=(axios.post as any).mock.calls[0]
        expect(call[2].headers).not.toHaveProperty("Authorization")
    })
    test("retries on non-2xx", async()=>{
        (axios.post as any).mockResolvedValue({status: 500})
        let output=new WebhookOutput({url: "https://example.com/hook", maxRetries: 2, retryDelayMs: 1})
        let result=await output.send({x: 1})
        expect(result.success).toBe(false)
        expect(result.attempts).toBe(3)
        expect(axios.post).toHaveBeenCalledTimes(3)
    })
    test("retries on network error", async()=>{
        (axios.post as any).mockRejectedValue(new Error("ECONNREFUSED"))
        let output=new WebhookOutput({url: "https://example.com/hook", maxRetries: 1, retryDelayMs: 1})
        let result=await output.send({x: 1})
        expect(result.success).toBe(false)
        expect(result.attempts).toBe(2)
    })
    test("exponential backoff", async()=>{
        let timeouts: number[]=[]
        let originalSetTimeout=global.setTimeout
        let patchedSetTimeout=((callback: any, ms?: number)=>{
            if (typeof ms==="number"){
                timeouts.push(ms)
            }
            return originalSetTimeout(callback, 1)
        }) as any
        global.setTimeout=patchedSetTimeout
        try{
            (axios.post as any).mockResolvedValueOnce({status: 500}).mockResolvedValueOnce({status: 500}).mockResolvedValueOnce({status: 200})
            let output=new WebhookOutput({url: "https://example.com/hook", maxRetries: 3, retryDelayMs: 10})
            let result=await output.send({x: 1})
            expect(result.success).toBe(true)
            expect(timeouts).toEqual([10, 20])
        }
        finally{
            global.setTimeout=originalSetTimeout
        }
    })
    test("returns attempts count on success", async()=>{
        (axios.post as any).mockResolvedValueOnce({status: 500}).mockResolvedValueOnce({status: 200})
        let output=new WebhookOutput({url: "https://example.com/hook", maxRetries: 3, retryDelayMs: 1})
        let result=await output.send({x: 1})
        expect(result.success).toBe(true)
        expect(result.attempts).toBe(2)
    })
    test("stops on 2xx", async()=>{
        (axios.post as any).mockResolvedValue({status: 201})
        let output=new WebhookOutput({url: "https://example.com/hook", maxRetries: 5})
        let result=await output.send({x: 1})
        expect(result.success).toBe(true)
        expect(result.attempts).toBe(1)
        expect(axios.post).toHaveBeenCalledTimes(1)
    })
})
describe("WebhookInput", ()=>{
    let input: WebhookInput
    afterEach(async()=>{
        if (input){
            await input.stop()
        }
    })
    test("health endpoint", async()=>{
        input=new WebhookInput({port: 0})
        await input.start()
        let res=await request(input.getPort(), {method: "GET", path: "/health"})
        expect(res.status).toBe(200)
        expect(JSON.parse(res.body)).toEqual({status: "ok"})
    })
    test("requires auth when token configured", async()=>{
        input=new WebhookInput({port: 0, token: "secret"})
        await input.start()
        let res=await request(input.getPort(), {method: "POST", path: "/upload", headers: {"content-type": "multipart/form-data; boundary=abc"}})
        expect(res.status).toBe(401)
    })
    test("accepts upload and calls onUpload", async()=>{
        let uploadedFiles: Buffer[]=[]
        let uploadedMeta: Record<string, unknown>={}
        input=new WebhookInput({port: 0, token: "secret", onUpload: async(files, metadata)=>{
            uploadedFiles=files
            uploadedMeta=metadata
        }})
        await input.start()
        let body=encodeMultipart("abc", [{name: "file", filename: "a.txt", data: Buffer.from("hello"), contentType: "text/plain"}, {name: "meta", value: "value1"}])
        let res=await request(input.getPort(), {method: "POST", path: "/upload", headers: {"content-type": "multipart/form-data; boundary=abc", "authorization": "Bearer secret"}}, body)
        expect(res.status).toBe(200)
        expect(JSON.parse(res.body)).toEqual({received: 1})
        expect(uploadedFiles.length).toBe(1)
        expect(uploadedFiles[0].toString()).toBe("hello")
        expect(uploadedMeta.meta).toBe("value1")
    })
    test("accepts multiple files", async()=>{
        let count=0
        input=new WebhookInput({port: 0, token: "secret", onUpload: (files)=>{
            count=files.length
        }})
        await input.start()
        let body=encodeMultipart("abc", [{name: "file", filename: "a.txt", data: Buffer.from("1")}, {name: "file", filename: "b.txt", data: Buffer.from("2")}])
        let res=await request(input.getPort(), {method: "POST", path: "/upload", headers: {"content-type": "multipart/form-data; boundary=abc", "authorization": "Bearer secret"}}, body)
        expect(res.status).toBe(200)
        expect(count).toBe(2)
    })
    test("start and stop", async()=>{
        input=new WebhookInput({port: 0})
        await input.start()
        let res=await request(input.getPort(), {method: "GET", path: "/health"})
        expect(res.status).toBe(200)
        await input.stop()
        await expect(request(input.getPort(), {method: "GET", path: "/health"})).rejects.toThrow()
    })
    test("rejects non-multipart upload", async()=>{
        input=new WebhookInput({port: 0, token: "secret"})
        await input.start()
        let res=await request(input.getPort(), {method: "POST", path: "/upload", headers: {"content-type": "application/json", "authorization": "Bearer secret"}}, Buffer.from("{}"))
        expect(res.status).toBe(400)
    })
})
describe("parseMultipartBody", ()=>{
    test("collects file buffers", async()=>{
        let body=encodeMultipart("xyz", [{name: "file", filename: "a.txt", data: Buffer.from("data")}])
        let req=mockReq(body, "multipart/form-data; boundary=xyz")
        let result=await parseMultipartBody(req)
        expect(result.files.length).toBe(1)
        expect(result.files[0].toString()).toBe("data")
    })
    test("collects metadata fields", async()=>{
        let body=encodeMultipart("xyz", [{name: "project", value: "p1"}, {name: "file", filename: "a.txt", data: Buffer.from("x")}])
        let req=mockReq(body, "multipart/form-data; boundary=xyz")
        let result=await parseMultipartBody(req)
        expect(result.metadata.project).toBe("p1")
    })
    test("ignores non-file fields without filename", async()=>{
        let body=encodeMultipart("xyz", [{name: "note", value: "n"}])
        let req=mockReq(body, "multipart/form-data; boundary=xyz")
        let result=await parseMultipartBody(req)
        expect(result.files.length).toBe(0)
        expect(result.metadata.note).toBe("n")
    })
    test("throws on missing boundary", async()=>{
        let req=mockReq(Buffer.from("x"), "multipart/form-data")
        await expect(parseMultipartBody(req)).rejects.toThrow()
    })
})
describe("createWebhookApp", ()=>{
    test("returns express app with routes", async()=>{
        let app=await createWebhookApp()
        expect(app.use).toHaveBeenCalledWith(mockExpressJson)
        expect(app.get).toHaveBeenCalledWith("/health", expect.any(Function))
        expect(app.post).toHaveBeenCalledWith("/upload", expect.any(Function))
    })
    test("health handler returns ok", async()=>{
        let app=await createWebhookApp()
        let calls=mockAppGet.mock.calls as any[]
        let handler=calls.find(call=>call[0]==="/health")[1]
        let resJson=vi.fn()
        let res={json: resJson}
        handler({}, res)
        expect(resJson).toHaveBeenCalledWith({status: "ok"})
    })
    test("upload handler requires bearer token", async()=>{
        let app=await createWebhookApp("token")
        let calls=mockAppPost.mock.calls as any[]
        let handler=calls.find(call=>call[0]==="/upload")[1]
        let status=vi.fn().mockReturnThis()
        let json=vi.fn()
        let res={status: status, json: json}
        let req={headers: {}}
        await handler(req, res, ()=>{})
        expect(status).toHaveBeenCalledWith(401)
        expect(json).toHaveBeenCalledWith({error: "unauthorized"})
    })
    test("upload handler parses multipart and returns count", async()=>{
        let app=await createWebhookApp("token")
        let calls=mockAppPost.mock.calls as any[]
        let handler=calls.find(call=>call[0]==="/upload")[1]
        let json=vi.fn()
        let res={status: vi.fn().mockReturnThis(), json: json}
        let body=encodeMultipart("b", [{name: "file", filename: "a.txt", data: Buffer.from("d")}])
        let req=mockReq(body, "multipart/form-data; boundary=b")
        req.headers.authorization="Bearer token"
        await handler(req, res, ()=>{})
        expect(json).toHaveBeenCalledWith({received: 1})
    })
})