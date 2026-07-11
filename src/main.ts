import{app,BrowserWindow,ipcMain,dialog,shell,safeStorage,Tray,Menu,nativeImage,protocol}from "electron"
import path from "path"
import fs from "fs"
import{promises as fsp}from "fs"
import{fileURLToPath}from "url"
import http from "http"
import https from "https"
import crypto from "crypto"
import axios from "axios"
import FileParserLazy from "./core/fileParserLazy.ts"
import{SmartCache}from "./core/smartCache.ts"
import{handle,registerWindowControlHandlers}from "./ipcMain.ts"
import type{FileObj,OllamaGenerateOptions,ParseBatchItem,OllamaStatus,OllamaModel}from "./types/index.ts"
import{t}from "./renderer/i18n.ts"
const APP_SCHEME="app"
const MIME_TYPES:Record<string,string>={
    ".html":"text/html",
    ".js":"application/javascript",
    ".mjs":"application/javascript",
    ".css":"text/css",
    ".json":"application/json",
    ".png":"image/png",
    ".jpg":"image/jpeg",
    ".jpeg":"image/jpeg",
    ".gif":"image/gif",
    ".svg":"image/svg+xml",
    ".ico":"image/x-icon",
    ".icns":"image/icns",
    ".woff":"font/woff",
    ".woff2":"font/woff2",
    ".ttf":"font/ttf",
    ".otf":"font/otf",
    ".eot":"application/vnd.ms-fontobject",
    ".wasm":"application/wasm"
}
function getDistDir():string{
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","dist")
}
function registerAppScheme():void{
    // Must be called before app.ready so the privileged scheme is honored.
    try{
        protocol.registerSchemesAsPrivileged([
            {
                scheme:APP_SCHEME,
                privileges:{
                    standard:true,
                    secure:true,
                    supportFetchAPI:true,
                    corsEnabled:true
                }
            }
        ])
    }
    catch(error){
        console.error("Failed to register app scheme:",error)
    }
}
function registerAppProtocolHandler():void{
    // protocol.handle needs the default session, which is only available after app.ready.
    try{
        let distDir:string=getDistDir()
        let resolvedDist:string=path.resolve(distDir)
        protocol.handle(APP_SCHEME,async(request:Request):Promise<Response>=>{
            let url:URL=new URL(request.url)
            let relativePath:string=decodeURIComponent(url.pathname)
            if(relativePath.startsWith("/")){
                relativePath=relativePath.slice(1)
            }
            if(!relativePath){
                relativePath="index.html"
            }
            let filePath:string=path.normalize(path.join(distDir,relativePath))
            console.log(`[app-protocol] ${request.url} -> ${filePath}`)
            if(!filePath.startsWith(resolvedDist+path.sep)&&filePath!==resolvedDist){
                console.warn(`[app-protocol] forbidden: ${filePath}`)
                return new Response("Forbidden",{status:403,headers:{"Content-Type":"text/plain"}})
            }
            try{
                let data:Buffer=await fsp.readFile(filePath)
                let ext:string=path.extname(filePath).toLowerCase()
                let contentType:string=MIME_TYPES[ext]||"application/octet-stream"
                console.log(`[app-protocol] serving ${filePath} as ${contentType} (${data.length} bytes)`)
                return new Response(new Uint8Array(data),{
                    status:200,
                    headers:{
                        "Content-Type":contentType,
                        "Access-Control-Allow-Origin":"*"
                    }
                })
            }
            catch(error){
                console.warn(`[app-protocol] not found: ${filePath}`,error)
                return new Response("Not found",{status:404,headers:{"Content-Type":"text/plain"}})
            }
        })
    }
    catch(error){
        console.error("Failed to register app protocol handler:",error)
    }
}
registerAppScheme()
let httpAgent=new http.Agent({keepAlive:true,keepAliveMsecs:30000,maxSockets:10,maxFreeSockets:5})
let httpsAgent=new https.Agent({keepAlive:true,keepAliveMsecs:30000,maxSockets:10,maxFreeSockets:5})

