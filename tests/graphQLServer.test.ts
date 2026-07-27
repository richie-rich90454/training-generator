// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest"
import http from "http"
import { GraphQLServer } from "../src/core/graphQLServer.js"
import { TrainingItem } from "../src/types/interfaces.js"
vi.mock("graphql-yoga", ()=>{
    function filterSelection(value: any, selection: string): any{
        if (value===null||value===undefined) return null
        if (Array.isArray(value)) return value.map((v)=>filterSelection(v, selection))
        if (selection.trim().length===0) return value
        let fields=selection.trim().split(/\s+/)
        let out: any={}
        for (let f of fields){
            out[f]=value[f]
        }
        return out
    }
    function parseArgs(argStr: string, variables: any): any{
        let args: any={}
        let re=/(\w+)\s*:\s*(?:\$([\w]+)|"([^"]*)"|(\d+(?:\.\d+)?)|true|false|null)/g
        let m
        while ((m=re.exec(argStr))!==null){
            let key=m[1]
            let val: any
            if (m[2]!==undefined){
                val=variables?.[m[2]]
            }
            else if (m[3]!==undefined){
                val=m[3]
            }
            else if (m[4]!==undefined){
                val=Number(m[4])
            }
            else{
                val=null
            }
            args[key]=val
        }
        return args
    }
    async function execute(resolvers: any, query: string, variables: any, ctx: any): Promise<any>{
        let q=query.replace(/#[^\n\r]*/g, "").replace(/\s+/g, " ")
        let operation="query"
        let opMatch=q.match(/^\s*(query|mutation|subscription)\b/)
        if (opMatch){
            operation=opMatch[1]
            q=q.slice(opMatch[0].length)
        }
        q=q.replace(/^[\w(,$:!\s\[\])]*\{/, "").replace(/\}\s*$/, "").trim()
        let fieldMatch=q.match(/^(\w+)(?:\(([^)]*)\))?\s*(?:\{([^}]*)\})?/)
        if (!fieldMatch){
            return {data: null}
        }
        let field=fieldMatch[1]
        let argStr=fieldMatch[2]??""
        let selection=fieldMatch[3]??""
        let args=parseArgs(argStr, variables)
        let rootName=operation==="query"?"Query":operation==="mutation"?"Mutation":"Subscription"
        let root=resolvers[rootName]
        if (!root||!root[field]){
            return {data: null}
        }
        let resolver=root[field]
        try{
            if (operation==="subscription"){
                let subFn=resolver.subscribe||resolver
                let iterator=await subFn(null, args, ctx)
                let result=await Promise.race([
                    iterator.next(),
                    new Promise<IteratorResult<any>>((_, reject)=>setTimeout(()=>reject(new Error("subscription timeout")), 500))
                ])
                return {data: {[field]: filterSelection(result.value, selection)}}
            }
            let value=await resolver(null, args, ctx)
            return {data: {[field]: filterSelection(value, selection)}}
        }
        catch(error){
            let message=error instanceof Error?error.message:String(error)
            return {errors: [{message: message}], data: null}
        }
    }
    return {
        createYoga: (options: any)=>{
            return (req: any, res: any)=>{
                let chunks: Buffer[]=[]
                req.on("data", (chunk: any)=>chunks.push(chunk))
                req.on("end", async()=>{
                    try{
                        let body=JSON.parse(Buffer.concat(chunks).toString("utf-8"))
                        let ctx=typeof options.context==="function"?options.context({req}):options.context
                        let result=await execute(options.resolvers, body.query, body.variables, ctx)
                        let data=JSON.stringify(result)
                        res.writeHead(200, {"Content-Type": "application/json"})
                        res.end(data)
                    }
                    catch(error){
                        let message=error instanceof Error?error.message:String(error)
                        let data=JSON.stringify({errors: [{message: message}], data: null})
                        res.writeHead(200, {"Content-Type": "application/json"})
                        res.end(data)
                    }
                })
            }
        }
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
function graphqlRequest(server: GraphQLServer, query: string, variables?: object, token?: string): Promise<{status: number, body: string}>{
    let headers: Record<string, string>={"content-type": "application/json"}
    if (token){
        headers["authorization"]="Bearer "+token
    }
    let body=Buffer.from(JSON.stringify({query: query, variables: variables}))
    return request(server.getUrl(), {method: "POST", path: "/graphql", headers: headers}, body)
}
describe("GraphQLServer", ()=>{
    let server: GraphQLServer|undefined
    afterEach(async()=>{
        if (server){
            await server.stop()
            server=undefined
        }
    })
    it("starts and stops", async()=>{
        server=new GraphQLServer({port: 0})
        await server.start()
        expect(server.getUrl()).toMatch(/^http:\/\/localhost:\d+$/)
        await server.stop()
        expect(server.getUrl()).toBe("http://localhost:0")
    })
    it("getUrl returns configured port before start", ()=>{
        server=new GraphQLServer({port: 5678})
        expect(server.getUrl()).toBe("http://localhost:5678")
    })
    it("health query returns ok", async()=>{
        server=new GraphQLServer({port: 0})
        await server.start()
        let res=await graphqlRequest(server, "{ health }")
        expect(res.status).toBe(200)
        expect(JSON.parse(res.body)).toEqual({data: {health: "ok"}})
    })
    it("items query returns list", async()=>{
        let item1: TrainingItem={format: "text", text: "hello"}
        let item2: TrainingItem={format: "instruction", instruction: "do this", output: "done"}
        server=new GraphQLServer({
            port: 0,
            itemStore: {
                list: ()=>[item1, item2],
                get: ()=>undefined
            }
        })
        await server.start()
        let res=await graphqlRequest(server, "query { items { id format text } }")
        expect(res.status).toBe(200)
        let data=JSON.parse(res.body).data.items
        expect(data.length).toBe(2)
        expect(data[0].id).toBe("0")
        expect(data[1].format).toBe("instruction")
    })
    it("items query returns empty when no store", async()=>{
        server=new GraphQLServer({port: 0})
        await server.start()
        let res=await graphqlRequest(server, "query { items { id format } }")
        expect(res.status).toBe(200)
        expect(JSON.parse(res.body).data.items).toEqual([])
    })
    it("item query returns item", async()=>{
        let item: TrainingItem={format: "text", text: "hello"}
        server=new GraphQLServer({
            port: 0,
            itemStore: {
                list: ()=>[item],
                get: (id: string)=>id==="1"?item:undefined
            }
        })
        await server.start()
        let res=await graphqlRequest(server, "query ($id: ID!) { item(id: $id) { id format text } }", {id: "1"})
        expect(res.status).toBe(200)
        expect(JSON.parse(res.body).data.item).toEqual({id: "1", format: "text", text: "hello"})
    })
    it("item query returns null when not found", async()=>{
        server=new GraphQLServer({port: 0, itemStore: {list: ()=>[], get: ()=>undefined}})
        await server.start()
        let res=await graphqlRequest(server, "query ($id: ID!) { item(id: $id) { id format } }", {id: "missing"})
        expect(res.status).toBe(200)
        expect(JSON.parse(res.body).data.item).toBeNull()
    })
    it("process mutation invokes processor", async()=>{
        let processor=vi.fn(async(source: string, options?: object)=>{
            return [{format: "text", text: "processed: "+source}] as TrainingItem[]
        })
        server=new GraphQLServer({port: 0, processor: processor})
        await server.start()
        let res=await graphqlRequest(server, "mutation ($source: String!, $options: String) { process(source: $source, options: $options) { id format text } }", {source: "input", options: JSON.stringify({max: 5})})
        expect(res.status).toBe(200)
        expect(processor).toHaveBeenCalledTimes(1)
        let call=processor.mock.calls[0]
        expect(call[0]).toBe("input")
        expect(call[1]).toEqual({max: 5})
        let data=JSON.parse(res.body).data.process
        expect(data.length).toBe(1)
        expect(data[0].text).toBe("processed: input")
    })
    it("process mutation rejects invalid options JSON", async()=>{
        let processor=vi.fn(async()=>{
            return [] as TrainingItem[]
        })
        server=new GraphQLServer({port: 0, processor: processor})
        await server.start()
        let res=await graphqlRequest(server, "mutation ($source: String!, $options: String) { process(source: $source, options: $options) { id format } }", {source: "x", options: "not json"})
        expect(res.status).toBe(200)
        expect(JSON.parse(res.body).errors[0].message).toBe("invalid options JSON")
    })
    it("process mutation returns empty when processor not configured", async()=>{
        server=new GraphQLServer({port: 0})
        await server.start()
        let res=await graphqlRequest(server, "mutation ($source: String!) { process(source: $source) { id format } }", {source: "x"})
        expect(res.status).toBe(200)
        expect(JSON.parse(res.body).data.process).toEqual([])
    })
    it("auth rejects missing token", async()=>{
        server=new GraphQLServer({port: 0, token: "secret"})
        await server.start()
        let res=await graphqlRequest(server, "{ health }")
        expect(res.status).toBe(200)
        expect(JSON.parse(res.body).errors[0].message).toBe("unauthorized")
    })
    it("auth accepts valid token", async()=>{
        server=new GraphQLServer({port: 0, token: "secret"})
        await server.start()
        let res=await graphqlRequest(server, "{ health }", undefined, "secret")
        expect(res.status).toBe(200)
        expect(JSON.parse(res.body)).toEqual({data: {health: "ok"}})
    })
    it("auth rejects invalid token", async()=>{
        server=new GraphQLServer({port: 0, token: "secret"})
        await server.start()
        let res=await graphqlRequest(server, "{ health }", undefined, "wrong")
        expect(res.status).toBe(200)
        expect(JSON.parse(res.body).errors[0].message).toBe("unauthorized")
    })
    it("subscription receives progress event", async()=>{
        server=new GraphQLServer({port: 0})
        await server.start()
        let body=Buffer.from(JSON.stringify({query: "subscription { progress { step percent message } }"}))
        let promise=request(server.getUrl(), {method: "POST", path: "/graphql", headers: {"content-type": "application/json"}}, body)
        setTimeout(()=>{
            server?.pubsub.publish("PROGRESS", {step: "ingest", percent: 25, message: "working"})
        }, 50)
        let res=await promise
        expect(res.status).toBe(200)
        expect(JSON.parse(res.body).data.progress).toEqual({step: "ingest", percent: 25, message: "working"})
    })
    it("subscription rejects unauthorized", async()=>{
        server=new GraphQLServer({port: 0, token: "secret"})
        await server.start()
        let res=await graphqlRequest(server, "subscription { progress { step percent message } }")
        expect(res.status).toBe(200)
        expect(JSON.parse(res.body).errors[0].message).toBe("unauthorized")
    })
    it("schema is valid", ()=>{
        server=new GraphQLServer({port: 0})
        let s=server.typeDefs
        expect(s).toContain("type TrainingItem")
        expect(s).toContain("type Query")
        expect(s).toContain("type Mutation")
        expect(s).toContain("type Subscription")
        expect(s).toContain("type ProgressEvent")
        expect(s).toContain("progress: ProgressEvent")
    })
    it("throws when graphql-yoga not installed", async()=>{
        vi.resetModules()
        vi.doMock("graphql-yoga", ()=>{
            throw new Error("Cannot find module 'graphql-yoga'")
        })
        let {GraphQLServer}=await import("../src/core/graphQLServer.js")
        server=new GraphQLServer({port: 0})
        await expect(server.start()).rejects.toThrow("graphql-yoga not installed")
        vi.doUnmock("graphql-yoga")
    })
    it("stop is idempotent", async()=>{
        server=new GraphQLServer({port: 0})
        await expect(server.stop()).resolves.toBeUndefined()
    })
})
