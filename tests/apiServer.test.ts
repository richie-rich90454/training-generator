// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest"
import http from "http"
import { ApiServer, ProcessRequest, generateOpenApiSpec } from "../src/core/apiServer.js"
import { TrainingItem } from "../src/types/interfaces.js"
vi.mock("express", ()=>{
    return {
        default: vi.fn()
    }
})
function request(targetUrl: string, options: http.RequestOptions, body?: Buffer): Promise<{status: number, body: string, headers: http.IncomingHttpHeaders}>{
    return new Promise((resolve, reject)=>{
        let req=http.request(targetUrl, options, (res)=>{
            let chunks: Buffer[]=[]
            res.on("data", (chunk)=>chunks.push(chunk as Buffer))
            res.on("end", ()=>{
                resolve({status: res.statusCode??0, body: Buffer.concat(chunks).toString("utf-8"), headers: res.headers})
            })
        })
        req.on("error", reject)
        if (body){
            req.write(body)
        }
        req.end()
    })
}
describe("ApiServer", ()=>{
    let server: ApiServer|undefined
    afterEach(async()=>{
        if (server){
            await server.stop()
            server=undefined
        }
    })
    it("starts and stops", async()=>{
        server=new ApiServer({port: 0})
        await server.start()
        expect(server.getUrl()).toMatch(/^http:\/\/localhost:\d+$/)
        await server.stop()
        expect(server.getUrl()).toBe("http://localhost:0")
    })
    it("getUrl returns configured port before start", ()=>{
        server=new ApiServer({port: 3456})
        expect(server.getUrl()).toBe("http://localhost:3456")
    })
    it("healthz returns ok", async()=>{
        server=new ApiServer({port: 0})
        await server.start()
        let res=await request(server.getUrl(), {method: "GET", path: "/healthz"})
        expect(res.status).toBe(200)
        expect(JSON.parse(res.body)).toEqual({status: "ok"})
    })
    it("docs returns OpenAPI spec", async()=>{
        server=new ApiServer({port: 0})
        await server.start()
        let res=await request(server.getUrl(), {method: "GET", path: "/docs"})
        expect(res.status).toBe(200)
        let spec=JSON.parse(res.body)
        expect(spec.openapi).toBe("3.0.0")
        expect(spec.info.title).toBe("Training Generator API")
    })
    it("docs spec documents all endpoints", ()=>{
        let spec=generateOpenApiSpec() as Record<string, any>
        let paths=Object.keys(spec.paths)
        expect(paths).toContain("/healthz")
        expect(paths).toContain("/docs")
        expect(paths).toContain("/items")
        expect(paths).toContain("/items/{id}")
        expect(paths).toContain("/process")
        expect(paths).toContain("/export")
    })
    it("items lists items", async()=>{
        let item1: TrainingItem={format: "text", text: "hello"}
        let item2: TrainingItem={format: "instruction", instruction: "do this", output: "done"}
        server=new ApiServer({
            port: 0,
            itemStore: {
                list: ()=>[item1, item2],
                get: ()=>undefined
            }
        })
        await server.start()
        let res=await request(server.getUrl(), {method: "GET", path: "/items"})
        expect(res.status).toBe(200)
        let data=JSON.parse(res.body)
        expect(data.items.length).toBe(2)
        expect(data.count).toBe(2)
    })
    it("items returns empty list when no store", async()=>{
        server=new ApiServer({port: 0})
        await server.start()
        let res=await request(server.getUrl(), {method: "GET", path: "/items"})
        expect(res.status).toBe(200)
        let data=JSON.parse(res.body)
        expect(data.items).toEqual([])
        expect(data.count).toBe(0)
    })
    it("items by id returns item", async()=>{
        let item1: TrainingItem={format: "text", text: "hello"}
        server=new ApiServer({
            port: 0,
            itemStore: {
                list: ()=>[item1],
                get: (id: string)=>id==="1"?item1:undefined
            }
        })
        await server.start()
        let res=await request(server.getUrl(), {method: "GET", path: "/items/1"})
        expect(res.status).toBe(200)
        expect(JSON.parse(res.body)).toEqual(item1)
    })
    it("items by id returns 404", async()=>{
        server=new ApiServer({
            port: 0,
            itemStore: {
                list: ()=>[],
                get: ()=>undefined
            }
        })
        await server.start()
        let res=await request(server.getUrl(), {method: "GET", path: "/items/missing"})
        expect(res.status).toBe(404)
        expect(JSON.parse(res.body)).toEqual({error: "not found"})
    })
    it("process invokes processor", async()=>{
        let processor=vi.fn(async(req: ProcessRequest)=>{
            return [{format: "text", text: "processed: "+req.source}] as TrainingItem[]
        })
        server=new ApiServer({port: 0, processor: processor})
        await server.start()
        let body=Buffer.from(JSON.stringify({source: "input", options: {max: 5}}))
        let res=await request(server.getUrl(), {method: "POST", path: "/process", headers: {"content-type": "application/json"}}, body)
        expect(res.status).toBe(200)
        expect(processor).toHaveBeenCalledTimes(1)
        let call=processor.mock.calls[0][0]
        expect(call.source).toBe("input")
        expect(call.options).toEqual({max: 5})
    })
    it("process returns count", async()=>{
        let processor=vi.fn(async()=>{
            return [{format: "text", text: "a"}, {format: "text", text: "b"}] as TrainingItem[]
        })
        server=new ApiServer({port: 0, processor: processor})
        await server.start()
        let body=Buffer.from(JSON.stringify({source: "x"}))
        let res=await request(server.getUrl(), {method: "POST", path: "/process", headers: {"content-type": "application/json"}}, body)
        expect(res.status).toBe(200)
        let data=JSON.parse(res.body)
        expect(data.count).toBe(2)
        expect(data.items.length).toBe(2)
    })
    it("process returns 400 when source missing", async()=>{
        server=new ApiServer({port: 0, processor: vi.fn()})
        await server.start()
        let body=Buffer.from(JSON.stringify({options: {}}))
        let res=await request(server.getUrl(), {method: "POST", path: "/process", headers: {"content-type": "application/json"}}, body)
        expect(res.status).toBe(400)
        expect(JSON.parse(res.body).error).toBe("source is required")
    })
    it("process returns 400 on invalid JSON", async()=>{
        server=new ApiServer({port: 0, processor: vi.fn()})
        await server.start()
        let body=Buffer.from("not json")
        let res=await request(server.getUrl(), {method: "POST", path: "/process", headers: {"content-type": "application/json"}}, body)
        expect(res.status).toBe(400)
        expect(JSON.parse(res.body).error).toBe("invalid JSON")
    })
    it("process returns 501 when processor not configured", async()=>{
        server=new ApiServer({port: 0})
        await server.start()
        let body=Buffer.from(JSON.stringify({source: "x"}))
        let res=await request(server.getUrl(), {method: "POST", path: "/process", headers: {"content-type": "application/json"}}, body)
        expect(res.status).toBe(501)
        expect(JSON.parse(res.body).error).toBe("processor not configured")
    })
    it("export invokes exporter", async()=>{
        let exporter=vi.fn(async(format: string, items: TrainingItem[])=>{
            return JSON.stringify({format: format, count: items.length})
        })
        let item: TrainingItem={format: "text", text: "x"}
        server=new ApiServer({
            port: 0,
            exporter: exporter,
            itemStore: {
                list: ()=>[item],
                get: ()=>undefined
            }
        })
        await server.start()
        let body=Buffer.from(JSON.stringify({format: "json"}))
        let res=await request(server.getUrl(), {method: "POST", path: "/export", headers: {"content-type": "application/json"}}, body)
        expect(res.status).toBe(200)
        expect(exporter).toHaveBeenCalledWith("json", [item])
    })
    it("export sets json content-type", async()=>{
        server=new ApiServer({
            port: 0,
            exporter: async()=>"[]",
            itemStore: {list: ()=>[], get: ()=>undefined}
        })
        await server.start()
        let body=Buffer.from(JSON.stringify({format: "json"}))
        let res=await request(server.getUrl(), {method: "POST", path: "/export", headers: {"content-type": "application/json"}}, body)
        expect(res.headers["content-type"]).toContain("application/json")
    })
    it("export sets csv content-type", async()=>{
        server=new ApiServer({
            port: 0,
            exporter: async()=>"a,b",
            itemStore: {list: ()=>[], get: ()=>undefined}
        })
        await server.start()
        let body=Buffer.from(JSON.stringify({format: "csv"}))
        let res=await request(server.getUrl(), {method: "POST", path: "/export", headers: {"content-type": "application/json"}}, body)
        expect(res.headers["content-type"]).toContain("text/csv")
    })
    it("export returns buffer content", async()=>{
        server=new ApiServer({
            port: 0,
            exporter: async()=>Buffer.from("binary"),
            itemStore: {list: ()=>[], get: ()=>undefined}
        })
        await server.start()
        let body=Buffer.from(JSON.stringify({format: "bin"}))
        let res=await request(server.getUrl(), {method: "POST", path: "/export", headers: {"content-type": "application/json"}}, body)
        expect(res.status).toBe(200)
        expect(res.body).toBe("binary")
    })
    it("export returns 400 when format missing", async()=>{
        server=new ApiServer({port: 0, exporter: vi.fn()})
        await server.start()
        let body=Buffer.from(JSON.stringify({options: {}}))
        let res=await request(server.getUrl(), {method: "POST", path: "/export", headers: {"content-type": "application/json"}}, body)
        expect(res.status).toBe(400)
        expect(JSON.parse(res.body).error).toBe("format is required")
    })
    it("export returns 501 when exporter not configured", async()=>{
        server=new ApiServer({port: 0})
        await server.start()
        let body=Buffer.from(JSON.stringify({format: "json"}))
        let res=await request(server.getUrl(), {method: "POST", path: "/export", headers: {"content-type": "application/json"}}, body)
        expect(res.status).toBe(501)
        expect(JSON.parse(res.body).error).toBe("exporter not configured")
    })
    it("auth rejects missing token", async()=>{
        server=new ApiServer({port: 0, token: "secret", itemStore: {list: ()=>[], get: ()=>undefined}})
        await server.start()
        let res=await request(server.getUrl(), {method: "GET", path: "/items"})
        expect(res.status).toBe(401)
        expect(JSON.parse(res.body)).toEqual({error: "unauthorized"})
    })
    it("auth accepts valid token", async()=>{
        server=new ApiServer({port: 0, token: "secret", itemStore: {list: ()=>[], get: ()=>undefined}})
        await server.start()
        let res=await request(server.getUrl(), {method: "GET", path: "/items", headers: {"authorization": "Bearer secret"}})
        expect(res.status).toBe(200)
    })
    it("no auth when token not set", async()=>{
        server=new ApiServer({port: 0, itemStore: {list: ()=>[], get: ()=>undefined}})
        await server.start()
        let res=await request(server.getUrl(), {method: "GET", path: "/items"})
        expect(res.status).toBe(200)
    })
    it("returns 404 for unknown routes", async()=>{
        server=new ApiServer({port: 0})
        await server.start()
        let res=await request(server.getUrl(), {method: "GET", path: "/unknown"})
        expect(res.status).toBe(404)
        expect(JSON.parse(res.body)).toEqual({error: "not found"})
    })
})
describe("express integration", ()=>{
    it("throws when express is not installed", async()=>{
        vi.resetModules()
        vi.doMock("express", ()=>{
            throw new Error("Cannot find module 'express'")
        })
        let {ApiServer}=await import("../src/core/apiServer.js")
        let server=new ApiServer({port: 0})
        await expect(server.start()).rejects.toThrow("express not installed")
        vi.doUnmock("express")
    })
})