let isWin:boolean=process.platform==="win32"
let isMac:boolean=process.platform==="darwin"
let mainWindow:BrowserWindow|null=null
let tray:Tray|null=null
let fileParser:InstanceType<typeof FileParserLazy>|null=null
let smartCache=new SmartCache({maxEntries:1000,maxSizeBytes:50*1024*1024,maxAgeMs:24*60*60*1000,compress:true})
let deferredIpcRegistered=false
let isAppQuitting=false
let writeLogQueue:Promise<void>=Promise.resolve()
let userDataPath=path.join(app.getPath("documents"),"TrainingGenerator")
let cachePath=path.join(userDataPath,"Cache")
let keyStoragePath=path.join(userDataPath,".keys")
const MAX_READ_SIZE=10*1024*1024
let allowedParsePaths=new Set<string>()
let allowedSavePaths=new Set<string>()
function normalizeAllowlistPath(filePath:string):string{
    try{
        let resolved=path.resolve(filePath)
        if(isWin||isMac){
            return resolved.toLowerCase()
        }
        return resolved
    }
    catch{
        return filePath
    }
}
function allowParsePath(filePath:string):void{
    try{
        allowedParsePaths.add(normalizeAllowlistPath(filePath))
    }
    catch{}
}
function allowSavePath(filePath:string):void{
    try{
        allowedSavePaths.add(normalizeAllowlistPath(filePath))
    }
    catch{}
}
function isAllowedParsePath(filePath:string):boolean{
    try{
        return allowedParsePaths.has(normalizeAllowlistPath(filePath))
    }
    catch{
        return false
    }
}
function isAllowedSavePath(filePath:string):boolean{
    try{
        return allowedSavePaths.has(normalizeAllowlistPath(filePath))
    }
    catch{
        return false
    }
}
function isPathWithin(baseDir:string,targetPath:string):boolean{
    try{
        let resolvedTarget=path.resolve(targetPath)
        let resolvedBase=path.resolve(baseDir)
        if(isWin||isMac){
            let rt=resolvedTarget.toLowerCase()
            let rb=resolvedBase.toLowerCase()
            return rt===rb||rt.startsWith(rb+path.sep.toLowerCase())
        }
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
        if(typeof process!=="undefined"&&process.resourcesPath){
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
function normalizePromptsPath(filePath:string):string{
    return filePath.replace(/\\/g,"/")
}
function isPromptsPath(filePath:string):boolean{
    return normalizePromptsPath(filePath).includes("prompts/")
}
function isPathSafeForParse(filePath:string):boolean{
    if(!filePath||typeof filePath!=="string"||filePath.includes("\x00"))return false
    try{
        let resolved=path.resolve(filePath)
        if(isAllowedParsePath(resolved)||isPathWithin(userDataPath,resolved))return fs.statSync(resolved).isFile()
        return false
    }
    catch{
        return false
    }
}
function isPrivateOrLoopbackHost(hostname:string):boolean{
    let h=hostname.toLowerCase()
    if(h==="localhost"||h==="127.0.0.1"||h==="::1"||h==="0.0.0.0")return true
    if(h.startsWith("127.")||h.startsWith("10.")||h.startsWith("192.168."))return true
    if(h.startsWith("172.")){
        let parts=h.split(".")
        let second=parseInt(parts[1],10)
        if(second>=16&&second<=31)return true
    }
    if(h.startsWith("fc")||h.startsWith("fd")||h.startsWith("fe80:")||h.startsWith("169.254."))return true
    return false
}
function isValidOpenAIBaseUrl(baseUrl:string):boolean{
    if(!baseUrl||typeof baseUrl!=="string")return false
    try{
        let url=new URL(baseUrl)
        if(url.protocol!=="http:"&&url.protocol!=="https:")return false
        if(!url.hostname||isPrivateOrLoopbackHost(url.hostname))return false
        return true
    }
    catch{
        return false
    }
}
async function getSecureKey():Promise<string|null>{
    try{
        await fsp.mkdir(keyStoragePath,{recursive:true})
        let encryptedPath=path.join(keyStoragePath,"aes-key-encrypted")
        let plainPath=path.join(keyStoragePath,"aes-key")
        if(safeStorage.isEncryptionAvailable()&&fs.existsSync(encryptedPath)){
            try{
                let encrypted=await fsp.readFile(encryptedPath)
                return safeStorage.decryptString(encrypted)
            }
            catch{
                await fsp.unlink(encryptedPath).catch(()=>{})
            }
        }
        if(fs.existsSync(plainPath)){
            try{
                return await fsp.readFile(plainPath,"utf-8")
            }
            catch{
                await fsp.unlink(plainPath).catch(()=>{})
            }
        }
        let key=crypto.randomBytes(32).toString("base64")
        if(safeStorage.isEncryptionAvailable()){
            await fsp.writeFile(encryptedPath,safeStorage.encryptString(key))
        }
        else{
            await fsp.writeFile(plainPath,key,"utf-8")
        }
        return key
    }
    catch(error){
        console.error("getSecureKey failed:",error)
        return null
    }
}
async function setSecureKey(key:string):Promise<boolean>{
    try{
        await fsp.mkdir(keyStoragePath,{recursive:true})
        if(safeStorage.isEncryptionAvailable()){
            await fsp.writeFile(path.join(keyStoragePath,"aes-key-encrypted"),safeStorage.encryptString(key))
        }
        else{
            await fsp.writeFile(path.join(keyStoragePath,"aes-key"),key,"utf-8")
        }
        return true
    }
    catch(error){
        console.error("setSecureKey failed:",error)
        return false
    }
}
function resolveWritableUserDataPath():string{
    const preferred=path.join(app.getPath("documents"),"TrainingGenerator")
    try{
        fs.mkdirSync(preferred,{recursive:true})
        const testFile=path.join(preferred,".write-test")
        fs.writeFileSync(testFile,"")
        fs.unlinkSync(testFile)
        return preferred
    }
    catch{
        const appDataFallback=path.join(app.getPath("userData"),"TrainingGenerator")
        try{
            fs.mkdirSync(appDataFallback,{recursive:true})
            const testFile=path.join(appDataFallback,".write-test")
            fs.writeFileSync(testFile,"")
            fs.unlinkSync(testFile)
            console.warn(`[main] Documents path not writable; using app data directory: ${appDataFallback}`)
            return appDataFallback
        }
        catch{
            // Last resort for restricted/sandboxed environments: use the temp directory.
            const tempFallback=path.join(app.getPath("temp"),"TrainingGenerator")
            try{
                fs.mkdirSync(tempFallback,{recursive:true})
            }
            catch{
                // Nothing else we can do; Electron will use this path and surface any error.
            }
            console.warn(`[main] App data path not writable; using temp directory: ${tempFallback}`)
            return tempFallback
        }
    }
}
userDataPath=resolveWritableUserDataPath()
cachePath=path.join(userDataPath,"Cache")
try{
    fs.mkdirSync(cachePath,{recursive:true})
}
catch(error){
    console.error("Failed to create cache directory:",error)
}
app.setPath("userData",userDataPath)
app.setPath("cache",cachePath)
app.commandLine.appendSwitch("no-first-run")
app.commandLine.appendSwitch("disable-background-networking")
app.commandLine.appendSwitch("disable-component-update")
app.commandLine.appendSwitch("disable-sync")
app.commandLine.appendSwitch("disable-default-apps")
app.commandLine.appendSwitch("metrics-recording-only")
// Aggressive GPU switches have been removed. They can trigger renderer
// process crashes (exit code -36861) on certain Windows GPU drivers, which
// is especially problematic for a text-processing app. Chromium's defaults
// are sufficient here.
if(process.argv.includes("--disable-gpu")||process.env.TRAINING_GENERATOR_DISABLE_GPU==="true"){
    app.disableHardwareAcceleration()
}
if(isWin){
    app.commandLine.appendSwitch("disable-hang-monitor")
    app.commandLine.appendSwitch("disable-prompt-on-repost")
}
const gotSingleInstanceLock=typeof app.requestSingleInstanceLock==="function"?app.requestSingleInstanceLock():true
if(!gotSingleInstanceLock){
    if(typeof app.quit==="function"){
        app.quit()
    }
    process.exit(0)
}
if(typeof app.on==="function"){
    app.on("second-instance",()=>{
        if(mainWindow){
            if(mainWindow.isMinimized()){
                mainWindow.restore()
            }
            mainWindow.show()
            mainWindow.focus()
        }
    })
}
function createMainWindow(){
    let isCompiled=import.meta.url.endsWith(".js")||import.meta.url.endsWith(".mjs")||import.meta.url.endsWith(".cjs")
    let preloadName=isCompiled?"preload.cjs":"preload.ts"
    let preloadCandidates=[
        path.join(path.dirname(fileURLToPath(import.meta.url)),preloadName),
    ]
    if(!isCompiled){
        let builtPreload=path.join(path.dirname(fileURLToPath(import.meta.url)),"..","dist-main","preload.cjs")
        preloadCandidates.unshift(builtPreload)
        preloadCandidates.push(path.join(path.dirname(fileURLToPath(import.meta.url)),"..","src","preload.ts"))
        preloadCandidates.push(path.join(path.dirname(fileURLToPath(import.meta.url)),"..","..","src","preload.ts"))
    }
    let preloadPath=preloadCandidates.find(p=>fs.existsSync(p))||preloadCandidates[0]
    console.log(`[main] using preload script: ${preloadPath}`)
    let iconPath:string|undefined
    try{
        iconPath=path.join(app.getAppPath(),"assets","icon.png")
        if(!fs.existsSync(iconPath)){
            iconPath=undefined
        }
    }
    catch{
        iconPath=undefined
    }
    mainWindow=new BrowserWindow({
        width:1000,
        height:700,
        minWidth:760,
        minHeight:520,
        show:false,
        frame:false,
        backgroundColor:"#FFFFFF",
        useContentSize:true,
        ...(iconPath?{icon:iconPath}:{}),
        webPreferences:{
            preload:preloadPath,
            nodeIntegration:false,
            contextIsolation:true,
            spellcheck:false,
            disableHtmlFullscreenWindowResize:true,
            sandbox:true,
            // WebGL is disabled. This is a text-processing app; WebGL is unnecessary
            // and can trigger GPU-related renderer crashes on some Windows drivers.
            webgl:false,
            backgroundThrottling:false,
            // enablePreferredSizeMode and scrollBounce are disabled to avoid
            // compositor paths that have been linked to renderer hangs/crashes.
            enablePreferredSizeMode:false,
            scrollBounce:false
        }
    })
    mainWindow.center()
    // Mica/Acrylic background materials are disabled. On Windows they rely on the
    // GPU compositor and have been observed to trigger renderer process crashes
    // (exit code -36861 / Crashpad_NotConnectedToHandler) on certain drivers,
    // especially inside frameless windows. A plain opaque background is safer.
    if(isWin&&typeof mainWindow.setBackgroundMaterial==="function"){
        try{
            mainWindow.setBackgroundMaterial("none")
        }
        catch{
            // Older Electron builds may not support "none"; the window still works.
        }
    }
    mainWindow.setMenu(null)
    if(process.env.NODE_ENV==="development"){
        mainWindow.loadURL("http://localhost:5173")
        mainWindow.webContents.openDevTools({mode:"detach"})
    }
    else{
        mainWindow.loadURL(`${APP_SCHEME}://rsrc/index.html`).catch((error)=>{
            console.error("Failed to load app URL:",error)
        })
    }
    mainWindow.webContents.setWindowOpenHandler(({url})=>{
        try{
            let parsed=new URL(url)
            if(parsed.protocol==="http:"||parsed.protocol==="https:"){
                shell.openExternal(url)
            }
        }
        catch{}
        return{action:"deny"}
    })
    mainWindow.webContents.on("will-navigate",(event,url)=>{
        let appUrl=mainWindow?.webContents.getURL()||""
        if(url===appUrl)return
        event.preventDefault()
        try{
            let parsed=new URL(url)
            if(parsed.protocol==="http:"||parsed.protocol==="https:"){
                shell.openExternal(url)
            }
        }
        catch{}
    })
    mainWindow.on("maximize",()=>{
        if(!mainWindow||mainWindow.isDestroyed())return
        mainWindow.webContents.send("window:maximizedChanged",true)
    })
    mainWindow.on("unmaximize",()=>{
        if(!mainWindow||mainWindow.isDestroyed())return
        mainWindow.webContents.send("window:maximizedChanged",false)
    })
    mainWindow.webContents.once("dom-ready",()=>{
        registerDeferredIpcHandlers()
        if(mainWindow&&!mainWindow.isDestroyed()){
            mainWindow.show()
            mainWindow.focus()
        }
    })
    mainWindow.webContents.on("did-fail-load",(event,errorCode,errorDescription,validatedURL,isMainFrame)=>{
        if(!isMainFrame)return
        if(!validatedURL)return
        console.error(`Failed to load:${validatedURL},Code:${errorCode},${errorDescription}`)
        dialog.showErrorBox(
            t("dialog.loadingFailedTitle"),
            t("dialog.loadingFailedMessage",undefined,{errorDescription})
        )
        if(mainWindow&&!mainWindow.isDestroyed()){
            mainWindow.close()
        }
    })
    mainWindow.webContents.on("render-process-gone",(event,details)=>{
        console.error("Renderer process crashed:",details)
        dialog.showErrorBox(
            t("dialog.rendererCrashedTitle"),
            t("dialog.rendererCrashedMessage")
        )
        if(mainWindow&&!mainWindow.isDestroyed()){
            mainWindow.close()
        }
    })
    mainWindow.on("closed",()=>{
        mainWindow=null
    })
}
function getTrayIconPath():string|null{
    let fileName=isWin?"tray-icon.ico":"tray-icon.png"
    let candidates:string[]=[
        path.join(app.getAppPath(),"assets",fileName),
        path.join(path.dirname(fileURLToPath(import.meta.url)),"..","assets",fileName),
        path.join(path.dirname(fileURLToPath(import.meta.url)),"..","..","assets",fileName)
    ]
    if(typeof process!=="undefined"&&process.resourcesPath){
        candidates.splice(1,0,path.join(process.resourcesPath,"assets",fileName))
    }
    for(let p of candidates){
        if(fs.existsSync(p))return p
    }
    console.error("[tray] icon not found:",candidates.join("; "))
    return null
}
function toggleWindowFromTray():void{
    if(!mainWindow)return
    if(mainWindow.isVisible()){
        if(mainWindow.isFocused()){
            mainWindow.hide()
        }
        else{
            mainWindow.focus()
        }
    }
    else{
        if(mainWindow.isMinimized()){
            mainWindow.restore()
        }
        mainWindow.show()
        mainWindow.focus()
    }
}
function buildTrayMenu():Electron.Menu{
    let label=(mainWindow&&mainWindow.isVisible())?t("tray.hide"):t("tray.show")
    return Menu.buildFromTemplate([
        {label:label,click:toggleWindowFromTray},
        {type:"separator"},
        {label:t("tray.quit"),click:()=>{isAppQuitting=true;app.quit()}}
    ])
}
function createTray():void{
    if(tray)return
    let iconPath=getTrayIconPath()
    if(!iconPath)return
    let icon:Electron.NativeImage
    try{
        icon=nativeImage.createFromPath(iconPath)
        if(icon.isEmpty()){
            console.error("[tray] loaded icon is empty")
            return
        }
    }
    catch(error){
        console.error("[tray] failed to load icon:",error)
        return
    }
    tray=new Tray(icon)
    tray.setToolTip(t("tray.tooltip"))
    if(isMac){
        tray.setContextMenu(buildTrayMenu())
    }
    else{
        tray.on("click",()=>{
            toggleWindowFromTray()
        })
        tray.on("right-click",()=>{
            if(tray)tray.popUpContextMenu(buildTrayMenu())
        })
    }
}
export async function handleOllamaGenerateStream(payload:{model?:string;prompt?:string;options?:OllamaGenerateOptions}={}):Promise<{success:boolean;response?:string;error?:string}>{
    let{model,prompt,options}=payload
    options=options??{}
    if(options.num_predict==null){
        options.num_predict=4096
    }
    else{
        options.num_predict=Math.min(8192,Math.max(256,options.num_predict))
    }
    if(!model||typeof model!=="string"||!prompt||typeof prompt!=="string"){
        return{success:false,error:t("error.invalidModelNameOrPrompt")}
    }
    if(prompt.length>500000){
        return{success:false,error:t("error.promptTooLarge")}
    }
    let promptLength=prompt.length
    let initialTimeout=1800000
    if(promptLength>10000)initialTimeout=3600000
    else if(promptLength>5000)initialTimeout=2700000
    // Inter-data timeout: how long to wait between data packets before giving up.
    // Scale with prompt length — larger prompts need more thinking time between tokens.
    const interDataTimeout=promptLength>10000?600000:promptLength>5000?450000:300000
    try{
        console.log(`[ollama] generating with ${model} (${promptLength} chars, initial timeout ${initialTimeout}ms, inter-data ${interDataTimeout}ms)`)
        // Connection timeout: abort the HTTP request if Ollama doesn't respond within
        // the initial timeout window. Once headers arrive, the per-data-packet noDataTimer
        // takes over.
        const connectionController = new AbortController()
        const connectionTimer = setTimeout(() => connectionController.abort(), initialTimeout)
        let response
        try {
            response=await axios.post(
                "http://localhost:11434/api/generate",
                {
                    model:model.replace(/[\x00-\x1F]/g,""),
                    prompt,
                    stream:true,
                    options:{
                        ...options,
                        temperature:Math.min(2,Math.max(0,options.temperature ?? 0.7)),
                        top_p:Math.min(1,Math.max(0,options.top_p ?? 0.9)),
                        num_predict:options.num_predict
                    }
                },
                {
                    // No global timeout — rely on the per-data-packet noDataTimer below.
                    // A fixed axios timeout kills the stream even when data is flowing.
                    signal: connectionController.signal,
                    responseType:"stream",
                    headers:{
                        "Content-Type":"application/json",
                        "Accept":"application/json"
                    }
                }
            )
        } finally {
            clearTimeout(connectionTimer)
        }
        let fullResponse=""
        let stream=response.data
        let noDataTimer:ReturnType<typeof setTimeout>|null=null
        let receivedAnyData=false
        let settled=false
        const clearTimer=()=>{
            if(noDataTimer){clearTimeout(noDataTimer);noDataTimer=null}
        }
        return await new Promise<{success:boolean;response?:string;error?:string}>((resolve,reject)=>{
            let buffer=""
            const safeResolve=(value:{success:boolean;response?:string;error?:string})=>{
                if(settled)return
                settled=true
                clearTimer()
                resolve(value)
            }
            const safeReject=(error:Error)=>{
                if(settled)return
                settled=true
                clearTimer()
                reject(error)
            }
            const resetNoDataTimer=()=>{
                clearTimer()
                const ms=receivedAnyData?interDataTimeout:initialTimeout
                noDataTimer=setTimeout(()=>{
                    safeReject(new Error(t("error.streamTimedOut")))
                },ms)
            }
            resetNoDataTimer()
            stream.on("data",(chunk:Buffer)=>{
                receivedAnyData=true
                resetNoDataTimer()
                buffer+=chunk.toString()
                let lines=buffer.split("\n")
                buffer=lines.pop() ?? ""
                for(let line of lines){
                    if(!line.trim())continue
                    try{
                        let parsed=JSON.parse(line)
                        if(parsed.response){
                            fullResponse+=parsed.response
                        }
                        if(parsed.done){
                            safeResolve({success:true,response:fullResponse})
                            return
                        }
                    }
                    catch{}
                }
            })
            stream.on("error",(error:Error)=>{
                safeReject(error)
            })
            stream.on("end",()=>{
                if(buffer.trim()){
                    try{
                        let parsed=JSON.parse(buffer)
                        if(parsed.response){
                            fullResponse+=parsed.response
                        }
                        if(parsed.done){
                            safeResolve({success:true,response:fullResponse})
                            return
                        }
                    }
                    catch{}
                }
                if(!fullResponse){
                    safeReject(new Error(t("error.streamEndedWithoutResponse")))
                }
                else{
                    safeResolve({success:true,response:fullResponse})
                }
            })
        }).finally(()=>{
            clearTimer()
            try{stream.destroy()}catch{}
            stream.removeAllListeners()
        })
    }
    catch(error){
        const err=error as {message?:string;response?:{data?:unknown};code?:string}
        let detail=err?.message||""
        if(err?.response?.data){
            const data=typeof err.response.data==="string"?err.response.data:JSON.stringify(err.response.data)
            if(data)detail=`${detail} ${data}`.trim()
        }
        if(err?.code)detail=`${detail} (${err.code})`.trim()
        const safeDetail=detail.slice(0,500)
        console.error("[ollama] generate failed:",safeDetail)
        return{success:false,error:`${t("error.failedToGenerateResponse")}${safeDetail?": "+safeDetail:""}`}
    }
}
const LOGS_DIR=path.join(userDataPath,"logs")
const MAX_LOG_FILES=5
const MAX_LOG_SIZE=1024*1024
function getLogFilePath(index:number):string{
    return path.join(LOGS_DIR,`app-${index}.log`)
}
async function getCurrentLogFilePathAsync():Promise<string>{
    try{
        await fsp.mkdir(LOGS_DIR,{recursive:true})
    }
    catch{
        return getLogFilePath(0)
    }
    for(let i=0;i<MAX_LOG_FILES;i++){
        let filePath=getLogFilePath(i)
        try{
            let stats=await fsp.stat(filePath)
            if(stats.size<MAX_LOG_SIZE){
                return filePath
            }
        }
        catch{
            return filePath
        }
    }
    try{
        for(let i=MAX_LOG_FILES-1;i>0;i--){
            let src=getLogFilePath(i-1)
            let dst=getLogFilePath(i)
            try{
                await fsp.access(src)
                try{
                    await fsp.unlink(dst)
                }
                catch{}
                await fsp.rename(src,dst)
            }
            catch{}
        }
        await fsp.writeFile(getLogFilePath(0),"","utf-8")
        return getLogFilePath(0)
    }
    catch{
        return getLogFilePath(0)
    }
}
function registerCriticalIpcHandlers():void{
    handle("dialog:openFile",async(_:Electron.IpcMainInvokeEvent):Promise<FileObj[]>=>{
        let result=await dialog.showOpenDialog((mainWindow??undefined) as unknown as Electron.BaseWindow,{
            properties:["openFile","multiSelections"],
            filters:[
                {name:t("dialog.fileFilter.documents"),extensions:["pdf","docx","doc","rtf","txt","md","html"]},
                {name:t("dialog.fileFilter.allFiles"),extensions:["*"]}
            ]
        })
        if(result.canceled)return[]
        let maxSize=100*1024*1024
        let rejected:string[]=[]
        let files=await Promise.all(result.filePaths.map(async filePath=>{
            try{
                if(filePath.includes("\x00"))return null
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
        result.filePaths.forEach((filePath,index)=>{
            if(files[index]){
                allowParsePath(filePath)
            }
            else{
                rejected.push(filePath)
            }
        })
        if(rejected.length>0){
            dialog.showErrorBox(t("dialog.fileRejectedTitle"),t("dialog.fileRejectedMessage")+rejected.join("\n"))
        }
        return files.filter(Boolean)as FileObj[]
    })
    handle("dialog:saveFile",async(_event,{defaultFilename}:{defaultFilename?:string}):Promise<string|null>=>{
        let result=await dialog.showSaveDialog((mainWindow??undefined) as unknown as Electron.BaseWindow,{
            defaultPath:defaultFilename||`${t("dialog.saveDefaultFilename")}.jsonl`,
            filters:[
                {name:t("dialog.saveFilter.jsonl"),extensions:["jsonl"]},
                {name:t("dialog.saveFilter.json"),extensions:["json"]},
                {name:t("dialog.saveFilter.text"),extensions:["txt"]},
                {name:t("dialog.saveFilter.allFiles"),extensions:["*"]}
            ]
        })
        if(result.canceled||!result.filePath)return null
        if(result.filePath.includes("\x00"))return null
        if(!isPathSafeForWrite(result.filePath))return null
        allowSavePath(result.filePath)
        return result.filePath
    })
    handle("secureKey:getKey",async():Promise<string|null>=>{
        return getSecureKey()
    })
    handle("secureKey:setKey",async(_event,{key}:{key:string}):Promise<boolean>=>{
        if(typeof key!=="string"||key.length===0)return false
        return setSecureKey(key)
    })
    handle("file:read",async(_event,{filePath}:{filePath:string}):Promise<{success:boolean;content?:string;error?:string}>=>{
        try{
            if(!filePath||typeof filePath!=="string"){
                return{success:false,error:t("error.invalidFilePath")}
            }
            let resolvedPath=filePath
            let normalizedPath=normalizePromptsPath(filePath)
            if(isPromptsPath(filePath)){
                let possiblePaths:string[]=[
                    filePath,
                    path.join(path.dirname(fileURLToPath(import.meta.url)),"..",filePath),
                    path.join(path.dirname(fileURLToPath(import.meta.url)),"..","dist",filePath),
                    path.join(app.getAppPath(),filePath)
                ]
                if(typeof process!=="undefined"&&process.resourcesPath){
                    possiblePaths.push(path.join(process.resourcesPath,filePath))
                }
                if(normalizedPath.startsWith("src/prompts/")){
                    let withoutSrc=normalizedPath.replace("src/prompts/","prompts/")
                    possiblePaths.push(
                        withoutSrc,
                        path.join(path.dirname(fileURLToPath(import.meta.url)),"..",withoutSrc),
                        path.join(path.dirname(fileURLToPath(import.meta.url)),"..","dist",withoutSrc),
                        path.join(app.getAppPath(),withoutSrc)
                    )
                    if(typeof process!=="undefined"&&process.resourcesPath){
                        possiblePaths.push(path.join(process.resourcesPath,withoutSrc))
                    }
                }
                for(let p of possiblePaths){
                    try{
                        if(fs.existsSync(p)){
                            resolvedPath=p
                            break
                        }
                    }
                    catch{}
                }
            }
            if(!isPathSafeForRead(resolvedPath)){
                return{success:false,error:t("error.filePathOutsideAllowed")}
            }
            let stats=await fsp.stat(resolvedPath)
            if(stats.size>MAX_READ_SIZE){
                return{success:false,error:t("error.fileTooLarge10MB")}
            }
            let content=await fsp.readFile(resolvedPath,"utf-8")
            return{success:true,content}
        }
        catch(error){
            return{success:false,error:t("error.failedToReadFile")}
        }
    })
    handle("prompt:get",async(_event,{language,processingType}:{language:string;processingType:string}):Promise<{success:boolean;content?:string;error?:string}>=>{
        try{
            if(!language||!processingType)return{success:false,error:t("error.missingLanguageOrProcessingType")}
            let fileName=`${language}_${processingType}.txt`
            let possiblePaths:string[]=[]
            let dirs=getSafeReadDirs()
            for(let dir of dirs){
                possiblePaths.push(path.join(dir,fileName))
                possiblePaths.push(path.join(dir,"prompts",fileName))
                possiblePaths.push(path.join(dir,"src","prompts",fileName))
            }
            for(let p of possiblePaths){
                try{
                    if(fs.existsSync(p)){
                        let stats=await fsp.stat(p)
                        if(stats.size>MAX_READ_SIZE){
                            return{success:false,error:t("error.promptFileTooLarge")}
                        }
                        let content=await fsp.readFile(p,"utf-8")
                        return{success:true,content}
                    }
                }
                catch{}
            }
            return{success:false,error:t("error.promptFileNotFound")}
        }
        catch(error){
            return{success:false,error:t("error.failedToLoadPrompt")}
        }
    })
    handle("file:save",async(_event,{filePath,content}:{filePath:string;content:string}):Promise<{success:boolean;error?:string}>=>{
        try{
            if(!filePath||typeof filePath!=="string"||content==null||typeof content!=="string"){
                return{success:false,error:t("error.invalidFilePathOrContent")}
            }
            if(content.length>100*1024*1024){
                return{success:false,error:t("error.contentTooLarge100MB")}
            }
            if(!isPathSafeForWrite(filePath)&&!isAllowedSavePath(filePath)){
                return{success:false,error:t("error.filePathOutsideWriteDirs")}
            }
            await fsp.writeFile(filePath,content,"utf-8")
            return{success:true}
        }
        catch(error){
            return{success:false,error:t("error.failedToSaveFile")}
        }
    })
    handle("file:parse",async(_event,{filePath,fileType}:{filePath:string;fileType:string}):Promise<{success:boolean;content?:string;error?:string}>=>{
        try{
            if(!filePath||typeof filePath!=="string"||!fileType||typeof fileType!=="string"){
                return{success:false,error:t("error.invalidFilePathOrType")}
            }
            if(!isPathSafeForParse(filePath)){
                return{success:false,error:t("error.invalidOrUnsafeFilePath")}
            }
            if(!fileParser){
                fileParser=new FileParserLazy()
            }
            let text=await fileParser.parseFile(filePath,fileType)
            return{success:true,content:text}
        }
        catch(error){
            return{success:false,error:t("error.failedToParseFile")}
        }
    })
    handle("file:parseBuffer",async(_event,{buffer,fileType}:{buffer:ArrayBuffer;fileType:string}):Promise<{success:boolean;content?:string;error?:string}>=>{
        try{
            if(!buffer||!fileType||typeof fileType!=="string"){
                return{success:false,error:t("error.invalidFilePathOrType")}
            }
            let nodeBuffer:Buffer
            if(Buffer.isBuffer(buffer)){
                nodeBuffer=buffer
            }
            else if(ArrayBuffer.isView(buffer)){
                nodeBuffer=Buffer.from(buffer.buffer,buffer.byteOffset,buffer.byteLength)
            }
            else if(buffer instanceof ArrayBuffer){
                nodeBuffer=Buffer.from(buffer)
            }
            else{
                return{success:false,error:t("error.invalidFilePathOrType")}
            }
            if(!fileParser){
                fileParser=new FileParserLazy()
            }
            let text=await fileParser.parseFileBuffer(nodeBuffer,fileType)
            return{success:true,content:text}
        }
        catch(error){
            return{success:false,error:t("error.failedToParseFile")}
        }
    })
    handle("file:parseBatch",async(_event,{files}:{files:FileObj[]}):Promise<{success:boolean;results?:ParseBatchItem[];error?:string}>=>{
        try{
            if(!files||!Array.isArray(files)||files.length===0){
                return{success:false,error:t("error.invalidFilesArray")}
            }
            if(files.length>50){
                return{success:false,error:t("error.tooManyFiles50")}
            }
            for(let f of files){
                if(!f||!f.path||typeof f.path!=="string"){
                    return{success:false,error:t("error.invalidFileEntry")}
                }
                if(!isPathSafeForParse(f.path)){
                    return{success:false,error:t("error.invalidOrUnsafeFilePathInBatch")}
                }
            }
            if(!fileParser){
                fileParser=new FileParserLazy()
            }
            let results=await fileParser.processFiles(files.map(f=>f.path))
            return{success:true,results}
        }
        catch(error){
            return{success:false,error:t("error.failedToParseFiles")}
        }
    })
    handle("ollama:check",async(_:Electron.IpcMainInvokeEvent):Promise<OllamaStatus>=>{
        try{
            let tagsResponse=await axios.get("http://localhost:11434/api/tags",{timeout:5000})
            let models:OllamaModel[]=(tagsResponse.data.models||[]).map((m:any)=>({
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
            return{running:false,models:[],error:t("error.failedToConnectToOllama")}
        }
    })
    handle("ollama:generate",async(_event,payload:{model?:string;prompt?:string;options?:OllamaGenerateOptions}):Promise<{success:boolean;response?:string;error?:string}>=>{
        let{model,prompt,options}=payload
        options=options??{}
        if(options.num_predict==null){
            options.num_predict=4096
        }
        else{
            options.num_predict=Math.min(8192,Math.max(256,options.num_predict))
        }
        if(!model||typeof model!=="string"||!prompt||typeof prompt!=="string"){
            return{success:false,error:t("error.invalidModelNameOrPrompt")}
        }
        if(prompt.length>500000){
            return{success:false,error:t("error.promptTooLarge")}
        }
        try{
            await axios.get("http://localhost:11434/api/show",{
                params:{name:model},
                timeout:10000
            }).catch(()=>{})
        }
        catch{}
        let promptLength=prompt.length
        let timeout=1800000
        if(promptLength>10000)timeout=3600000
        else if(promptLength>5000)timeout=2700000
        let maxRetries=2
        for(let attempt=0;attempt<=maxRetries;attempt++){
            try{
                let response=await axios.post(
                    "http://localhost:11434/api/generate",
                    {
                        model:model.replace(/[\x00-\x1F]/g,""),
                        prompt,
                        stream:false,
                        options:{
                            ...options,
                            temperature:Math.min(2,Math.max(0,options.temperature ?? 0.7)),
                            top_p:Math.min(1,Math.max(0,options.top_p ?? 0.9)),
                            num_predict:options.num_predict ?? 4096
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
                    return{success:false,error:t("error.invalidResponseFromOllama")}
                }
                return{success:true,response:response.data.response}
            }
            catch(error){
                const errCode=(error as {code?:string}).code
                const errMsg=error instanceof Error?error.message:""
                if(errCode==="ECONNABORTED"||errMsg.includes("timeout")){
                    if(attempt<maxRetries){
                        await new Promise(r=>setTimeout(r,5000))
                    }
                }
                else{
                    break
                }
            }
        }
        return{success:false,error:t("error.failedToGenerateResponse")}
    })
    handle("ollama:generateStream",async(_event,payload:{model?:string;prompt?:string;options?:OllamaGenerateOptions})=>handleOllamaGenerateStream(payload))
    handle("openai:generate",async(_event,payload:{
        apiKey?:string
        baseUrl?:string
        model?:string
        prompt?:string
        options?:{temperature?:number;top_p?:number;max_tokens?:number}
    }):Promise<{success:boolean;response?:string;usage?:{total_tokens:number};error?:string}>=>{
        let{apiKey,baseUrl,model,prompt,options}=payload
        options=options??{}
        if(!apiKey||!baseUrl||!model||!prompt){
            return{success:false,error:t("error.missingRequiredParameters")}
        }
        if(!isValidOpenAIBaseUrl(baseUrl)){
            return{success:false,error:t("error.invalidOrUnsafeOpenAIBaseUrl")}
        }
        try{
            let cleanBaseUrl=baseUrl.replace(/\/+$/,"")
            let response=await axios.post(
                `${cleanBaseUrl}/v1/chat/completions`,
                {
                    model,
                    messages:[
                        {role:"system",content:t("prompt.systemAssistant")},
                        {role:"user",content:prompt}
                    ],
                    temperature:options.temperature??0.7,
                    top_p:options.top_p??0.9,
                    max_tokens:options.max_tokens??4096
                },
                {
                    headers:{
                        "Content-Type":"application/json",
                        "Authorization":`Bearer ${apiKey}`
                    },
                    timeout:300000,
                    httpAgent,
                    httpsAgent
                }
            )
            let rc=response.data.choices?.[0]?.message?.content||""
            return{
                success:true,
                response:rc,
                usage:response.data.usage
            }
        }
        catch(error:any){
            if(error.response){
                return{success:false,error:t("error.apiError",undefined,{status:String(error.response.status),data:JSON.stringify(error.response.data)})}
            }
            return{success:false,error:error.message||t("error.failedToCallOpenAI")}
        }
    })
    handle("anthropic:generate",async(_event,payload:{
        apiKey?:string
        model?:string
        prompt?:string
        options?:{temperature?:number;top_p?:number;max_tokens?:number}
    }):Promise<{success:boolean;response?:string;usage?:{total_tokens:number};error?:string}>=>{
        let{apiKey,model,prompt,options}=payload
        options=options??{}
        if(!apiKey||!model||!prompt){
            return{success:false,error:t("error.missingRequiredParameters")}
        }
        try{
            let response=await axios.post(
                "https://api.anthropic.com/v1/messages",
                {
                    model,
                    max_tokens:options.max_tokens??4096,
                    messages:[{role:"user",content:prompt}],
                    temperature:options.temperature??0.7,
                    top_p:options.top_p??0.9
                },
                {
                    headers:{
                        "Content-Type":"application/json",
                        "x-api-key":apiKey,
                        "anthropic-version":"2023-06-01"
                    },
                    timeout:300000,
                    httpAgent,
                    httpsAgent
                }
            )
            let rc=response.data.content?.[0]?.text||""
            return{
                success:true,
                response:rc,
                usage:response.data.usage
            }
        }
        catch(error:any){
            if(error.response){
                return{success:false,error:t("error.apiError",undefined,{status:String(error.response.status),data:JSON.stringify(error.response.data)})}
            }
            return{success:false,error:error.message||t("error.failedToCallAnthropic")}
        }
    })
    handle("gemini:generate",async(_event,payload:{
        apiKey?:string
        model?:string
        prompt?:string
        options?:{temperature?:number;top_p?:number;max_tokens?:number}
    }):Promise<{success:boolean;response?:string;usage?:{total_tokens:number};error?:string}>=>{
        let{apiKey,model,prompt,options}=payload
        options=options??{}
        if(!apiKey||!model||!prompt){
            return{success:false,error:t("error.missingRequiredParameters")}
        }
        try{
            let response=await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                {
                    contents:[{parts:[{text:prompt}]}],
                    generationConfig:{
                        temperature:options.temperature??0.7,
                        topP:options.top_p??0.9,
                        maxOutputTokens:options.max_tokens??4096
                    }
                },
                {
                    headers:{"Content-Type":"application/json"},
                    timeout:300000,
                    httpAgent,
                    httpsAgent
                }
            )
            let rc=response.data.candidates?.[0]?.content?.parts?.[0]?.text||""
            return{
                success:true,
                response:rc,
                usage:{total_tokens:response.data.usageMetadata?.totalTokenCount??Math.ceil(rc.length/4)}
            }
        }
        catch(error:any){
            if(error.response){
                return{success:false,error:t("error.apiError",undefined,{status:String(error.response.status),data:JSON.stringify(error.response.data)})}
            }
            return{success:false,error:error.message||t("error.failedToCallGemini")}
        }
    })
    handle("app:getVersion",(_:Electron.IpcMainInvokeEvent):string=>app.getVersion())
    handle("app:getPlatform",(_:Electron.IpcMainInvokeEvent):string=>process.platform)
    handle("docs:openUserGuide",async(_:Electron.IpcMainInvokeEvent):Promise<{success:boolean;error?:string}>=>{
        try{
            let candidates=[
                path.join(app.getAppPath(),"docs","user-guide.md"),
                path.join(path.dirname(app.getPath("exe")),"docs","user-guide.md"),
                path.join(path.dirname(fileURLToPath(import.meta.url)),"..","..","docs","user-guide.md")
            ]
            if(typeof process!=="undefined"&&process.resourcesPath){
                candidates.splice(1,0,path.join(process.resourcesPath,"docs","user-guide.md"))
            }
            let guidePath:string|null=null
            for(let p of candidates){
                if(fs.existsSync(p)){
                    guidePath=p
                    break
                }
            }
            if(!guidePath){
                return{success:false,error:t("error.userGuideNotFound")}
            }
            let error=await shell.openPath(guidePath)
            if(error){
                return{success:false,error}
            }
            return{success:true}
        }
        catch(error){
            return{success:false,error:(error as Error).message}
        }
    })
}
function isValidPersistedData(data:unknown):data is Record<string,unknown>{
    return data!==null&&typeof data==="object"
}
function isDataSizeValid(data:unknown):boolean{
    try{
        return Buffer.byteLength(JSON.stringify(data),"utf-8")<=100*1024*1024
    }
    catch{
        return false
    }
}
function registerDeferredIpcHandlers():void{
    if(deferredIpcRegistered)return
    deferredIpcRegistered=true
    handle("cache:load",async():Promise<{success:boolean;data?:Record<string,any>}>=>{
        try{
            let cachePath=path.join(app.getPath("userData"),"training-cache.json")
            if(fs.existsSync(cachePath)){
                let data=JSON.parse(fs.readFileSync(cachePath,"utf-8"))
                return{success:true,data}
            }
            return{success:true,data:{}}
        }
        catch{
            return{success:true,data:{}}
        }
    })
    handle("cache:save",async(_event,{data}:{data:Record<string,any>}):Promise<{success:boolean}>=>{
        if(!isValidPersistedData(data)||!isDataSizeValid(data)){
            return{success:false}
        }
        try{
            let cachePath=path.join(app.getPath("userData"),"training-cache.json")
            fs.writeFileSync(cachePath,JSON.stringify(data))
            return{success:true}
        }
        catch{
            return{success:false}
        }
    })
    handle("cache:clear",async():Promise<{success:boolean}>=>{
        try{
            let cachePath=path.join(app.getPath("userData"),"training-cache.json")
            if(fs.existsSync(cachePath))fs.unlinkSync(cachePath)
            return{success:true}
        }
        catch{
            return{success:false}
        }
    })
    handle("cache:compact",async():Promise<{success:boolean}>=>{
        try{
            await smartCache.compact()
            return{success:true}
        }
        catch{
            return{success:false}
        }
    })
    handle("progress:save",async(_event,{data}:{data:any}):Promise<{success:boolean}>=>{
        if(!isValidPersistedData(data)||!isDataSizeValid(data)){
            return{success:false}
        }
        try{
            let progressPath=path.join(app.getPath("userData"),"training-progress.json")
            fs.writeFileSync(progressPath,JSON.stringify(data))
            return{success:true}
        }
        catch{
            return{success:false}
        }
    })
    handle("progress:load",async():Promise<{success:boolean;data?:any}>=>{
        try{
            let progressPath=path.join(app.getPath("userData"),"training-progress.json")
            if(fs.existsSync(progressPath)){
                let data=JSON.parse(fs.readFileSync(progressPath,"utf-8"))
                return{success:true,data}
            }
            return{success:true,data:null}
        }
        catch{
            return{success:true,data:null}
        }
    })
    handle("progress:clear",async():Promise<{success:boolean}>=>{
        try{
            let progressPath=path.join(app.getPath("userData"),"training-progress.json")
            if(fs.existsSync(progressPath))fs.unlinkSync(progressPath)
            return{success:true}
        }
        catch{
            return{success:false}
        }
    })
    handle("save-checkpoint",async(_event,{data}:{data:any}):Promise<{success:boolean}>=>{
        if(!isValidPersistedData(data)||!isDataSizeValid(data)){
            return{success:false}
        }
        try{
            let checkpointPath=path.join(userDataPath,"training-checkpoint.json")
            fs.writeFileSync(checkpointPath,JSON.stringify(data))
            return{success:true}
        }
        catch{
            return{success:false}
        }
    })
    handle("load-checkpoint",async():Promise<{success:boolean;data?:any}>=>{
        try{
            let checkpointPath=path.join(userDataPath,"training-checkpoint.json")
            if(fs.existsSync(checkpointPath)){
                let data=JSON.parse(fs.readFileSync(checkpointPath,"utf-8"))
                return{success:true,data}
            }
            return{success:true,data:null}
        }
        catch{
            return{success:true,data:null}
        }
    })
    handle("clear-checkpoint",async():Promise<{success:boolean}>=>{
        try{
            let checkpointPath=path.join(userDataPath,"training-checkpoint.json")
            if(fs.existsSync(checkpointPath))fs.unlinkSync(checkpointPath)
            return{success:true}
        }
        catch{
            return{success:false}
        }
    })
    handle("write-log",async(_event,{entry}:{entry:unknown}):Promise<void>=>{
        if(!entry||typeof entry!=="object"){
            return
        }
        let logLine=JSON.stringify(entry)+"\n"
        writeLogQueue=writeLogQueue.then(async()=>{
            let filePath=await getCurrentLogFilePathAsync()
            await fsp.appendFile(filePath,logLine,"utf-8")
        }).catch(()=>{})
        await writeLogQueue
    })
    handle("export-logs",async(_event,{data}:{data:string}):Promise<{success:boolean;error?:string}>=>{
        try{
            if(!data||typeof data!=="string"){
                return{success:false,error:t("error.invalidLogData")}
            }
            let result=await dialog.showSaveDialog((mainWindow??undefined) as unknown as Electron.BaseWindow,{
                defaultPath:t("dialog.exportLogs.defaultFilename"),
                filters:[
                    {name:t("dialog.exportLogs.jsonl"),extensions:["jsonl"]},
                    {name:t("dialog.exportLogs.allFiles"),extensions:["*"]}
                ]
            })
            if(result.canceled||!result.filePath){
                return{success:false,error:t("error.exportCancelled")}
            }
            await fsp.writeFile(result.filePath,data,"utf-8")
            return{success:true}
        }
        catch(error){
            return{success:false,error:t("error.failedToExportLogs")}
        }
    })
}
app.whenReady().then(()=>{
    registerAppProtocolHandler()
    registerCriticalIpcHandlers()
    createMainWindow()
    registerWindowControlHandlers(()=>mainWindow)
    createTray()
    registerDeferredIpcHandlers()
    setTimeout(()=>registerDeferredIpcHandlers(),5000)
}).catch((error)=>{
    console.error("Failed to ready app:",error)
    app.quit()
})
app.on("window-all-closed",()=>{
    if(!isMac)app.quit()
})
app.on("before-quit",async(event)=>{
    if(isAppQuitting)return
    event.preventDefault()
    isAppQuitting=true
    if(fileParser){
        try{await fileParser.dispose()}catch{}
        fileParser=null
    }
    if(tray&&!tray.isDestroyed()){
        tray.destroy()
        tray=null
    }
    try{httpAgent.destroy()}catch{}
    try{httpsAgent.destroy()}catch{}
    app.exit()
})
app.on("activate",()=>{
    if(!mainWindow){
        createMainWindow()
    }
})
process.on("uncaughtException",(error:Error)=>{
    console.error("Uncaught Exception:",error)
    if(typeof app?.quit==="function"&&!isAppQuitting){
        app.quit()
    }
})
process.on("unhandledRejection",(reason:unknown,promise:Promise<unknown>)=>{
    console.error("Unhandled Rejection at:",promise,"reason:",reason)
    if(typeof app?.quit==="function"&&!isAppQuitting){
        app.quit()
    }
})
