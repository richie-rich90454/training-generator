import fs from "fs"
import path from "path"
import crypto from "crypto"
import{Worker}from "worker_threads"
import{fileURLToPath}from "url"
import{t}from "../renderer/i18n.ts"
import type{ParseBatchItem}from "../types/index.ts"

class FileParserLazy{
    supportedFormats:string[]
    dependencies:Record<string,unknown|null>&{
        mammoth:unknown|null
        pdfParse:unknown|null
        officeParser:unknown|null
        RtfParser:unknown|null
        htmlToText:unknown|null
    }
    private loading:Record<string,Promise<unknown>|undefined>
    private isDisposed:boolean
    constructor(){
        this.supportedFormats=["pdf", "docx", "doc", "rtf", "txt", "md", "html", "htm"];
        this.dependencies={
            mammoth: null,
            pdfParse: null,
            officeParser: null,
            RtfParser: null,
            htmlToText: null
        };
        this.loading={};
        this.isDisposed=false;
    }
    async loadDependency(name:string):Promise<unknown>{
        if (this.dependencies[name]!==null){
            return this.dependencies[name];
        }
        if (this.loading[name]){
            return this.loading[name];
        }
        this.loading[name]=this.importDependency(name)
        try{
            let result=await this.loading[name]
            if (!this.isDisposed){
                this.dependencies[name]=result
            }
            return result
        }
        finally{
            delete this.loading[name]
        }
    }
    private async importDependency(name:string):Promise<unknown>{
        switch (name){
            case "mammoth":
                return (await import("mammoth")).default
            case "pdfParse":
                return (await import("pdf-parse")).default
            case "officeParser":
                return (await import("officeparser")).default
            case "RtfParser":
                return (await import("rtf-parser-fixes")).RtfParser
            case "htmlToText":
                return (await import("html-to-text")).htmlToText
            default:
                throw new Error(t("error.unknownDependency", undefined, { name }))
        }
    }
    async parseFile(filePath:string,fileType:string):Promise<string>{
        try{
            let stats=await fs.promises.stat(filePath);
            let fileSize=stats.size;
            if (fileSize>10*1024*1024){
                console.log(`Large file detected (${(fileSize/(1024*1024)).toFixed(2)}MB), parsing in memory...`);
                return await this.parseLargeFile(filePath, fileType);
            }
            let buffer=await fs.promises.readFile(filePath);
            return await this.parseFileBuffer(buffer, fileType);
        }
        catch (error){
            console.error(`Error parsing file ${filePath}:`, error);
            throw error;
        }
    }
    async parseLargeFile(filePath:string,fileType:string):Promise<string>{
        switch (fileType.toLowerCase()){
            case "txt":
            case "md":
                return await this.streamTextFile(filePath);
            case "pdf":
                return await this.streamPDF(filePath);
            case "docx":
            case "doc":
            case "rtf":
            case "html":
                let buffer=await fs.promises.readFile(filePath);
                return await this.parseFileBuffer(buffer, fileType);
            default:
                throw new Error(t("error.unsupportedLargeFileFormat", undefined, { format: fileType }));
        }
    }
    async streamTextFile(filePath:string):Promise<string>{
        return new Promise((resolve, reject)=>{
            let readStream=fs.createReadStream(filePath,{ encoding: "utf8", highWaterMark: 64*1024 })
            let content=""
            let maxSize=50*1024*1024
            let settled=false
            function settle(fn:()=>void):void{
                if (settled)return
                settled=true
                fn()
            }
            readStream.on("data", (chunk)=>{
                content+=chunk as string
                if(content.length>maxSize){
                    readStream.destroy()
                    settle(()=>reject(new Error(t("error.textFileTooLarge"))))
                }
            });
            readStream.on("end", ()=>{
                settle(()=>resolve(content));
            });
            readStream.on("error", (error)=>{
                settle(()=>reject(error));
            });
        });
    }
    async streamPDF(filePath:string):Promise<string>{
        let buffer=await fs.promises.readFile(filePath);
        return await this.parsePDF(buffer);
    }
    private stripBom(text:string):string{
        if (text.charCodeAt(0)===0xFEFF){
            return text.slice(1);
        }
        return text;
    }
    async parseFileBuffer(buffer:Buffer,fileType:string):Promise<string>{
        switch (fileType.toLowerCase()){
            case "pdf":
                return await this.parsePDF(buffer);
            case "docx":
                return await this.parseDOCX(buffer);
            case "doc":
                return await this.parseDOC(buffer);
            case "rtf":
                return await this.parseRTF(buffer);
            case "txt":
            case "md":
                return this.stripBom(buffer.toString("utf-8"));
            case "html":
                return await this.parseHTML(buffer);
            default:
                throw new Error(t("error.unsupportedFileFormat", undefined, { format: fileType }));
        }
    }
    async parsePDF(buffer:Buffer):Promise<string>{
        if (buffer.length>1*1024*1024){
            try{
                return await this.parsePDFWithWorker(buffer, true);
            }
            catch (workerError){
                console.warn("PDF Worker failed, falling back to main thread:", workerError);
            }
        }
        try{
            let pdfParse=await this.loadDependency("pdfParse") as any;
            let data=await pdfParse(buffer);
            return data.text;
        }
        catch (error){
            console.error("PDF parsing error:", error);
            throw error;
        }
    }
    async parsePDFWithWorker(buffer:Buffer,transfer?:boolean):Promise<string>{
        return new Promise((resolve, reject)=>{
            let workerPath=path.join(path.dirname(fileURLToPath(import.meta.url)),"../workers/pdfWorker.js")
            let worker=new Worker(workerPath,{ type: "module" } as any);
            let id=crypto.randomUUID();
            let settled=false
            function cleanup():void{
                if (settled)return
                settled=true
                clearTimeout(timeout);
                worker.terminate();
            }
            let timeout=setTimeout(()=>{
                cleanup();
                reject(new Error(t("error.pdfParsingTimeout")));
        }, 30000);
            worker.on("message", (result)=>{
                if (result.id===id){
                    cleanup();
                    if (result.success){
                        resolve(result.text);
                    }
                    else{
                        reject(new Error(result.error));
                    }
                }
            });
            worker.on("error", (error)=>{
                cleanup();
                reject(error);
            });
            worker.on("exit", (code)=>{
                cleanup();
                reject(new Error(t("error.workerStopped", undefined, { code: String(code) })));
            });
            let messageBuffer=transfer
                ?Buffer.from(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength))
                :buffer
            let transferList=transfer&&messageBuffer.buffer?[messageBuffer.buffer]:[]
            worker.postMessage({ id, buffer: messageBuffer }, transferList as import("worker_threads").TransferListItem[]);
        });
    }
    async parseDOCX(buffer:Buffer):Promise<string>{
        try{
            let mammoth=await this.loadDependency("mammoth") as any;
            let result=await mammoth.extractRawText({ buffer });
            return result.value;
        }
        catch (error){
            console.error("DOCX parsing error:", error);
            throw error;
        }
    }
    async parseDOC(buffer:Buffer):Promise<string>{
        try{
            let officeParser=await this.loadDependency("officeParser") as any;
            let text=await officeParser.parseOfficeAsync(buffer);
            return text;
        }
        catch (error){
            console.error("DOC parsing error:", error);
            throw error;
        }
    }
    async parseRTF(buffer:Buffer):Promise<string>{
        try{
            let rtfText=this.stripBom(buffer.toString("utf-8"));
            return await this.parseRTFText(rtfText);
        }
        catch (error){
            console.error("RTF parsing error:", error);
            throw error;
        }
    }
    async parseRTFText(rtfText:string):Promise<string>{
        let {RtfParser}=await this.loadDependency("RtfParser") as any;
        return new Promise((resolve, reject)=>{
            let parser=new RtfParser();
            let result="";
            parser.on("text", (text:string)=>{
                result+=text;
            });
            parser.on("error", (error:Error)=>{
                reject(error);
            });
            parser.on("end", ()=>{
                resolve(result);
            });
            parser.write(rtfText);
            parser.end();
        });
    }
    async parseHTML(buffer:Buffer):Promise<string>{
        let htmlToText=await this.loadDependency("htmlToText") as any;
        let html=this.stripBom(buffer.toString("utf-8"));
        return htmlToText(html,{
            wordwrap: false,
            selectors: [
               {selector: "a", options:{ignoreHref: true}},
               {selector: "img", format: "skip"}
            ]
        });
    }
    extractTextFromPDF(buffer:Buffer):string{
        let text=buffer.toString("utf-8", 0, Math.min(buffer.length, 10000));
        return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ").replace(/\s+/g, " ").trim();
    }
    extractTextFromBuffer(buffer:Buffer):string{
        let text=buffer.toString("utf-8", 0, Math.min(buffer.length, 10000));
        return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ").replace(/\s+/g, " ").trim();
    }
    extractPlainTextFromRTF(rtfText:string):string{
        let text=rtfText;
        text=text.replace(/\\'([0-9a-fA-F]{2})/g, (_,hex)=>String.fromCharCode(parseInt(hex,16)));
        text=text.replace(/\\u(-?\d+)\s*./g, (_,code)=>String.fromCharCode(parseInt(code,10)));
        text=text.replace(/\\[^{}]+|{[^{}]*}/g, " ");
        text=text.replace(/\s+/g, " ").trim();
        return text;
    }
    async extractTextFromFile(filePath:string):Promise<string>{
        let ext=path.extname(filePath).toLowerCase().replace(".", "");
        if (ext==="htm"){
            ext="html";
        }
        if (!this.supportedFormats.includes(ext)){
            throw new Error(t("error.unsupportedFileFormat", undefined, { format: ext }));
        }

        return await this.parseFile(filePath, ext);
    }
    async processFiles(filePaths:string[]):Promise<ParseBatchItem[]>{
        let results:ParseBatchItem[]=[];
        for (let filePath of filePaths){
            try{
                let text=await this.extractTextFromFile(filePath);
                results.push({
                    filePath,
                    success: true,
                    text,
                    error: null
                });
            }
            catch (error){
                let err=error as Error
                results.push({
                    filePath,
                    success: false,
                    text: "",
                    error: err.stack||err.message||String(error)
                });
            }
        }

        return results;
    }
    dispose():void{
        this.isDisposed=true;
        this.dependencies={
            mammoth: null,
            pdfParse: null,
            officeParser: null,
            RtfParser: null,
            htmlToText: null
        };
        this.loading={};
    }
}
export default FileParserLazy;
