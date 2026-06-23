﻿﻿﻿import{contextBridge,ipcRenderer}from "electron"
import type{OllamaStatus}from "./types/index.js"

contextBridge.exposeInMainWorld("electronAPI",{
    openFileDialog:()=>ipcRenderer.invoke("dialog:openFile"),
    readFile:(filePath:string)=>ipcRenderer.invoke("file:read",filePath),
    parseFile:(filePath:string,fileType:string)=>ipcRenderer.invoke("file:parse",filePath,fileType),
    parseFilesBatch:(files:Array<{path:string}>)=>ipcRenderer.invoke("file:parseBatch",files),
    saveFile:(filePath:string,content:string)=>ipcRenderer.invoke("file:save",filePath,content),
    saveFileDialog:(defaultFilename?:string)=>ipcRenderer.invoke("dialog:saveFile",defaultFilename),
    checkOllama:()=>ipcRenderer.invoke("ollama:check"),
    generateWithOllama:(model:string,prompt:string,options?:Record<string,unknown>)=>ipcRenderer.invoke("ollama:generate",{model,prompt,options}),
    generateWithOllamaStream:(model:string,prompt:string,options?:Record<string,unknown>)=>ipcRenderer.invoke("ollama:generateStream",{model,prompt,options}),
    generateWithOpenAI:(apiKey:string,baseUrl:string,model:string,prompt:string,options?:Record<string,unknown>)=>ipcRenderer.invoke("openai:generate",{apiKey,baseUrl,model,prompt,options}),
    getAppVersion:()=>ipcRenderer.invoke("app:getVersion"),
    getPlatform:()=>ipcRenderer.invoke("app:getPlatform"),
    loadCache:()=>ipcRenderer.invoke("cache:load"),
    saveCache:(data:Record<string,any>)=>ipcRenderer.invoke("cache:save",data),
    clearCache:()=>ipcRenderer.invoke("cache:clear"),
    saveProgress:(data:any)=>ipcRenderer.invoke("progress:save",data),
    loadProgress:()=>ipcRenderer.invoke("progress:load"),
    clearProgress:()=>ipcRenderer.invoke("progress:clear"),
    writeLog:(entry:unknown)=>ipcRenderer.invoke("write-log",entry),
    exportLogs:(data:string)=>ipcRenderer.invoke("export-logs",data),
    saveCheckpoint:(data:unknown)=>ipcRenderer.invoke("save-checkpoint",data),
    loadCheckpoint:()=>ipcRenderer.invoke("load-checkpoint"),
    clearCheckpoint:()=>ipcRenderer.invoke("clear-checkpoint"),
    onOllamaStatusUpdate:(callback:(status:OllamaStatus)=>void)=>()=>{
        ipcRenderer.on("ollama:status-update",(_event:any,status:OllamaStatus)=>callback(status))
        return()=>{
            ipcRenderer.removeListener("ollama:status-update",(_event:any,status:OllamaStatus)=>callback(status))
        }
    }
})

contextBridge.exposeInMainWorld("appConsole",{
    log:(...args:unknown[])=>console.log("[App]",...args),
    error:(...args:unknown[])=>console.error("[App Error]",...args),
    warn:(...args:unknown[])=>console.warn("[App Warning]",...args),
    info:(...args:unknown[])=>console.info("[App Info]",...args)
})
