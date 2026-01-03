let {app,BrowserWindow,ipcMain,dialog}=require("electron")
let path=require("path")
let fs=require("fs")
let fsp=require("fs").promises
let {spawn}=require("child_process")
let axios=require("axios")
let FileParser=require("./core/fileParser")
let isWin=process.platform=="win32"
let isMac=process.platform=="darwin"
let mainWindow=null
let splashWindow=null
let splashProcess=null
let fileParser=new FileParser()

// Set up paths and ensure directories exist
let userDataPath=path.join(app.getPath("documents"),"TrainingGenerator")
let cachePath=path.join(userDataPath,"Cache")

// Ensure directories exist
try{
    if(!fs.existsSync(userDataPath)){
        fs.mkdirSync(userDataPath,{recursive:true})
    }
    if(!fs.existsSync(cachePath)){
        fs.mkdirSync(cachePath,{recursive:true})
    }
}catch(error){
    console.error("Failed to create directories:",error)
    // Fallback to default paths
    userDataPath=app.getPath("userData")
    cachePath=app.getPath("cache")
}

app.setPath("userData",userDataPath)
app.setPath("cache",cachePath)

// Add cache-related command line switches to prevent cache errors
app.commandLine.appendSwitch("disable-features","VizDisplayCompositor")
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache")
app.commandLine.appendSwitch("disable-software-rasterizer")
app.commandLine.appendSwitch("disable-gpu")
app.commandLine.appendSwitch("disable-accelerated-2d-canvas")
app.commandLine.appendSwitch("disable-accelerated-video-decode")
app.commandLine.appendSwitch("no-first-run")
app.commandLine.appendSwitch("disable-background-networking")
app.commandLine.appendSwitch("disable-component-update")
app.commandLine.appendSwitch("disable-sync")
app.commandLine.appendSwitch("disable-default-apps")
app.commandLine.appendSwitch("metrics-recording-only")
app.commandLine.appendSwitch("enable-gpu-rasterization")
app.commandLine.appendSwitch("enable-oop-rasterization")
app.commandLine.appendSwitch("enable-zero-copy")
if(isWin){
    app.commandLine.appendSwitch("disable-hang-monitor")
    app.commandLine.appendSwitch("disable-prompt-on-repost")
    // Windows-specific cache fixes
    app.commandLine.appendSwitch("disable-direct-composition")
    app.commandLine.appendSwitch("disable-gpu-vsync")
    // Use in-memory cache to avoid disk permission issues
    app.commandLine.appendSwitch("disk-cache-dir","")
    app.commandLine.appendSwitch("disable-disk-cache")
}
function startSplash(){
    if(isWin){
        let exePaths=[
            path.join(process.resourcesPath,"native-splash","splash.exe"),
            path.join(__dirname,"..","native-splash","splash.exe"),
            path.join(__dirname,"..","..","native-splash","splash.exe"),
        ]
        let exePath=null
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
    splashWindow.loadFile(path.join(__dirname,"splash.html")).then(()=>{
        splashWindow.center()
        splashWindow.show()
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
            preload:path.join(__dirname,"preload.js"),
            nodeIntegration:false,
            contextIsolation:true,
            enableRemoteModule:false,
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
        mainWindow.loadFile(path.join(__dirname,"../dist/index.html"))
    }
    mainWindow.webContents.once("dom-ready",()=>{
        stopSplash()
        mainWindow.show()
        mainWindow.focus()
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
ipcMain.handle("dialog:openFile",async()=>{
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
            }
        }
        catch{
            return null
        }
    }))
    return files.filter(Boolean)
})
ipcMain.handle("dialog:saveFile",async(_,defaultFilename)=>{
    let result=await dialog.showSaveDialog(mainWindow,{
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
ipcMain.handle("file:read",async(_,filePath)=>{
    try{
        // Handle prompt files specially - they might be in different locations
        // depending on development vs production
        let resolvedPath=filePath;
        
        // Check if it's a prompt file path
        if(filePath.includes("prompts/")){
            // Try multiple possible locations
            let possiblePaths=[
                filePath, // Original path
                path.join(process.resourcesPath,filePath), // In resources (production)
                path.join(__dirname,"..",filePath), // Relative to main.js (development)
                path.join(__dirname,"..","dist",filePath), // In dist (production build)
                path.join(app.getAppPath(),filePath), // In app directory
            ];
            
            // Also try with "src/" prefix removed
            if(filePath.startsWith("src/prompts/")){
                let withoutSrc=filePath.replace("src/prompts/","prompts/");
                possiblePaths.push(
                    withoutSrc,
                    path.join(process.resourcesPath,withoutSrc),
                    path.join(__dirname,"..",withoutSrc),
                    path.join(__dirname,"..","dist",withoutSrc),
                    path.join(app.getAppPath(),withoutSrc)
                );
            }
            
            // Try each path
            for(let p of possiblePaths){
                try{
                    if(fs.existsSync(p)){
                        resolvedPath=p;
                        break;
                    }
                }catch{}
            }
        }
        
        let content=await fsp.readFile(resolvedPath,"utf-8")
        return{success:true,content}
    }
    catch(error){
        return{success:false,error:error.message}
    }
})
ipcMain.handle("file:save",async(_,filePath,content)=>{
    try{
        await fsp.writeFile(filePath,content,"utf-8")
        return{success:true}
    }
    catch(error){
        return{success:false,error:error.message}
    }
})
ipcMain.handle("file:parse",async(_,filePath,fileType)=>{
    try{
        let text=await fileParser.parseFile(filePath,fileType)
        return{success:true,content:text}
    }
    catch(error){
        return{success:false,error:error.message}
    }
})
ipcMain.handle("file:parseBatch",async(_,files)=>{
    try{
        let results=await fileParser.processFiles(files.map(f=>f.path))
        return{success:true,results}
    }
    catch(error){
        return{success:false,error:error.message}
    }
})
ipcMain.handle("ollama:check",async()=>{
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
        return{running:false,error:error.message}
    }
})
ipcMain.handle("ollama:generate",async(_,payload)=>{
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
    let lastError=null
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
            lastError=error
            if(error.code=="ECONNABORTED"||error.message.includes("timeout")){
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
ipcMain.handle("app:getVersion",()=>app.getVersion())
ipcMain.handle("app:getPlatform",()=>process.platform)
process.on("uncaughtException",error=>{
    console.error("Uncaught Exception:",error)
})
process.on("unhandledRejection",(reason,promise)=>{
    console.error("Unhandled Rejection at:",promise,"reason:",reason)
})
