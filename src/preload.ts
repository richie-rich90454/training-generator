import{contextBridge,ipcRenderer}from "electron"
import{invoke}from "./ipcRenderer.ts"
import{WINDOW_MINIMIZE_CHANNEL,WINDOW_MAXIMIZE_TOGGLE_CHANNEL,WINDOW_CLOSE_CHANNEL,WINDOW_IS_MAXIMIZED_CHANNEL,WINDOW_MAXIMIZED_CHANGED_EVENT}from "./types/ipc.ts"
import type{FileObj}from "./types/index.js"

const streamTokenCallbacks=new Map<string,(token:string)=>void>()
ipcRenderer.on("ollama:stream-token",(_event,data:{requestId:string;token:string})=>{
	const cb=streamTokenCallbacks.get(data.requestId)
	if(cb)cb(data.token)
})
ipcRenderer.on("ollama:stream-done",(_event,data:{requestId:string})=>{
	streamTokenCallbacks.delete(data.requestId)
})

contextBridge.exposeInMainWorld("electronAPI",{
    openFileDialog:()=>invoke("dialog:openFile"),
    readFile:(filePath:string)=>invoke("file:read",{filePath}),
    getPrompt:(language:string,processingType:string)=>invoke("prompt:get",{language,processingType}),
    parseFile:(filePath:string,fileType:string)=>invoke("file:parse",{filePath,fileType}),
    parseFileBuffer:(buffer:ArrayBuffer,fileType:string)=>invoke("file:parseBuffer",{buffer,fileType}),
    parseFilesBatch:(files:FileObj[])=>invoke("file:parseBatch",{files}),
    saveFile:(filePath:string,content:string)=>invoke("file:save",{filePath,content}),
    saveFileDialog:(defaultFilename?:string)=>invoke("dialog:saveFile",{defaultFilename}),
    checkOllama:()=>invoke("ollama:check"),
    generateWithOllama:(model:string,prompt:string,options?:Record<string,unknown>)=>invoke("ollama:generate",{model,prompt,options}),
    generateWithOllamaStream:(model:string,prompt:string,options?:Record<string,unknown>)=>invoke("ollama:generateStream",{model,prompt,options}),
    generateWithOpenAI:(apiKey:string,baseUrl:string,model:string,prompt:string,options?:Record<string,unknown>)=>invoke("openai:generate",{apiKey,baseUrl,model,prompt,options}),
    generateWithAnthropic:(apiKey:string,model:string,prompt:string,options?:Record<string,unknown>)=>invoke("anthropic:generate",{apiKey,model,prompt,options}),
    generateWithGemini:(apiKey:string,model:string,prompt:string,options?:Record<string,unknown>)=>invoke("gemini:generate",{apiKey,model,prompt,options}),
    getAppVersion:()=>invoke("app:getVersion"),
    getPlatform:()=>invoke("app:getPlatform"),
    getSecureKey:()=>invoke("secureKey:getKey"),
    setSecureKey:(key:string)=>invoke("secureKey:setKey",{key}),
    openUserGuide:()=>invoke("docs:openUserGuide"),
    loadCache:()=>invoke("cache:load"),
    saveCache:(data:Record<string,any>)=>invoke("cache:save",{data}),
    clearCache:()=>invoke("cache:clear"),
    compactCache:()=>invoke("cache:compact"),
    saveProgress:(data:any)=>invoke("progress:save",{data}),
    loadProgress:()=>invoke("progress:load"),
    clearProgress:()=>invoke("progress:clear"),
    writeLog:(entry:unknown)=>invoke("write-log",{entry:entry as import("./types/index.js").LogEntry}),
    exportLogs:(data:string)=>invoke("export-logs",{data}),
    saveCheckpoint:(data:unknown)=>invoke("save-checkpoint",{data}),
    loadCheckpoint:()=>invoke("load-checkpoint"),
    clearCheckpoint:()=>invoke("clear-checkpoint"),
    windowMinimize:()=>invoke(WINDOW_MINIMIZE_CHANNEL),
    windowMaximizeToggle:()=>invoke(WINDOW_MAXIMIZE_TOGGLE_CHANNEL),
    windowClose:()=>invoke(WINDOW_CLOSE_CHANNEL),
    windowIsMaximized:()=>invoke(WINDOW_IS_MAXIMIZED_CHANNEL),
    onWindowMaximizedChange:(cb:(isMaximized:boolean)=>void):()=>void=>{
        let handler=(_:unknown,isMaximized:boolean)=>cb(isMaximized)
        ipcRenderer.on(WINDOW_MAXIMIZED_CHANGED_EVENT,handler)
        return ()=>{
            ipcRenderer.off(WINDOW_MAXIMIZED_CHANGED_EVENT,handler)
        }
    },
    onOllamaStreamToken:(requestId:string,callback:(token:string)=>void):()=>void=>{
        streamTokenCallbacks.set(requestId,callback)
        return ()=>{
            streamTokenCallbacks.delete(requestId)
        }
    }
})
