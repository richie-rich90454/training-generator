let {parentPort}=require("worker_threads");
let pdfParse=require("pdf-parse");
function extractTextFromPDF(buffer){
    let text=buffer.toString("utf-8", 0, Math.min(buffer.length, 10000));
    return text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
}
parentPort.on("message", async (message)=>{
    try{
        let {id, buffer}=message;
        if (!buffer||!Buffer.isBuffer(buffer)){
            throw new Error("Invalid buffer provided");
        }
        let data=await pdfParse(buffer);
        let result={
            id,
            success: true,
            text: data.text||extractTextFromPDF(buffer)
        };
        parentPort.postMessage(result);
    }
    catch (error){
        console.error("PDF Worker Error:", error);
        try{
            let {id, buffer}=message;
            let text=extractTextFromPDF(buffer);
            parentPort.postMessage({
                id,
                success: true,
                text,
                warning: "Used fallback extraction"
            });
        }
        catch (fallbackError){
            parentPort.postMessage({
                id: message.id,
                success: false,
                error: `PDF parsing failed: ${error.message}. Fallback also failed: ${fallbackError.message}`
            });
        }
    }
});
process.on("uncaughtException", (error)=>{
    console.error("PDF Worker Uncaught Exception:", error);
});
process.on("unhandledRejection", (reason, promise)=>{
    console.error("PDF Worker Unhandled Rejection at:", promise, "reason:", reason);
});