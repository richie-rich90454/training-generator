import type{FileObj,ReadFileResult,SaveFileResult,ParseFileResult,ParseBatchResult,OllamaStatus,OllamaGenerateResult,LogEntry}from"./index.js"

export interface ElectronAPI{
    openFileDialog:()=>Promise<FileObj[]>
    readFile:(filePath:string)=>Promise<ReadFileResult>
    parseFile:(filePath:string,fileType:string)=>Promise<ParseFileResult>
    parseFilesBatch:(files:Array<{path:string}>)=>Promise<ParseBatchResult>
    saveFile:(filePath:string,content:string)=>Promise<SaveFileResult>
    saveFileDialog:(defaultFilename?:string)=>Promise<string|null>
    checkOllama:()=>Promise<OllamaStatus>
    generateWithOllama:(model:string,prompt:string,options?:Record<string,unknown>)=>Promise<OllamaGenerateResult>
    generateWithOllamaStream:(model:string,prompt:string,options?:Record<string,unknown>)=>Promise<OllamaGenerateResult>
    generateWithOpenAI:(apiKey:string,baseUrl:string,model:string,prompt:string,options?:Record<string,unknown>)=>Promise<{success:boolean;response?:string;usage?:{total_tokens:number};error?:string}>
    getAppVersion:()=>Promise<string>
    getPlatform:()=>Promise<string>
    loadCache:()=>Promise<{success:boolean;data?:Record<string,any>}>
    saveCache:(data:Record<string,any>)=>Promise<{success:boolean}>
    clearCache:()=>Promise<{success:boolean}>
    saveProgress:(data:any)=>Promise<{success:boolean}>
    loadProgress:()=>Promise<{success:boolean;data?:any}>
    clearProgress:()=>Promise<{success:boolean}>
    saveCheckpoint:(data:any)=>Promise<{success:boolean}>
    loadCheckpoint:()=>Promise<{success:boolean;data?:any}>
    clearCheckpoint:()=>Promise<{success:boolean}>
    writeLog:(entry:LogEntry)=>Promise<void>
    exportLogs:(data:string)=>Promise<{success:boolean;error?:string}>
    onOllamaStatusUpdate:(callback:(status:OllamaStatus)=>void)=>()=>void
}

export interface AppConsole{
    log:(...args:unknown[])=>void
    error:(...args:unknown[])=>void
    warn:(...args:unknown[])=>void
    info:(...args:unknown[])=>void
}

declare global{
    interface Window{
        electronAPI:ElectronAPI
        appConsole:AppConsole
        app:unknown
    }
}