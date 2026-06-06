import{contextBridge,ipcRenderer}from "electron"

contextBridge.exposeInMainWorld("electronAPI",{
    openFileDialog:()=>ipcRenderer.invoke("dialog:openFile"),
    readFile:(filePath:string)=>ipcRenderer.invoke("file:read",filePath),
    parseFile:(filePath:string,fileType:string)=>ipcRenderer.invoke("file:parse",filePath,fileType),
    parseFilesBatch:(files:Array<{path:string}>)=>ipcRenderer.invoke("file:parseBatch",files),
    saveFile:(filePath:string,content:string)=>ipcRenderer.invoke("file:save",filePath,content),
    saveFileDialog:(defaultFilename?:string)=>ipcRenderer.invoke("dialog:saveFile",defaultFilename),
    checkOllama:()=>ipcRenderer.invoke("ollama:check"),
    generateWithOllama:(model:string,prompt:string,options?:Record<string,unknown>)=>ipcRenderer.invoke("ollama:generate",{model,prompt,options}),
    getAppVersion:()=>ipcRenderer.invoke("app:getVersion"),
    getPlatform:()=>ipcRenderer.invoke("app:getPlatform"),
    onOllamaStatusUpdate:(callback:()=>void):()=>void=>{
        return()=>{}
    }
})

contextBridge.exposeInMainWorld("appConsole",{
    log:(...args:unknown[])=>console.log("[App]",...args),
    error:(...args:unknown[])=>console.error("[App Error]",...args),
    warn:(...args:unknown[])=>console.warn("[App Warning]",...args),
    info:(...args:unknown[])=>console.info("[App Info]",...args)
})
