import{parentPort}from "worker_threads"
import pdfParse from "pdf-parse"
import type{WorkerMessage,WorkerResult}from "../types/index.ts"
if(!parentPort){
    console.error("PDF worker: parentPort is null")
    process.exit(1)
}
let port=parentPort as import("worker_threads").MessagePort
let currentId:number=0
function extractTextFromPDF(buffer:Buffer):string{
    let text=buffer.toString("utf-8",0,Math.min(buffer.length,10000))
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g," ").replace(/\s+/g," ").trim()
}
port.on("message",async(message:WorkerMessage)=>{
    if(!message||typeof message.id!=="number"||!message.id){
        port.postMessage({id:message&&typeof message.id==="number"?message.id:0,success:false,error:"Invalid message: missing id"} as WorkerResult)
        return
    }
    let{id,buffer}=message
    currentId=id
    if(!buffer||!Buffer.isBuffer(buffer)){
        port.postMessage({id,success:false,error:"Invalid buffer provided"} as WorkerResult)
        return
    }
    try{
        let data=await pdfParse(buffer)
        let result:WorkerResult={
            id,
            success:true,
            text:data.text||extractTextFromPDF(buffer)
        }
        port.postMessage(result)
    }
    catch(error){
        console.error("PDF Worker Error:",error)
        try{
            let text=extractTextFromPDF(buffer)
            port.postMessage({
                id,
                success:true,
                text,
                warning:"Used fallback extraction"
            } as WorkerResult)
        }
        catch(fallbackError){
            port.postMessage({
                id,
                success:false,
                error:`PDF parsing failed: ${(error as Error).message}. Fallback also failed: ${(fallbackError as Error).message}`
            } as WorkerResult)
        }
    }
    finally{
        currentId=0
    }
})
process.on("uncaughtException",(error:Error)=>{
    console.error("PDF Worker Uncaught Exception:",error)
    port.postMessage({id:currentId||0,success:false,error:`Uncaught exception: ${error.message}`} as WorkerResult)
    process.exit(1)
})
process.on("unhandledRejection",(reason:unknown,promise:Promise<unknown>)=>{
    console.error("PDF Worker Unhandled Rejection at:",promise,"reason:",reason)
})
