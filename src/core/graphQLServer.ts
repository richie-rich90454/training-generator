import http from "http"
import { TrainingItem } from "../types/interfaces.js"
export interface ProgressEvent{
    step: string
    percent: number
    message: string
}
export interface GraphQLServerOptions{
    port?: number
    token?: string
    itemStore?: {
        list: ()=>TrainingItem[]
        get: (id: string)=>TrainingItem|undefined
    }
    processor?: (source: string, options?: object)=>Promise<TrainingItem[]>
}
export class PubSub{
    private listeners: Map<string, Array<(payload: any)=>void>>=new Map()
    publish(eventName: string, payload: any): void{
        let list=this.listeners.get(eventName)
        if (list){
            list.forEach((cb)=>cb(payload))
        }
    }
    asyncIterator(eventNames: string[]): AsyncIterator<any>{
        let eventName=Array.isArray(eventNames)?eventNames[0]:eventNames
        let queue: any[]=[]
        let pending: Array<(value: IteratorResult<any>)=>void>=[]
        let listener=(payload: any)=>{
            if (pending.length>0){
                let resolve=pending.shift()!
                resolve({value: payload, done: false})
            }
            else{
                queue.push(payload)
            }
        }
        let list=this.listeners.get(eventName)
        if (!list){
            list=[]
            this.listeners.set(eventName, list)
        }
        list.push(listener)
        return {
            next: ()=>{
                if (queue.length>0){
                    return Promise.resolve({value: queue.shift()!, done: false})
                }
                return new Promise((resolve)=>{
                    pending.push(resolve)
                })
            },
            return: ()=>{
                let idx=list.indexOf(listener)
                if (idx>-1){
                    list.splice(idx, 1)
                }
                while (pending.length>0){
                    pending.shift()!({value: undefined, done: true})
                }
                return Promise.resolve({value: undefined, done: true})
            },
            throw: (err: any)=>Promise.reject(err)
        }
    }
}
export class GraphQLServer{
    private port: number
    private token?: string
    private itemStore?: {list: ()=>TrainingItem[]; get: (id: string)=>TrainingItem|undefined}
    private processor?: (source: string, options?: object)=>Promise<TrainingItem[]>
    private server?: http.Server
    private yoga?: http.RequestListener
    public pubsub: PubSub
    public typeDefs: string
    private resolvers: any
    constructor(options: GraphQLServerOptions={}){
        this.port=options.port??4000
        this.token=options.token
        this.itemStore=options.itemStore
        this.processor=options.processor
        this.pubsub=new PubSub()
        this.typeDefs=`type TrainingItem {\n  id: ID\n  format: String\n  instruction: String\n  input: String\n  output: String\n  text: String\n  metadata: String\n}\ntype Query {\n  items: [TrainingItem]\n  item(id: ID!): TrainingItem\n  health: String\n}\ntype Mutation {\n  process(source: String!, options: String): [TrainingItem]\n}\ntype Subscription {\n  progress: ProgressEvent\n}\ntype ProgressEvent {\n  step: String\n  percent: Float\n  message: String\n}`
        this.resolvers=this.buildResolvers()
    }
    private buildResolvers(): any{
        let self=this
        return {
            Query: {
                items: (_parent: any, _args: any, ctx: any)=>{
                    if (!ctx?.authorized){
                        throw new Error("unauthorized")
                    }
                    let items=self.itemStore?self.itemStore.list():[]
                    return items.map((item, idx)=>{
                        return {...item, id: String(idx)}
                    })
                },
                item: (_parent: any, args: {id: string}, ctx: any)=>{
                    if (!ctx?.authorized){
                        throw new Error("unauthorized")
                    }
                    let item=self.itemStore?self.itemStore.get(args.id):undefined
                    if (!item){
                        return null
                    }
                    return {...item, id: args.id}
                },
                health: (_parent: any, _args: any, ctx: any)=>{
                    if (!ctx?.authorized){
                        throw new Error("unauthorized")
                    }
                    return "ok"
                }
            },
            Mutation: {
                process: async (_parent: any, args: {source: string; options?: string}, ctx: any)=>{
                    if (!ctx?.authorized){
                        throw new Error("unauthorized")
                    }
                    if (!self.processor){
                        return []
                    }
                    let opts=undefined
                    if (args.options){
                        try{
                            opts=JSON.parse(args.options)
                        }
                        catch{
                            throw new Error("invalid options JSON")
                        }
                    }
                    let result=await self.processor(args.source, opts)
                    return result.map((item, idx)=>{
                        return {...item, id: String(idx)}
                    })
                }
            },
            Subscription: {
                progress: {
                    subscribe: (_parent: any, _args: any, ctx: any)=>{
                        if (!ctx?.authorized){
                            throw new Error("unauthorized")
                        }
                        return self.pubsub.asyncIterator(["PROGRESS"])
                    }
                }
            },
            TrainingItem: {
                metadata: (parent: TrainingItem)=>{
                    return parent.metadata?JSON.stringify(parent.metadata):null
                }
            }
        }
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
    private createContext(ctx: any): {authorized: boolean}{
        let req=ctx?.request??ctx?.req??ctx
        let auth=""
        if (typeof req?.headers?.get==="function"){
            auth=req.headers.get("authorization")??""
        }
        else{
            auth=req?.headers?.authorization??""
        }
        return {authorized: !this.token||auth==="Bearer "+this.token}
    }
    async start(): Promise<void>{
        let yogaModule: any
        try{
            yogaModule=await import("graphql-yoga")
        }
        catch{
            try{
                yogaModule=await import("apollo-server")
            }
            catch{
                throw new Error("graphql-yoga not installed")
            }
        }
        if (yogaModule.createYoga){
            this.yoga=yogaModule.createYoga({
                typeDefs: this.typeDefs,
                resolvers: this.resolvers,
                context: (ctx: any)=>this.createContext(ctx)
            })
        }
        else if (yogaModule.ApolloServer){
            let apollo=new yogaModule.ApolloServer({
                typeDefs: this.typeDefs,
                resolvers: this.resolvers,
                context: (ctx: any)=>this.createContext(ctx)
            })
            await apollo.start()
            this.yoga=apollo.getMiddleware()
        }
        else{
            throw new Error("graphql-yoga not installed")
        }
        return new Promise((resolve, reject)=>{
            this.server=http.createServer(this.yoga)
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
                    this.yoga=undefined
                    resolve()
                }
            })
        })
    }
}
