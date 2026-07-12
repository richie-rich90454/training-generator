import mammoth from "mammoth"
import{PDFParse}from "pdf-parse"
import officeParser from "officeparser"
import{string as rtfStringParser}from "rtf-parser-fixes"
import{htmlToText}from "html-to-text"
import fs from "fs"
import path from "path"
import{t}from "../renderer/i18n.ts"
import type{ParseBatchItem}from "../types/index.ts"
class FileParser{
    supportedFormats:string[]
    constructor(){
        this.supportedFormats=["pdf","docx","doc","rtf","txt","md","html","htm"]
    }
    async parseFile(filePath:string,fileType:string):Promise<string>{
        try{
            let stats=await fs.promises.stat(filePath)
            let fileSize=stats.size
            if(fileSize>10*1024*1024){
                console.log(`Large file detected(${(fileSize/(1024*1024)).toFixed(2)}MB),parsing in memory...`)
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
                    throw new Error(t("error.unsupportedFileFormat",undefined,{format:fileType}))
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
                throw new Error(t("error.unsupportedLargeFileFormat",undefined,{format:fileType}))
        }
    }
    async streamTextFile(filePath:string):Promise<string>{
        return new Promise((resolve,reject)=>{
            let readStream=fs.createReadStream(filePath,{encoding:"utf8",highWaterMark:64*1024})
            let content=""
            let maxSize=50*1024*1024
            let settled=false
            function settle(fn:()=>void):void{
                if(settled)return
                settled=true
                fn()
            }
            readStream.on("data",(chunk)=>{
                content+=chunk as string
                if(content.length>maxSize){
                    readStream.destroy()
                    settle(()=>reject(new Error(t("error.textFileTooLarge"))))
                }
            })
            readStream.on("end",()=>{
                settle(()=>resolve(this.stripBom(content)))
            })
            readStream.on("error",(error)=>{
                settle(()=>reject(error))
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
                throw new Error(t("error.unsupportedFileFormat",undefined,{format:fileType}))
        }
    }
    async parsePDF(buffer:Buffer):Promise<string>{
        try{
            let parser=new PDFParse({data:buffer})
            let data=await parser.getText()
            return data.text
        }
        catch(error){
            console.error("PDF parsing error:",error)
            throw error
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
            throw error
        }
    }
    async parseRTF(buffer:Buffer):Promise<string>{
        try{
            let rtfText=this.stripBom(buffer.toString("utf-8"))
            return await this.parseRTFText(rtfText)
        }
        catch(error){
            console.error("RTF parsing error:",error)
            throw error
        }
    }
    async parseRTFText(rtfText:string):Promise<string>{
        return new Promise((resolve,reject)=>{
            rtfStringParser(rtfText,(err:Error|null,doc:any)=>{
                if(err){
                    reject(err)
                    return
                }
                let text=doc.content.map((span:any)=>span.value).join("")
                resolve(text)
            })
        })
    }
    private stripBom(text:string):string{
        if(text.charCodeAt(0)===0xFEFF){
            return text.slice(1)
        }
        return text
    }
    async parseText(buffer:Buffer):Promise<string>{
        return this.stripBom(buffer.toString("utf-8"))
    }
    async parseHTML(buffer:Buffer):Promise<string>{
        let html=this.stripBom(buffer.toString("utf-8"))
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
        return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g," ").replace(/\s+/g," ").trim()
    }
    extractTextFromBuffer(buffer:Buffer):string{
        let text=buffer.toString("utf-8",0,Math.min(buffer.length,10000))
        return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g," ").replace(/\s+/g," ").trim()
    }
    extractPlainTextFromRTF(rtfText:string):string{
        let text=rtfText
        text=text.replace(/\\'([0-9a-fA-F]{2})/g,(_,hex)=>String.fromCharCode(parseInt(hex,16)))
        text=text.replace(/\\u(-?\d+)\s*./g,(_,code)=>String.fromCharCode(parseInt(code,10)))
        text=text.replace(/\\[^{}]+|{[^{}]*}/g," ")
        text=text.replace(/\s+/g," ").trim()
        return text
    }
    async extractTextFromFile(filePath:string):Promise<string>{
        let ext=path.extname(filePath).toLowerCase().replace(".","")
        if(ext==="htm"){
            ext="html"
        }
        if(!this.supportedFormats.includes(ext)){
            throw new Error(t("error.unsupportedFileFormat",undefined,{format:ext}))
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
                let err=error as Error
                results.push({
                    filePath,
                    success:false,
                    text:"",
                    error:err.stack||err.message||String(error)
                })
            }
        }
        return results
    }
}
export default FileParser
