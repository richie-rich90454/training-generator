import axios from"axios";
export interface AudioFormat{
    extension: string
    mimeType: string
}
export interface TranscriptionOptions{
    whisperModel: string
    language?: string
    provider: "local"|"openai"
    openaiApiKey?: string
    openaiBaseUrl?: string
    timeoutMs?: number
    prompt?: string
    temperature?: number
}
export interface TranscriptSegment{
    startMs: number
    endMs: number
    text: string
}
export interface TranscriptionResult{
    text: string
    language: string
    durationSec?: number
    segments?: TranscriptSegment[]
    provider: string
    model: string
    processingTimeMs: number
}
export const SUPPORTED_AUDIO_TYPES: AudioFormat[]=[
    {extension: "mp3", mimeType: "audio/mpeg"},
    {extension: "m4a", mimeType: "audio/mp4"},
    {extension: "wav", mimeType: "audio/wav"},
    {extension: "flac", mimeType: "audio/flac"},
    {extension: "ogg", mimeType: "audio/ogg"},
    {extension: "webm", mimeType: "audio/webm"},
    {extension: "aac", mimeType: "audio/aac"}
];
export const DEFAULT_TRANSCRIPTION_OPTIONS: TranscriptionOptions={
    whisperModel: "base",
    provider: "local",
    timeoutMs: 600000,
    temperature: 0
};
function getExtension(filename: string): string{
    let idx=filename.lastIndexOf(".");
    if(idx===-1){
        return "";
    }
    return filename.slice(idx+1).toLowerCase();
}
function getMimeType(filename: string): string{
    let ext=getExtension(filename);
    for(let format of SUPPORTED_AUDIO_TYPES){
        if(format.extension===ext){
            return format.mimeType;
        }
    }
    return "application/octet-stream";
}
export function isAudioFile(filename: string): boolean{
    let ext=getExtension(filename);
    for(let format of SUPPORTED_AUDIO_TYPES){
        if(format.extension===ext){
            return true;
        }
    }
    return false;
}
export function formatTimestamp(ms: number): string{
    let totalMs=Math.max(0, Math.floor(ms));
    let hours=Math.floor(totalMs/3600000);
    let minutes=Math.floor((totalMs%3600000)/60000);
    let seconds=Math.floor((totalMs%60000)/1000);
    let milliseconds=totalMs%1000;
    let hh=String(hours).padStart(2, "0");
    let mm=String(minutes).padStart(2, "0");
    let ss=String(seconds).padStart(2, "0");
    let mmm=String(milliseconds).padStart(3, "0");
    return hh+":"+mm+":"+ss+"."+mmm;
}
export function formatTranscriptWithTimestamps(result: TranscriptionResult): string{
    if(!result.segments||result.segments.length===0){
        return result.text;
    }
    let lines: string[]=[];
    for(let segment of result.segments){
        let start=formatTimestamp(segment.startMs);
        let end=formatTimestamp(segment.endMs);
        lines.push("["+start+" -> "+end+"] "+segment.text);
    }
    return lines.join("\n");
}
export async function transcribeLocal(buffer: Buffer, filename: string, options: TranscriptionOptions): Promise<TranscriptionResult>{
    let whisper: any;
    try{
        let moduleName="node-whisper";
        let whisperModule: any=await import(moduleName);
        let Whisper=whisperModule.default||whisperModule;
        let whisperConfig: any={
            modelPath: options.whisperModel,
            whisperOptions: {}
        };
        if(options.language){
            whisperConfig.whisperOptions.language=options.language;
        }
        whisper=new Whisper(whisperConfig);
    }
    catch(err){
        throw new Error("Local Whisper not available. Install whisper.cpp or use provider: 'openai'");
    }
    let result=await whisper.transcribe();
    let text=typeof result==="string"?result:(result.content||result.text||"");
    let segments: TranscriptSegment[]|undefined=undefined;
    if(Array.isArray(result.segments)){
        segments=result.segments.map((s: any)=>{
            let startSec=s.start??s.t0??0;
            let endSec=s.end??s.t1??startSec;
            return{
                startMs: Math.round(startSec*1000),
                endMs: Math.round(endSec*1000),
                text: s.text??""
            };
        });
    }
    return{
        text: text,
        language: options.language??"unknown",
        segments: segments,
        provider: "local",
        model: options.whisperModel,
        processingTimeMs: 0
    };
}
export async function transcribeOpenAI(buffer: Buffer, filename: string, options: TranscriptionOptions): Promise<TranscriptionResult>{
    let apiKey=options.openaiApiKey;
    if(!apiKey){
        throw new Error("OpenAI API key is required for provider: 'openai'");
    }
    let baseUrl=options.openaiBaseUrl??"https://api.openai.com";
    let url=baseUrl+"/v1/audio/transcriptions";
    let mimeType=getMimeType(filename);
    let form=new FormData();
    let blob=new Blob([new Uint8Array(buffer)], {type: mimeType});
    form.append("file", blob, filename);
    form.append("model", "whisper-1");
    if(options.language){
        form.append("language", options.language);
    }
    if(options.prompt){
        form.append("prompt", options.prompt);
    }
    if(options.temperature!==undefined){
        form.append("temperature", String(options.temperature));
    }
    let headers: Record<string, string>={
        Authorization: "Bearer "+apiKey
    };
    let response: any;
    try{
        response=await axios.post(url, form, {
            headers: headers,
            timeout: options.timeoutMs,
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });
    }
    catch(error){
        const err=error as {response?:{status?:number}}
        if(err?.response){
            throw new Error("OpenAI transcription failed: HTTP "+err.response.status);
        }
        let message=error instanceof Error?error.message:String(error);
        throw new Error("OpenAI transcription network error: "+message);
    }
    let status=response.status;
    if(status<200||status>=300){
        throw new Error("OpenAI transcription failed: HTTP "+status);
    }
    let data=response.data;
    let segments: TranscriptSegment[]|undefined=undefined;
    if(Array.isArray(data.segments)){
        segments=data.segments.map((s: any)=>{
            let startSec=s.start??0;
            let endSec=s.end??startSec;
            return{
                startMs: Math.round(startSec*1000),
                endMs: Math.round(endSec*1000),
                text: s.text??""
            };
        });
    }
    return{
        text: data.text??"",
        language: data.language??options.language??"unknown",
        durationSec: data.duration,
        segments: segments,
        provider: "openai",
        model: "whisper-1",
        processingTimeMs: 0
    };
}
export async function transcribe(buffer: Buffer, filename: string, options?: Partial<TranscriptionOptions>): Promise<TranscriptionResult>{
    let opts: TranscriptionOptions={...DEFAULT_TRANSCRIPTION_OPTIONS, ...(options??{})};
    if(!isAudioFile(filename)){
        throw new Error("File is not a supported audio format: "+filename);
    }
    let start=Date.now();
    let result: TranscriptionResult;
    if(opts.provider==="local"){
        result=await transcribeLocal(buffer, filename, opts);
    }
    else if(opts.provider==="openai"){
        result=await transcribeOpenAI(buffer, filename, opts);
    }
    else{
        throw new Error("Unsupported transcription provider: "+String(opts.provider));
    }
    let elapsed=Date.now()-start;
    result.processingTimeMs=elapsed;
    return result;
}
