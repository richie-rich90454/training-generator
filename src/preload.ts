import{contextBridge}from "electron"
import{invoke}from "./ipcRenderer.js"
import type{FileObj}from "./types/index.js"
contextBridge.exposeInMainWorld("electronAPI",{
    openFileDialog:()=>invoke("dialog:openFile"),
    readFile:(filePath:string)=>invoke("file:read",{filePath}),
    parseFile:(filePath:string,fileType:string)=>invoke("file:parse",{filePath,fileType}),
    parseFilesBatch:(files:FileObj[])=>invoke("file:parseBatch",{files}),
    saveFile:(filePath:string,content:string)=>invoke("file:save",{filePath,content}),
    saveFileDialog:(defaultFilename?:string)=>invoke("dialog:saveFile",{defaultFilename}),
    checkOllama:()=>invoke("ollama:check"),
    generateWithOllama:(model:string,prompt:string,options?:Record<string,unknown>)=>invoke("ollama:generate",{model,prompt,options}),
    generateWithOllamaStream:(model:string,prompt:string,options?:Record<string,unknown>)=>invoke("ollama:generateStream",{model,prompt,options}),
    generateWithOpenAI:(apiKey:string,baseUrl:string,model:string,prompt:string,options?:Record<string,unknown>)=>invoke("openai:generate",{apiKey,baseUrl,model,prompt,options}),
    getAppVersion:()=>invoke("app:getVersion"),
    getPlatform:()=>invoke("app:getPlatform"),
    getSecureKey:()=>invoke("secureKey:getKey"),
    setSecureKey:(key:string)=>invoke("secureKey:setKey",{key}),
    openUserGuide:()=>invoke("docs:openUserGuide"),
    loadCache:()=>invoke("cache:load"),
    saveCache:(data:Record<string,any>)=>invoke("cache:save",{data}),
    clearCache:()=>invoke("cache:clear"),
    saveProgress:(data:any)=>invoke("progress:save",{data}),
    loadProgress:()=>invoke("progress:load"),
    clearProgress:()=>invoke("progress:clear"),
    writeLog:(entry:unknown)=>invoke("write-log",{entry:entry as import("./types/index.js").LogEntry}),
    exportLogs:(data:string)=>invoke("export-logs",{data}),
    saveCheckpoint:(data:unknown)=>invoke("save-checkpoint",{data}),
    loadCheckpoint:()=>invoke("load-checkpoint"),
    clearCheckpoint:()=>invoke("clear-checkpoint")
})
