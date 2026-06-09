import fs from "fs"
import path from "path"
import{Worker}from "worker_threads"
import{fileURLToPath}from "url"
import type{ParseBatchItem}from "../types/index.js"

class FileParserLazy{
    supportedFormats:string[]
    dependencies:Record<string,unknown|null>&{
        mammoth:unknown|null
        pdfParse:unknown|null
        officeParser:unknown|null
        RtfParser:unknown|null
        htmlToText:unknown|null
    }
    constructor(){
        this.supportedFormats=["pdf", "docx", "doc", "rtf", "txt", "md", "html"];
        this.dependencies={
            mammoth: null,
            pdfParse: null,
            officeParser: null,
            RtfParser: null,
            htmlToText: null
        };
    }
    async loadDependency(name:string):Promise<unknown>{
        if (this.dependencies[name]!==null){
            return this.dependencies[name];
        }
        switch (name){
            case "mammoth":
                this.dependencies.mammoth=(await import("mammoth")).default
                break
            case "pdfParse":
                this.dependencies.pdfParse=(await import("pdf-parse")).default
                break
            case "officeParser":
                this.dependencies.officeParser=(await import("officeparser")).default
                break
            case "RtfParser":
                this.dependencies.RtfParser=(await import("rtf-parser-fixes")).RtfParser
                break
            case "htmlToText":
                this.dependencies.htmlToText=(await import("html-to-text")).htmlToText
                break
        }
        return this.dependencies[name];
    }
    async parseFile(filePath:string,fileType:string):Promise<string>{
        try{
            let stats=await fs.promises.stat(filePath);
            let fileSize=stats.size;
            if (fileSize>10*1024*1024){
                console.log(`Large file detected (${(fileSize/(1024*1024)).toFixed(2)}MB), using streaming...`);
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
                throw new Error(`Unsupported file format for large files: ${fileType}`);
        }
    }
    async streamTextFile(filePath:string):Promise<string>{
        return new Promise((resolve, reject)=>{
            let readStream=fs.createReadStream(filePath,{ encoding: "utf8", highWaterMark: 64*1024 })
            let content=""
            let maxSize=50*1024*1024
            readStream.on("data", (chunk)=>{
                content+=chunk
                if(content.length>maxSize){
                    readStream.destroy()
                    reject(new Error("Text file too large to process"))
                }
            });
            readStream.on("end", ()=>{
                resolve(content);
            });
            readStream.on("error", (error)=>{
                reject(error);
            });
        });
    }
    async streamPDF(filePath:string):Promise<string>{
        let buffer=await fs.promises.readFile(filePath);
        return await this.parsePDF(buffer);
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
                return buffer.toString("utf-8");
            case "html":
                return await this.parseHTML(buffer);
            default:
                throw new Error(`Unsupported file format: ${fileType}`);
        }
    }
    async parsePDF(buffer:Buffer):Promise<string>{
        if (buffer.length>5*1024*1024){
            try{
                return await this.parsePDFWithWorker(buffer);
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
            return this.extractTextFromPDF(buffer);
        }
    }
    async parsePDFWithWorker(buffer:Buffer):Promise<string>{
        return new Promise((resolve, reject)=>{
            let workerPath=path.join(path.dirname(fileURLToPath(import.meta.url)),"../workers/pdfWorker.ts")
            let worker=new Worker(workerPath);
            let id=Date.now()+Math.random();
            let timeout=setTimeout(()=>{
                worker.terminate();
                reject(new Error("PDF parsing timeout (30 seconds)"));
            }, 30000);
            worker.on("message", (result)=>{
                if (result.id==id){
                    clearTimeout(timeout);
                    worker.terminate();
                    
                    if (result.success){
                        resolve(result.text);
                    }
                    else{
                        reject(new Error(result.error));
                    }
                }
            });
            worker.on("error", (error)=>{
                clearTimeout(timeout);
                worker.terminate();
                reject(error);
            });
            worker.on("exit", (code)=>{
                if (code!==0){
                    clearTimeout(timeout);
                    reject(new Error(`Worker stopped with exit code ${code}`));
                }
            });
            worker.postMessage({ id, buffer });
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
            return this.extractTextFromBuffer(buffer);
        }
    }
    async parseRTF(buffer:Buffer):Promise<string>{
        try{
            let rtfText=buffer.toString("utf-8");
            return await this.parseRTFText(rtfText);
        }
        catch (error){
            console.error("RTF parsing error:", error);
            return this.extractPlainTextFromRTF(buffer.toString("utf-8"));
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
        let html=buffer.toString("utf-8");
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
        return text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
    }
    extractTextFromBuffer(buffer:Buffer):string{
        let text=buffer.toString("utf-8", 0, Math.min(buffer.length, 10000));
        return text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
    }
    extractPlainTextFromRTF(rtfText:string):string{
        let text=rtfText;
        text=text.replace(/\\[^{}]+|{[^{}]*}/g, " ");
        text=text.replace(/\s+/g, " ").trim();
        return text;
    }
    async extractTextFromFile(filePath:string):Promise<string>{
        let ext=path.extname(filePath).toLowerCase().replace(".", "");
        if (!this.supportedFormats.includes(ext)){
            throw new Error(`Unsupported file format: ${ext}`);
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
                results.push({
                    filePath,
                    success: false,
                    text: "",
                    error: "Failed to extract text from file"
                });
            }
        }
        
        return results;
    }
    dispose():void{
        this.dependencies={
            mammoth: null,
            pdfParse: null,
            officeParser: null,
            RtfParser: null,
            htmlToText: null
        };
    }
}
export default FileParserLazy;
