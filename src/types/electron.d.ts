import type{FileObj,ReadFileResult,SaveFileResult,ParseFileResult,ParseBatchResult,OllamaStatus,OllamaGenerateResult}from"./index.js"

export interface ElectronAPI{
    openFileDialog:()=>Promise<FileObj[]>
    readFile:(filePath:string)=>Promise<ReadFileResult>
    parseFile:(filePath:string,fileType:string)=>Promise<ParseFileResult>
    parseFilesBatch:(files:Array<{path:string}>)=>Promise<ParseBatchResult>
    saveFile:(filePath:string,content:string)=>Promise<SaveFileResult>
    saveFileDialog:(defaultFilename?:string)=>Promise<string|null>
    checkOllama:()=>Promise<OllamaStatus>
    generateWithOllama:(model:string,prompt:string,options?:Record<string,unknown>)=>Promise<OllamaGenerateResult>
    getAppVersion:()=>Promise<string>
    getPlatform:()=>Promise<string>
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
