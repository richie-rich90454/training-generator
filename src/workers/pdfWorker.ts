import{parentPort}from "worker_threads"
import pdfParse from "pdf-parse"
import type{WorkerMessage,WorkerResult}from "../types/index.ts"

let port=parentPort as import("worker_threads").MessagePort

function extractTextFromPDF(buffer:Buffer):string{
    let text=buffer.toString("utf-8",0,Math.min(buffer.length,10000))
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g," ").replace(/\s+/g," ").trim()
}

port.on("message",async(message:WorkerMessage)=>{
    try{
        let{id,buffer}=message
        if(!buffer||!Buffer.isBuffer(buffer)){
            throw new Error("Invalid buffer provided")
        }
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
            let{id,buffer}=message
            let text=extractTextFromPDF(buffer)
            port.postMessage({
                id,
                success:true,
                text,
                warning:"Used fallback extraction"
            }as WorkerResult)
        }
        catch(fallbackError){
            port.postMessage({
                id:message.id,
                success:false,
                error:`PDF parsing failed: ${(error as Error).message}. Fallback also failed: ${(fallbackError as Error).message}`
            }as WorkerResult)
        }
    }
})

process.on("uncaughtException",(error:Error)=>{
    console.error("PDF Worker Uncaught Exception:",error)
})

process.on("unhandledRejection",(reason:unknown,promise:Promise<unknown>)=>{
    console.error("PDF Worker Unhandled Rejection at:",promise,"reason:",reason)
})
