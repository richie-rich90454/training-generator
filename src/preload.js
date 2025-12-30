let {contextBridge,ipcRenderer}=require("electron");
contextBridge.exposeInMainWorld("electronAPI",{
    openFileDialog:()=>ipcRenderer.invoke("dialog:openFile"),
    readFile:(filePath)=>ipcRenderer.invoke("file:read",filePath),
    parseFile:(filePath,fileType)=>ipcRenderer.invoke("file:parse",filePath,fileType),
    parseFilesBatch:(files)=>ipcRenderer.invoke("file:parseBatch",files),
    saveFile:(filePath,content)=>ipcRenderer.invoke("file:save",filePath,content),
    saveFileDialog:(defaultFilename)=>ipcRenderer.invoke("dialog:saveFile",defaultFilename),
    checkOllama:()=>ipcRenderer.invoke("ollama:check"),
    generateWithOllama:(model,prompt,options)=>ipcRenderer.invoke("ollama:generate",{model,prompt,options}),
    getAppVersion:()=>ipcRenderer.invoke("app:getVersion"),
    getPlatform:()=>ipcRenderer.invoke("app:getPlatform"),
    onOllamaStatusUpdate:(callback)=>{
        return()=>{};
    }
});
contextBridge.exposeInMainWorld("appConsole",{
    log:(...args)=>console.log("[App]",...args),
    error:(...args)=>console.error("[App Error]",...args),
    warn:(...args)=>console.warn("[App Warning]",...args),
    info:(...args)=>console.info("[App Info]",...args)
});