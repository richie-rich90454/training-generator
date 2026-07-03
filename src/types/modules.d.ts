/// <reference types="vite/client" />
declare module "pdf-parse"{
    let pdfParse:(buffer:Buffer)=>Promise<{text:string;numpages:number;info:Record<string,unknown>;metadata:Record<string,unknown>;version:string}>;
    export default pdfParse;
}
declare module "rtf-parser-fixes"{
    import{EventEmitter}from "events"
    class RtfParser extends EventEmitter{
        write(data:string):void
        end():void
        on(event:"text",listener:(text:string)=>void):this
        on(event:"error",listener:(error:Error)=>void):this
        on(event:"end",listener:()=>void):this
        on(event:string|symbol,listener:(...args:any[])=>void):this
    }
    export{RtfParser}
}
declare module "html-to-text"{
    export interface HtmlToTextOptions{
        [key:string]:unknown
    }
    export function htmlToText(html:string,options?:HtmlToTextOptions):string
}
declare module "officeparser"{
    export function parseOfficeAsync(buffer:Buffer):Promise<string>
}
declare module "*.css"{
    let content:string;
    export default content;
}
