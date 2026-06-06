import{app,BrowserWindow,ipcMain,dialog}from "electron"
import path from "path"
import fs from "fs"
import{promises as fsp}from "fs"
import{spawn}from "child_process"
import{fileURLToPath}from "url"
import axios from "axios"
import FileParserLazy from "./core/fileParserLazy.js"
import type{FileObj,OllamaGenerateOptions}from "./types/interfaces"

let isWin:boolean=process.platform=="win32"
let isMac:boolean=process.platform=="darwin"
let mainWindow:BrowserWindow|null=null
let splashWindow:BrowserWindow|null=null
let splashProcess:import("child_process").ChildProcess|null=null
let fileParser:InstanceType<typeof FileParserLazy>|null=null
let userDataPath=path.join(app.getPath("documents"),"TrainingGenerator")
let cachePath=path.join(userDataPath,"Cache")
try{
    if(!fs.existsSync(userDataPath)){
        fs.mkdirSync(userDataPath,{recursive:true})
    }
    if(!fs.existsSync(cachePath)){
        fs.mkdirSync(cachePath,{recursive:true})
    }
}
catch(error){
    console.error("Failed to create directories:",error)
    userDataPath=app.getPath("userData")
    cachePath=app.getPath("cache")
}
app.setPath("userData",userDataPath)
app.setPath("cache",cachePath)
app.commandLine.appendSwitch("no-first-run")
app.commandLine.appendSwitch("disable-background-networking")
app.commandLine.appendSwitch("disable-component-update")
app.commandLine.appendSwitch("disable-sync")
app.commandLine.appendSwitch("disable-default-apps")
app.commandLine.appendSwitch("metrics-recording-only")
app.commandLine.appendSwitch("enable-gpu-rasterization")
app.commandLine.appendSwitch("enable-oop-rasterization")
app.commandLine.appendSwitch("enable-zero-copy")
app.commandLine.appendSwitch("enable-gpu")
app.commandLine.appendSwitch("enable-accelerated-2d-canvas")
app.commandLine.appendSwitch("enable-accelerated-video-decode")
if(isWin){
    app.commandLine.appendSwitch("disable-hang-monitor")
    app.commandLine.appendSwitch("disable-prompt-on-repost")
}
function startSplash(){
    if(isWin){
        let exePaths=[
            path.join(process.resourcesPath,"native-splash","splash.exe"),
            path.join(path.dirname(fileURLToPath(import.meta.url)),"..","native-splash","splash.exe"),
            path.join(path.dirname(fileURLToPath(import.meta.url)),"..","..","native-splash","splash.exe"),
        ]
        let exePath:string|null=null
        for(let p of exePaths){
            if(fs.existsSync(p)){
                exePath=p
                break
            }
        }
        if(exePath){
            splashProcess=spawn(exePath,[],{
                detached:true,
                stdio:"ignore"
            })
            splashProcess.unref()
        }
        return
    }
    splashWindow=new BrowserWindow({
        width:isMac?500:450,
        height:isMac?400:350,
        frame:false,
        transparent:isMac,
        resizable:false,
        alwaysOnTop:true,
        show:false,
        backgroundColor:isMac?"#00000000":"#FFFFFF",
        webPreferences:{
            nodeIntegration:false,
            contextIsolation:true,
            sandbox:true
        }
    })
    splashWindow.loadFile(path.join(path.dirname(fileURLToPath(import.meta.url)),"splash.html")).then(()=>{
        splashWindow!.center()
        splashWindow!.show()
    }).catch(console.error)
}
function stopSplash(){
    if(isWin&&splashProcess){
        try{splashProcess.kill()}
        catch{}
        splashProcess=null
        return
    }
    if(splashWindow&&!splashWindow.isDestroyed()){
        splashWindow.close()
        splashWindow=null
    }
}
function createMainWindow(){
    mainWindow=new BrowserWindow({
        width:1400,
        height:900,
        minWidth:1000,
        minHeight:700,
        show:false,
        frame:true,
        transparent:isMac,
        backgroundColor:isMac?"#000000":"#FFFFFF",
        titleBarStyle:"default",
        useContentSize:true,
        webPreferences:{
            preload:path.join(path.dirname(fileURLToPath(import.meta.url)),"preload.js"),
            nodeIntegration:false,
            contextIsolation:true,
            spellcheck:false,
            disableHtmlFullscreenWindowResize:true,
            sandbox:false,
            webgl:true,
            webgl2:true,
            backgroundThrottling:false,
            enablePreferredSizeMode:true,
            scrollBounce:true
        }
    })
    mainWindow.setMenu(null)
    if(process.env.NODE_ENV=="development"){
        mainWindow.loadURL("http://localhost:5173")
        mainWindow.webContents.openDevTools({mode:"detach"})
    }
    else{
        mainWindow.loadFile(path.join(path.dirname(fileURLToPath(import.meta.url)),"../dist/index.html"))
    }
    mainWindow.webContents.once("dom-ready",()=>{
        stopSplash()
        mainWindow!.show()
        mainWindow!.focus()
    })
    mainWindow.webContents.on("did-fail-load",(event,errorCode,errorDescription,validatedURL)=>{
        console.error(`Failed to load:${validatedURL},Code:${errorCode},${errorDescription}`)
        dialog.showErrorBox(
            "Loading Failed",
            `Failed to load application:${errorDescription}\n\nPlease check if the application files are complete and try again.`
        )
        stopSplash()
        if(mainWindow&&!mainWindow.isDestroyed()){
            mainWindow.close()
        }
    })
    mainWindow.webContents.on("render-process-gone",(event,details)=>{
        console.error("Renderer process crashed:",details)
        dialog.showErrorBox(
            "Renderer Crashed",
            "The application UI has crashed. Please restart the application."
        )
        stopSplash()
        if(mainWindow&&!mainWindow.isDestroyed()){
            mainWindow.close()
        }
    })
    mainWindow.on("closed",()=>{
        mainWindow=null
    })
}
app.whenReady().then(()=>{
    startSplash()
    createMainWindow()
})
app.on("window-all-closed",()=>{
    if(!isMac)app.quit()
})
app.on("activate",()=>{
    if(!mainWindow){
        createMainWindow()
    }
})
ipcMain.handle("dialog:openFile",async(_:Electron.IpcMainInvokeEvent):Promise<FileObj[]>=>{
    let result=await dialog.showOpenDialog(mainWindow,{
        properties:["openFile","multiSelections"],
        filters:[
            {name:"Documents",extensions:["pdf","docx","doc","rtf","txt","md","html"]},
            {name:"All Files",extensions:["*"]}
        ]
    })
    if(result.canceled)return[]
    let files=await Promise.all(result.filePaths.map(async filePath=>{
        try{
            let stats=await fsp.stat(filePath)
            return{
                path:filePath,
                name:path.basename(filePath),
                size:stats.size,
                type:path.extname(filePath).slice(1),
                lastModified:stats.mtime
            }as FileObj
        }
        catch{
            return null
        }
    }))
    return files.filter(Boolean)as FileObj[]
})
ipcMain.handle("dialog:saveFile",async(_:Electron.IpcMainInvokeEvent,defaultFilename?:string):Promise<string|null>=>{
    let result=await dialog.showSaveDialog(mainWindow!,{
        defaultPath:defaultFilename||"training_data.jsonl",
        filters:[
            {name:"JSON Liners",extensions:["jsonl"]},
            {name:"JSON",extensions:["json"]},
            {name:"Text",extensions:["txt"]},
            {name:"All Files",extensions:["*"]}
        ]
    })
    return result.canceled?null:result.filePath
})
ipcMain.handle("file:read",async(_:Electron.IpcMainInvokeEvent,filePath:string):Promise<{success:boolean;content?:string;error?:string}>=>{
    try{
        let resolvedPath=filePath;
        if(filePath.includes("prompts/")){
            let possiblePaths=[
                filePath,
                path.join(process.resourcesPath,filePath),
                path.join(path.dirname(fileURLToPath(import.meta.url)),"..",filePath),
                path.join(path.dirname(fileURLToPath(import.meta.url)),"..","dist",filePath),
                path.join(app.getAppPath(),filePath),
            ];
            if(filePath.startsWith("src/prompts/")){
                let withoutSrc=filePath.replace("src/prompts/","prompts/");
                possiblePaths.push(
                    withoutSrc,
                    path.join(process.resourcesPath,withoutSrc),
                    path.join(path.dirname(fileURLToPath(import.meta.url)),"..",withoutSrc),
                    path.join(path.dirname(fileURLToPath(import.meta.url)),"..","dist",withoutSrc),
                    path.join(app.getAppPath(),withoutSrc)
                );
            }
            for(let p of possiblePaths){
                try{
                    if(fs.existsSync(p)){
                        resolvedPath=p;
                        break;
                    }
                }
                catch{}
            }
        }
        
        let content=await fsp.readFile(resolvedPath,"utf-8")
        return{success:true,content}
    }
    catch(error){
        return{success:false,error:(error as Error).message}
    }
})
ipcMain.handle("file:save",async(_:Electron.IpcMainInvokeEvent,filePath:string,content:string):Promise<{success:boolean;error?:string}>=>{
    try{
        await fsp.writeFile(filePath,content,"utf-8")
        return{success:true}
    }
    catch(error){
        return{success:false,error:(error as Error).message}
    }
})
ipcMain.handle("file:parse",async(_:Electron.IpcMainInvokeEvent,filePath:string,fileType:string):Promise<{success:boolean;content?:string;error?:string}>=>{
    try{
        if(!fileParser){
            fileParser=new FileParserLazy()
        }
        let text=await fileParser.parseFile(filePath,fileType)
        return{success:true,content:text}
    }
    catch(error){
        return{success:false,error:(error as Error).message}
    }
})
ipcMain.handle("file:parseBatch",async(_:Electron.IpcMainInvokeEvent,files:FileObj[]):Promise<{success:boolean;results?:unknown[];error?:string}>=>{
    try{
        if(!fileParser){
            fileParser=new FileParserLazy()
        }
        let results=await fileParser.processFiles(files.map(f=>f.path))
        return{success:true,results}
    }
    catch(error){
        return{success:false,error:(error as Error).message}
    }
})
ipcMain.handle("ollama:check",async(_:Electron.IpcMainInvokeEvent):Promise<{running:boolean;models:unknown[];version:string}|{running:false;error:string}>=>{
    try{
        let tagsResponse=await axios.get("http://localhost:11434/api/tags",{timeout:5000})
        let version="unknown"
        try{
            let versionResponse=await axios.get("http://localhost:11434/api/version",{timeout:3000})
            version=versionResponse.data.version||"unknown"
        }
        catch{
            if(tagsResponse.data?.version){
                version=tagsResponse.data.version
            }
        }
        return{
            running:true,
            models:tagsResponse.data.models||[],
            version
        }
    }
    catch(error){
        return{running:false,error:(error as Error).message}
    }
})
ipcMain.handle("ollama:generate",async(_:Electron.IpcMainInvokeEvent,payload:{model:string;prompt:string;options?:OllamaGenerateOptions}):Promise<{success:boolean;response?:string;error?:string}>=>{
    let{model,prompt,options={}}=payload
    try{
        await axios.get("http://localhost:11434/api/show",{
            params:{name:model},
            timeout:10000
        }).catch(()=>{})
    }
    catch{}
    let promptLength=prompt.length
    let timeout=300000
    if(promptLength>10000)timeout=600000
    else if(promptLength>5000)timeout=450000
    let maxRetries=2
    let lastError:Error|null=null
    for(let attempt=0;attempt<=maxRetries;attempt++){
        try{
            let response=await axios.post(
                "http://localhost:11434/api/generate",
                {
                    model,
                    prompt,
                    stream:false,
                    options:{
                        temperature:options.temperature??.7,
                        top_p:options.top_p??.9,
                        ...options
                    }
                },
                {
                    timeout,
                    headers:{
                        "Content-Type":"application/json",
                        "Accept":"application/json"
                    }
                }
            )
            if(!response.data?.response){
                throw new Error("Invalid response from Ollama")
            }
            return{success:true,response:response.data.response}
        }
        catch(error){
            lastError=error as Error
            if((error as any).code=="ECONNABORTED"||(error as Error).message.includes("timeout")){
                if(attempt<maxRetries){
                    await new Promise(r=>setTimeout(r,5000))
                }
            }
            else{
                break
            }
        }
    }
    throw new Error(`Failed after ${maxRetries+1}attempts:${lastError?.message||"Unknown error"}`)
})
ipcMain.handle("app:getVersion",(_:Electron.IpcMainInvokeEvent):string=>app.getVersion())
ipcMain.handle("app:getPlatform",(_:Electron.IpcMainInvokeEvent):string=>process.platform)
process.on("uncaughtException",(error:Error)=>{
    console.error("Uncaught Exception:",error)
})
process.on("unhandledRejection",(reason:unknown,promise:Promise<unknown>)=>{
    console.error("Unhandled Rejection at:",promise,"reason:",reason)
})
