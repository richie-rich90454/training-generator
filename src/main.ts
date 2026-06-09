import{app,BrowserWindow,ipcMain,dialog}from "electron"
import path from "path"
import fs from "fs"
import{promises as fsp}from "fs"
import{spawn}from "child_process"
import{fileURLToPath}from "url"
import axios from "axios"
import FileParserLazy from "./core/fileParserLazy.js"
import type{FileObj,OllamaGenerateOptions}from "./types/index.js"

let isWin:boolean=process.platform=="win32"
let isMac:boolean=process.platform=="darwin"
let mainWindow:BrowserWindow|null=null
let splashWindow:BrowserWindow|null=null
let splashProcess:import("child_process").ChildProcess|null=null
let fileParser:InstanceType<typeof FileParserLazy>|null=null
let userDataPath=path.join(app.getPath("documents"),"TrainingGenerator")
let cachePath=path.join(userDataPath,"Cache")
function isPathWithin(baseDir:string,targetPath:string):boolean{
    try{
        let resolvedTarget=path.resolve(targetPath)
        let resolvedBase=path.resolve(baseDir)
        return resolvedTarget===resolvedBase||resolvedTarget.startsWith(resolvedBase+path.sep)
    }
    catch{
        return false
    }
}
function getSafeReadDirs():string[]{
    let dirs:string[]=[]
    try{
        dirs.push(path.resolve(app.getAppPath()))
        dirs.push(path.resolve(app.getAppPath(),"src","prompts"))
        dirs.push(path.resolve(app.getAppPath(),"dist","prompts"))
        dirs.push(path.resolve(app.getAppPath(),"prompts"))
        if(process.resourcesPath){
            dirs.push(path.resolve(process.resourcesPath))
        }
        let metaDir=path.dirname(fileURLToPath(import.meta.url))
        dirs.push(path.resolve(metaDir,"..","src","prompts"))
        dirs.push(path.resolve(metaDir,"..","dist","prompts"))
        dirs.push(path.resolve(metaDir,"..","prompts"))
        dirs.push(path.resolve(metaDir,"..","..","src","prompts"))
        dirs.push(path.resolve(metaDir,"..","..","dist","prompts"))
    }
    catch{}
    return dirs
}
function isPathSafeForRead(filePath:string):boolean{
    if(!filePath||typeof filePath!=="string"||filePath.includes("\x00"))return false
    try{
        let resolved=path.resolve(filePath)
        for(let dir of getSafeReadDirs()){
            if(isPathWithin(dir,resolved))return true
        }
        return false
    }
    catch{
        return false
    }
}
function isPathSafeForWrite(filePath:string):boolean{
    if(!filePath||typeof filePath!=="string"||filePath.includes("\x00"))return false
    try{
        let resolved=path.resolve(filePath)
        let userDocs=path.resolve(app.getPath("documents"))
        let userDownloads=path.resolve(app.getPath("downloads"))
        let userDesktop=path.resolve(app.getPath("desktop"))
        let userHome=path.resolve(app.getPath("home"))
        return isPathWithin(userDocs,resolved)
            ||isPathWithin(userDownloads,resolved)
            ||isPathWithin(userDesktop,resolved)
            ||isPathWithin(userHome,resolved)
    }
    catch{
        return false
    }
}
function isPathSafeForParse(filePath:string):boolean{
    if(!filePath||typeof filePath!=="string"||filePath.includes("\x00")||filePath.includes(".."))return false
    try{
        let resolved=path.resolve(filePath)
        let userHome=path.resolve(app.getPath("home"))
        if(!isPathWithin(userHome,resolved))return false
        if(!fs.existsSync(resolved))return false
        let stats=fs.statSync(resolved)
        return stats.isFile()
    }
    catch{
        return false
    }
}
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
    cachePath=(app as any).getPath("cache")
}
app.setPath("userData",userDataPath)
;(app as any).setPath("cache",cachePath)
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
            preload:path.join(path.dirname(fileURLToPath(import.meta.url)),"preload.ts"),
            nodeIntegration:false,
            contextIsolation:true,
            spellcheck:false,
            disableHtmlFullscreenWindowResize:true,
            sandbox:false,
            webgl:true,
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
app.on("before-quit",async()=>{
    if(splashProcess){
        try{splashProcess.kill()}catch{}
        splashProcess=null
    }
    if(fileParser){
        try{await fileParser.cleanup()}catch{}
        fileParser=null
    }
})
app.on("activate",()=>{
    if(!mainWindow){
        createMainWindow()
    }
})
ipcMain.handle("dialog:openFile",async(_:Electron.IpcMainInvokeEvent):Promise<FileObj[]>=>{
    let result=await dialog.showOpenDialog(mainWindow as Electron.BaseWindow,{
        properties:["openFile","multiSelections"],
        filters:[
            {name:"Documents",extensions:["pdf","docx","doc","rtf","txt","md","html"]},
            {name:"All Files",extensions:["*"]}
        ]
    })
    if(result.canceled)return[]
    let maxSize=100*1024*1024
    let files=await Promise.all(result.filePaths.map(async filePath=>{
        try{
            if(filePath.includes("\x00")||filePath.includes(".."))return null
            let resolvedPath=path.resolve(filePath)
            let userHome=path.resolve(app.getPath("home"))
            if(!isPathWithin(userHome,resolvedPath))return null
            let stats=await fsp.stat(filePath)
            if(!stats.isFile()||stats.size>maxSize)return null
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
    let result=await dialog.showSaveDialog(mainWindow as Electron.BaseWindow,{
        defaultPath:defaultFilename||"training_data.jsonl",
        filters:[
            {name:"JSON Lines",extensions:["jsonl"]},
            {name:"JSON",extensions:["json"]},
            {name:"Text",extensions:["txt"]},
            {name:"All Files",extensions:["*"]}
        ]
    })
    if(result.canceled||!result.filePath)return null
    if(result.filePath.includes("\x00")||result.filePath.includes(".."))return null
    return result.filePath
})
ipcMain.handle("file:read",async(_:Electron.IpcMainInvokeEvent,filePath:string):Promise<{success:boolean;content?:string;error?:string}>=>{
    try{
        if(!filePath||typeof filePath!=="string"){
            return{success:false,error:"Invalid file path"}
        }
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
        
        if(!isPathSafeForRead(resolvedPath)){
            return{success:false,error:"File path is outside allowed directories"}
        }
        let content=await fsp.readFile(resolvedPath,"utf-8")
        return{success:true,content}
    }
    catch(error){
        return{success:false,error:"Failed to read file"}
    }
})
ipcMain.handle("file:save",async(_:Electron.IpcMainInvokeEvent,filePath:string,content:string):Promise<{success:boolean;error?:string}>=>{
    try{
        if(!filePath||typeof filePath!=="string"||!content||typeof content!=="string"){
            return{success:false,error:"Invalid file path or content"}
        }
        if(content.length>100*1024*1024){
            return{success:false,error:"Content exceeds maximum size of 100MB"}
        }
        if(!isPathSafeForWrite(filePath)){
            return{success:false,error:"File path is outside allowed write directories"}
        }
        await fsp.writeFile(filePath,content,"utf-8")
        return{success:true}
    }
    catch(error){
        return{success:false,error:"Failed to save file"}
    }
})
ipcMain.handle("file:parse",async(_:Electron.IpcMainInvokeEvent,filePath:string,fileType:string):Promise<{success:boolean;content?:string;error?:string}>=>{
    try{
        if(!filePath||typeof filePath!=="string"||!fileType||typeof fileType!=="string"){
            return{success:false,error:"Invalid file path or type"}
        }
        if(!isPathSafeForParse(filePath)){
            return{success:false,error:"Invalid or unsafe file path"}
        }
        if(!fileParser){
            fileParser=new FileParserLazy()
        }
        let text=await fileParser.parseFile(filePath,fileType)
        return{success:true,content:text}
    }
    catch(error){
        return{success:false,error:"Failed to parse file"}
    }
})
ipcMain.handle("file:parseBatch",async(_:Electron.IpcMainInvokeEvent,files:FileObj[]):Promise<{success:boolean;results?:unknown[];error?:string}>=>{
    try{
        if(!files||!Array.isArray(files)||files.length===0){
            return{success:false,error:"Invalid files array"}
        }
        if(files.length>50){
            return{success:false,error:"Cannot process more than 50 files at once"}
        }
        for(let f of files){
            if(!f||!f.path||typeof f.path!=="string"){
                return{success:false,error:"Invalid file entry in batch"}
            }
            if(!isPathSafeForParse(f.path)){
                return{success:false,error:`Invalid or unsafe file path: ${path.basename(f.path)}`}
            }
        }
        if(!fileParser){
            fileParser=new FileParserLazy()
        }
        let results=await fileParser.processFiles(files.map(f=>f.path))
        return{success:true,results}
    }
    catch(error){
        return{success:false,error:"Failed to parse files"}
    }
})
ipcMain.handle("ollama:check",async(_:Electron.IpcMainInvokeEvent):Promise<{running:boolean;models:unknown[];version:string}|{running:false;models:never[];error:string}>=>{
    try{
        let tagsResponse=await axios.get("http://localhost:11434/api/tags",{timeout:5000})
        let models=(tagsResponse.data.models||[]).map((m:any)=>({
            ...m,
            name:typeof m.name==="string"?m.name.replace(/[\x00-\x1F]/g,""):String(m.name||"").replace(/[\x00-\x1F]/g,"")
        }))
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
            models,
            version
        }
    }
    catch(error){
        console.error("Ollama check failed:",(error as Error).message)
        return{running:false,models:[],error:"Failed to connect to Ollama"}
    }
})
ipcMain.handle("ollama:generate",async(_:Electron.IpcMainInvokeEvent,payload:{model:string;prompt:string;options?:OllamaGenerateOptions}):Promise<{success:boolean;response?:string;error?:string}>=>{
    let{model,prompt,options={}}=payload
    if(!model||typeof model!=="string"||!prompt||typeof prompt!=="string"){
        return{success:false,error:"Invalid model name or prompt"}
    }
    if(prompt.length>500000){
        return{success:false,error:"Prompt is too large"}
    }
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
                    model:model.replace(/[\x00-\x1F]/g,""),
                    prompt,
                    stream:false,
                    options:{
                        temperature:Math.min(2,Math.max(0,options.temperature ?? 0.7)),
                        top_p:Math.min(1,Math.max(0,options.top_p ?? 0.9)),
                        ...options
                    }
                },
                {
                    timeout,
                    maxContentLength:50*1024*1024,
                    maxBodyLength:50*1024*1024,
                    headers:{
                        "Content-Type":"application/json",
                        "Accept":"application/json"
                    }
                }
            )
            if(!response.data||typeof response.data.response!=="string"){
                return{success:false,error:"Invalid response from Ollama"}
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
    return{success:false,error:"Failed to generate response from Ollama"}
})
ipcMain.handle("app:getVersion",(_:Electron.IpcMainInvokeEvent):string=>app.getVersion())
ipcMain.handle("app:getPlatform",(_:Electron.IpcMainInvokeEvent):string=>process.platform)
process.on("uncaughtException",(error:Error)=>{
    console.error("Uncaught Exception:",error)
})
process.on("unhandledRejection",(reason:unknown,promise:Promise<unknown>)=>{
    console.error("Unhandled Rejection at:",promise,"reason:",reason)
})
