declare module "pdf-parse"{
    let pdfParse:(buffer:Buffer)=>Promise<{text:string;numpages:number;info:Record<string,unknown>;metadata:Record<string,unknown>;version:string}>;
    export default pdfParse;
}
declare module "rtf-parser-fixes"{
    import{EventEmitter}from "events"
    class RtfParser extends EventEmitter{
        write(data:string):void
        end():void
    }
    export{RtfParser}
}
declare module "html-to-text"{
    export function htmlToText(html:string,options?:Record<string,unknown>):string
}
declare module "officeparser"{
    export function parseOfficeAsync(buffer:Buffer):Promise<string>
}
declare module "node-fetch"{
    let fetch:(url:string,init?:RequestInit)=>Promise<Response>;
    export default fetch;
}
declare module "*.css"{
    let content:string;
    export default content;
}
