import mammoth from "mammoth"
import pdfParse from "pdf-parse"
import officeParser from "officeparser"
import{RtfParser}from "rtf-parser-fixes"
import{htmlToText}from "html-to-text"
import fs from "fs"
import path from "path"
import type{ParseBatchItem}from "../types/index.ts"
class FileParser{
    supportedFormats:string[]
    constructor(){
        this.supportedFormats=["pdf","docx","doc","rtf","txt","md","html"]
    }
    async parseFile(filePath:string,fileType:string):Promise<string>{
        try{
            let stats=await fs.promises.stat(filePath)
            let fileSize=stats.size
            if(fileSize>10*1024*1024){
                console.log(`Large file detected(${(fileSize/(1024*1024)).toFixed(2)}MB),using streaming...`)
                return await this.parseLargeFile(filePath,fileType)
            }
            let buffer=await fs.promises.readFile(filePath)
            switch(fileType.toLowerCase()){
                case "pdf":
                    return await this.parsePDF(buffer)
                case "docx":
                    return await this.parseDOCX(buffer)
                case "doc":
                    return await this.parseDOC(buffer)
                case "rtf":
                    return await this.parseRTF(buffer)
                case "txt":
                case "md":
                    return await this.parseText(buffer)
                case "html":
                    return await this.parseHTML(buffer)
                default:
                    throw new Error(`Unsupported file format:${fileType}`)
            }
        }
        catch(error){
            console.error(`Error parsing file ${filePath}:`,error)
            throw error
        }
    }
    async parseLargeFile(filePath:string,fileType:string):Promise<string>{
        switch(fileType.toLowerCase()){
            case "txt":
            case "md":
                return await this.streamTextFile(filePath)
            case "pdf":
                return await this.streamPDF(filePath)
            case "docx":
            case "doc":
            case "rtf":
            case "html":
                let buffer=await fs.promises.readFile(filePath)
                return await this.parseFileBuffer(buffer,fileType)
            default:
                throw new Error(`Unsupported file format for large files:${fileType}`)
        }
    }
    async streamTextFile(filePath:string):Promise<string>{
        return new Promise((resolve,reject)=>{
            let readStream=fs.createReadStream(filePath,{encoding:"utf8"})
            let content=""
            readStream.on("data",(chunk)=>{
                content+=chunk
            })
            readStream.on("end",()=>{
                resolve(content)
            })
            readStream.on("error",(error)=>{
                reject(error)
            })
        })
    }
    async streamPDF(filePath:string):Promise<string>{
        let buffer=await fs.promises.readFile(filePath)
        return await this.parsePDF(buffer)
    }
    async parseFileBuffer(buffer:Buffer,fileType:string):Promise<string>{
        switch(fileType.toLowerCase()){
            case "pdf":
                return await this.parsePDF(buffer)
            case "docx":
                return await this.parseDOCX(buffer)
            case "doc":
                return await this.parseDOC(buffer)
            case "rtf":
                return await this.parseRTF(buffer)
            case "html":
                return await this.parseHTML(buffer)
            default:
                throw new Error(`Unsupported file format:${fileType}`)
        }
    }
    async parsePDF(buffer:Buffer):Promise<string>{
        try{
            let data=await pdfParse(buffer)
            return data.text
        }
        catch(error){
            console.error("PDF parsing error:",error)
            return this.extractTextFromPDF(buffer)
        }
    }
    async parseDOCX(buffer:Buffer):Promise<string>{
        try{
            let result=await mammoth.extractRawText({buffer})
            return result.value
        }
        catch(error){
            console.error("DOCX parsing error:",error)
            throw error
        }
    }
    async parseDOC(buffer:Buffer):Promise<string>{
        try{
            let text=await officeParser.parseOfficeAsync(buffer)
            return text
        }
        catch(error){
            console.error("DOC parsing error:",error)
            return this.extractTextFromBuffer(buffer)
        }
    }
    async parseRTF(buffer:Buffer):Promise<string>{
        try{
            let rtfText=buffer.toString("utf-8")
            return await this.parseRTFText(rtfText)
        }
        catch(error){
            console.error("RTF parsing error:",error)
            return this.extractPlainTextFromRTF(buffer.toString("utf-8"))
        }
    }
    async parseRTFText(rtfText:string):Promise<string>{
        return new Promise((resolve,reject)=>{
            let parser=new RtfParser()
            let result=""
            parser.on("text",(text:string)=>{
                result+=text
            })
            parser.on("error",(error:Error)=>{
                reject(error)
            })
            parser.on("end",()=>{
                resolve(result)
            })
            parser.write(rtfText)
            parser.end()
        })
    }
    async parseText(buffer:Buffer):Promise<string>{
        return buffer.toString("utf-8")
    }
    async parseHTML(buffer:Buffer):Promise<string>{
        let html=buffer.toString("utf-8")
        return htmlToText(html,{
            wordwrap:false,
            selectors:[
                {selector:"a",options:{ignoreHref:true}},
                {selector:"img",format:"skip"}
            ]
        })
    }
    extractTextFromPDF(buffer:Buffer):string{
        let text=buffer.toString("utf-8",0,Math.min(buffer.length,10000))
        return text.replace(/[^\x20-\x7E\n\r\t]/g," ").replace(/\s+/g," ").trim()
    }
    extractTextFromBuffer(buffer:Buffer):string{
        let text=buffer.toString("utf-8",0,Math.min(buffer.length,10000))
        return text.replace(/[^\x20-\x7E\n\r\t]/g," ").replace(/\s+/g," ").trim()
    }
    extractPlainTextFromRTF(rtfText:string):string{
        let text=rtfText
        text=text.replace(/\\[^{}]+|{[^{}]*}/g," ")
        text=text.replace(/\s+/g," ").trim()
        return text
    }
    async extractTextFromFile(filePath:string):Promise<string>{
        let ext=path.extname(filePath).toLowerCase().replace(".","")
        if(!this.supportedFormats.includes(ext)){
            throw new Error(`Unsupported file format:${ext}`)
        }
        return await this.parseFile(filePath,ext)
    }
    async processFiles(filePaths:string[]):Promise<ParseBatchItem[]>{
        let results:ParseBatchItem[]=[]
        for(let filePath of filePaths){
            try{
                let text=await this.extractTextFromFile(filePath)
                results.push({
                    filePath,
                    success:true,
                    text,
                    error:null
                })
            }
            catch(error){
                results.push({
                    filePath,
                    success:false,
                    text:"",
                    error:(error as Error).message
                })
            }
        }
        return results
    }
}
export default FileParser
