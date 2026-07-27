/// <reference types="vite/client" />
declare namespace Electron{
    interface App{
        getPath(name:"cache"):string
        setPath(name:"cache",path:string):void
    }
}
declare module "node:stream/web"{
    export interface UnderlyingDefaultSource<R=unknown>{
        start?(controller:ReadableStreamDefaultController<R>):void|Promise<void>
        pull?(controller:ReadableStreamDefaultController<R>):void|Promise<void>
        cancel?(reason?:unknown):void|Promise<void>
        type?:undefined
    }
}
declare module "pdf-parse"{
    export class PDFParse{
        constructor(options:{data:Buffer|Uint8Array;verbosity?:number;[key:string]:unknown})
        getText(options?:Record<string,unknown>):Promise<{text:string;pages:{text:string;num:number}[];total:number}>
    }
    let pdfParse:(buffer:Buffer)=>Promise<{text:string;numpages:number;info:Record<string,unknown>;metadata:Record<string,unknown>;version:string}>;
    export default pdfParse;
}
declare module "rtf-parser-fixes"{
    interface RTFDocument{
        content:{value:string}[]
    }
    export function string(rtfText:string, callback:(err:Error|null, doc:RTFDocument)=>void):void
}
declare module "html-to-text"{
    export interface HtmlToTextOptions{
        [key:string]:unknown
    }
    export function htmlToText(html:string,options?:HtmlToTextOptions):string
    export function convert(html:string,options?:HtmlToTextOptions):string
}
declare module "officeparser"{
    export function parseOfficeAsync(buffer:Buffer):Promise<string>
}
declare module "chokidar"{
    export function watch(paths:string|string[], options?:Record<string, unknown>):any;
    const _default:{watch: typeof watch};
    export default _default;
}
declare module "node-whisper"{
    const Whisper:any;
    export default Whisper;
}
declare module "parquetjs-lite"{
    export const parquet:any;
}
declare module "*.css"{
    let content:string;
    export default content;
}
declare module "express"{
    const express:any
    export default express
}
declare module "graphql-yoga"{
    export function createYoga(options: any): any
}
declare module "apollo-server"{
    export class ApolloServer{
        constructor(options: any)
        start(): Promise<void>
        getMiddleware(): any
    }
}
declare module "node-cron"{
    export interface Task{
        stop(): void
        start?(): void
        destroy?(): void
    }
    export function schedule(expression: string, handler: ()=>void|Promise<void>, options?: Record<string, unknown>): Task
    export function validate(expression: string): boolean
    const _default: {schedule: typeof schedule, validate: typeof validate}
    export default _default
}
declare module "mmap-io"{
    export const PROT_READ: number
    export const MAP_SHARED: number
    export function map(size: number, prot: number, flags: number, fd: number, offset?: number): Buffer
}
declare module "ws"{
    export class WebSocket{
        constructor(url: string)
        send(data: string|Buffer): void
        close(): void
        on(event: string, listener: (...args: any[])=>void): this
        once(event: string, listener: (...args: any[])=>void): this
        off(event: string, listener: (...args: any[])=>void): this
        readyState: number
    }
    export class WebSocketServer{
        constructor(options: {port?: number; [key: string]: any})
        on(event: "connection", listener: (socket: WebSocket)=>void): this
        on(event: "listening", listener: ()=>void): this
        on(event: "close", listener: ()=>void): this
        on(event: "error", listener: (err: Error)=>void): this
        close(callback?: ()=>void): void
        clients: Set<WebSocket>
    }
    export default WebSocket
}
declare module "@mongodb-js/zstd"{
    export function compress(data: Buffer, level?: number): Promise<Buffer>
    export function decompress(data: Buffer): Promise<Buffer>
}
declare module "http-proxy-agent"{
    export class HttpProxyAgent{
        constructor(url: string)
    }
}
declare module "https-proxy-agent"{
    export class HttpsProxyAgent{
        constructor(url: string)
    }
}
declare module "socks-proxy-agent"{
    export class SocksProxyAgent{
        constructor(url: string)
    }
}
declare module "otpauth"{
    export class Secret{
        static fromBase32(input: string): Secret
        readonly base32: string
    }
    export class TOTP{
        constructor(options: {secret?: Secret; algorithm?: string; digits?: number; period?: number; issuer?: string; label?: string})
        generate(options?: {timestamp?: number}): string
        validate(options: {token: string; window?: number; timestamp?: number}): number|null
        toString(): string
    }
}
declare module "adm-zip"{
    class AdmZip{
        constructor()
        addFile(entryName: string, data: Buffer, comment?: string): void
        writeZip(targetFileName: string, callback?: (err: Error|null)=>void): void
    }
    export default AdmZip
}
declare module "archiver"{
    function archiver(format: string, options?: Record<string, unknown>): {
        on(event: string, listener: (err: Error)=>void): any
        pipe(destination: NodeJS.WritableStream): void
        append(source: Buffer, options: {name: string}): void
        finalize(): void
    }
    export default archiver
}
