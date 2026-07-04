export interface OcrOptions{
    languages: string[]
    logger?: (msg: OcrProgress)=>void
    outputPath?: string
    minConfidence?: number
}
export interface OcrProgress{
    status: string
    progress: number
    jobId?: number
}
export interface OcrWord{
    text: string
    confidence: number
    bbox: {x0: number, y0: number, x1: number, y1: number}
}
export interface OcrResult{
    text: string
    confidence: number
    words: OcrWord[]
    language: string
    processingTimeMs: number
}
export const DEFAULT_OCR_OPTIONS: OcrOptions={
    languages: ["eng"],
    minConfidence: 60
};
export const SUPPORTED_IMAGE_TYPES: string[]=[".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp", ".gif"];
export function isImageFile(filename: string): boolean{
    let lower: string=filename.toLowerCase();
    let dotIndex: number=lower.lastIndexOf(".");
    let ext: string=dotIndex>=0?lower.substring(dotIndex):"";
    return SUPPORTED_IMAGE_TYPES.includes(ext);
}
export async function isImageOnlyPdf(buffer: Buffer): Promise<boolean>{
    if(buffer.length<5){
        return false;
    }
    let header: string=buffer.subarray(0, 5).toString("latin1");
    if(header!=="%PDF-"){
        return false;
    }
    let content: string=buffer.toString("latin1");
    let imageMatches: RegExpMatchArray|null=content.match(/\/Image\b/g);
    let textMatches: RegExpMatchArray|null=content.match(/\/Text\b/g);
    let imageCount: number=imageMatches?imageMatches.length:0;
    let textCount: number=textMatches?textMatches.length:0;
    return imageCount>0&&textCount===0;
}
export async function recognizeImage(buffer: Buffer, options?: OcrOptions): Promise<OcrResult>{
    let opts: OcrOptions={...DEFAULT_OCR_OPTIONS, ...(options||{})};
    let languages: string=opts.languages.join("+");
    let startTime: number=Date.now();
    let tesseract: any;
    try{
        tesseract=await import("tesseract.js");
    }
    catch{
        throw new Error("tesseract.js not installed. Run: npm install tesseract.js");
    }
    let createWorker: any=tesseract?.createWorker;
    if(typeof createWorker!=="function"){
        throw new Error("tesseract.js not installed. Run: npm install tesseract.js");
    }
    let worker: any=await createWorker(languages);
    try{
        if(typeof worker.setParameters==="function"){
            await worker.setParameters({logger: opts.logger});
        }
        let result: any=await worker.recognize(buffer);
        let data: any=result?.data||{};
        let rawWords: any[]=Array.isArray(data.words)?data.words:[];
        let words: OcrWord[]=[];
        let minConf: number=opts.minConfidence??0;
        for(let w of rawWords){
            let conf: number=typeof w.confidence==="number"?w.confidence:0;
            if(conf>=minConf){
                words.push({
                    text: w.text||"",
                    confidence: conf,
                    bbox: {
                        x0: w.bbox?.x0??0,
                        y0: w.bbox?.y0??0,
                        x1: w.bbox?.x1??0,
                        y1: w.bbox?.y1??0
                    }
                });
            }
        }
        let processingTimeMs: number=Date.now()-startTime;
        return{
            text: data.text||"",
            confidence: typeof data.confidence==="number"?data.confidence:0,
            words,
            language: languages,
            processingTimeMs
        };
    }
    finally{
        if(worker&&typeof worker.terminate==="function"){
            await worker.terminate();
        }
    }
}
export async function recognizePdf(buffer: Buffer, options?: OcrOptions): Promise<OcrResult>{
    let isImageOnly: boolean=await isImageOnlyPdf(buffer);
    if(!isImageOnly){
        throw new Error("PDF is not image-only; use pdf-parse instead");
    }
    return await recognizeImage(buffer, options);
}
export async function ocrAuto(buffer: Buffer, filename: string, options?: OcrOptions): Promise<OcrResult>{
    if(isImageFile(filename)){
        return await recognizeImage(buffer, options);
    }
    else if(filename.toLowerCase().endsWith(".pdf")){
        return await recognizePdf(buffer, options);
    }
    else{
        throw new Error("Unsupported file type for OCR: "+filename);
    }
}
