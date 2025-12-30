let mammoth=require("mammoth");
let pdfParse=require("pdf-parse");
let officeParser=require("officeparser");
let {RtfParser}=require("rtf-parser-fixes");
let {htmlToText}=require("html-to-text");
class FileParser{
    constructor(){
        this.supportedFormats=["pdf","docx","doc","rtf","txt","md","html"];
    }
    async parseFile(filePath,fileType){
        try{
            let fs=require("fs");
            let path=require("path");
            let stats=await fs.promises.stat(filePath);
            let fileSize=stats.size;
            if(fileSize>10*1024*1024){
                console.log(`Large file detected(${(fileSize/(1024*1024)).toFixed(2)}MB),using streaming...`);
                return await this.parseLargeFile(filePath,fileType);
            }
            let buffer=await fs.promises.readFile(filePath);
            switch(fileType.toLowerCase()){
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
                    return await this.parseText(buffer);
                case "html":
                    return await this.parseHTML(buffer);
                default:
                    throw new Error(`Unsupported file format:${fileType}`);
            }
        }
        catch(error){
            console.error(`Error parsing file ${filePath}:`,error);
            throw error;
        }
    }
    async parseLargeFile(filePath,fileType){
        let fs=require("fs");
        let path=require("path");
        switch(fileType.toLowerCase()){
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
                return await this.parseFileBuffer(buffer,fileType);
            default:
                throw new Error(`Unsupported file format for large files:${fileType}`);
        }
    }
    async streamTextFile(filePath){
        return new Promise((resolve,reject)=>{
            let fs=require("fs");
            let readStream=fs.createReadStream(filePath,{encoding:"utf8"});
            let content="";
            readStream.on("data",(chunk)=>{
                content+=chunk;
            });
            readStream.on("end",()=>{
                resolve(content);
            });
            readStream.on("error",(error)=>{
                reject(error);
            });
        });
    }
    async streamPDF(filePath){
        let fs=require("fs").promises;
        let buffer=await fs.readFile(filePath);
        return await this.parsePDF(buffer);
    }
    async parseFileBuffer(buffer,fileType){
        switch(fileType.toLowerCase()){
            case "pdf":
                return await this.parsePDF(buffer);
            case "docx":
                return await this.parseDOCX(buffer);
            case "doc":
                return await this.parseDOC(buffer);
            case "rtf":
                return await this.parseRTF(buffer);
            case "html":
                return await this.parseHTML(buffer);
            default:
                throw new Error(`Unsupported file format:${fileType}`);
        }
    }
    async parsePDF(buffer){
        try{
            let data=await pdfParse(buffer);
            return data.text;
        }
        catch(error){
            console.error("PDF parsing error:",error);
            return this.extractTextFromPDF(buffer);
        }
    }
    async parseDOCX(buffer){
        try{
            let result=await mammoth.extractRawText({buffer});
            return result.value;
        }
        catch(error){
            console.error("DOCX parsing error:",error);
            throw error;
        }
    }
    async parseDOC(buffer){
        try{
            let text=await officeParser.parseOfficeAsync(buffer);
            return text;
        }
        catch(error){
            console.error("DOC parsing error:",error);
            return this.extractTextFromBuffer(buffer);
        }
    }
    async parseRTF(buffer){
        try{
            let rtfText=buffer.toString("utf-8");
            return await this.parseRTFText(rtfText);
        }
        catch(error){
            console.error("RTF parsing error:",error);
            return this.extractPlainTextFromRTF(buffer.toString("utf-8"));
        }
    }
    async parseRTFText(rtfText){
        return new Promise((resolve,reject)=>{
            let parser=new RtfParser();
            let result="";
            parser.on("text",(text)=>{
                result+=text;
            });
            parser.on("error",(error)=>{
                reject(error);
            });
            parser.on("end",()=>{
                resolve(result);
            });
            parser.write(rtfText);
            parser.end();
        });
    }
    async parseText(buffer){
        return buffer.toString("utf-8");
    }
    async parseHTML(buffer){
        let html=buffer.toString("utf-8");
        return htmlToText(html,{
            wordwrap:false,
            selectors:[
                {selector:"a",options:{ignoreHref:true}},
                {selector:"img",format:"skip"}
            ]
        });
    }
    extractTextFromPDF(buffer){
        let text=buffer.toString("utf-8",0,Math.min(buffer.length,10000));
        return text.replace(/[^\x20-\x7E\n\r\t]/g," ").replace(/\s+/g," ").trim();
    }
    extractTextFromBuffer(buffer){
        let text=buffer.toString("utf-8",0,Math.min(buffer.length,10000));
        return text.replace(/[^\x20-\x7E\n\r\t]/g," ").replace(/\s+/g," ").trim();
    }
    extractPlainTextFromRTF(rtfText){
        let text=rtfText;
        text=text.replace(/\\[^{}]+|{[^{}]*}/g," ");
        text=text.replace(/\s+/g," ").trim();
        return text;
    }
    async extractTextFromFile(filePath){
        let path=require("path");
        let ext=path.extname(filePath).toLowerCase().replace(".","");
        if(!this.supportedFormats.includes(ext)){
            throw new Error(`Unsupported file format:${ext}`);
        }
        return await this.parseFile(filePath,ext);
    }
    async processFiles(filePaths){
        let results=[];
        for(let filePath of filePaths){
            try{
                let text=await this.extractTextFromFile(filePath);
                results.push({
                    filePath,
                    success:true,
                    text,
                    error:null
                });
            }
            catch(error){
                results.push({
                    filePath,
                    success:false,
                    text:"",
                    error:error.message
                });
            }
        }
        return results;
    }
}
module.exports=FileParser;