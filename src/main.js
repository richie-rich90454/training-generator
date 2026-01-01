let {app, BrowserWindow, ipcMain, dialog}=require("electron")
let path=require("path")
let fs=require("fs").promises
let {spawn}=require("child_process")
let axios=require("axios")
let FileParser=require("./core/fileParser")
let mainWindow=null
let isWindows=process.platform=="win32"
let isMac=process.platform=="darwin"
function setupLogging(){
    if (process.env.NODE_ENV=="development") return;
    try{
        let logPath=path.join(app.getPath("userData"), "logs");
        let logFile=path.join(logPath, `app-${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
        let fsSync=require("fs");
        if (!fsSync.existsSync(logPath)){
            fsSync.mkdirSync(logPath,{ recursive: true });
        }
        let logStream=fsSync.createWriteStream(logFile,{ flags: "a" });
        let originalLog=console.log;
        let originalError=console.error;
        let originalWarn=console.warn;
        console.log=function(...args){
            let message=`[LOG ${new Date().toISOString()}] ${args.join(" ")}\n`;
            logStream.write(message);
            originalLog.apply(console, args);
        };
        console.error=function(...args){
            let message=`[ERROR ${new Date().toISOString()}] ${args.join(" ")}\n`;
            logStream.write(message);
            originalError.apply(console, args);
        };
        console.warn=function(...args){
            let message=`[WARN ${new Date().toISOString()}] ${args.join(" ")}\n`;
            logStream.write(message);
            originalWarn.apply(console, args);
        };
        console.info=console.log;
        process.on("exit", ()=>{
            logStream.end();
        });
        console.log(`Logging to: ${logFile}`);
    }
    catch (error){

    }
}
setupLogging();
app.commandLine.appendSwitch("enable-gpu-rasterization")
app.commandLine.appendSwitch("enable-zero-copy")
app.commandLine.appendSwitch("ignore-gpu-blacklist")
app.commandLine.appendSwitch("enable-native-gpu-memory-buffers")
app.commandLine.appendSwitch("enable-accelerated-2d-canvas")
async function createWindow(){
    console.log("Creating main window...")
    let iconPath=path.join(__dirname, "../assets/favicon.png")
    let iconConfig={}
    try{
        await fs.access(iconPath)
        iconConfig={icon: iconPath}
        console.log("Using custom icon:", iconPath)
    }
    catch (error){
        console.log("Icon file not found, using default Electron icon")
    }
    mainWindow=new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        show: false,
        frame: true,
        transparent: isMac,
        backgroundColor: isMac?"#000":"#FFF",
        titleBarStyle: "default",
        trafficLightPosition: isMac?{x: 14, y: 14}:undefined,
        visualEffectState: "active",
        vibrancy: isMac?"sidebar":undefined,
        webPreferences:{
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
            webgl: true,
            enableRemoteModule: false,
            spellcheck: false,
            disableHtmlFullscreenWindowResize: true,
            sandbox: false
        },
        ...iconConfig,
    })
    console.log("Window created with platform:", process.platform)
    mainWindow.setMenu(null)
    mainWindow.webContents.on("did-finish-load", ()=>{
        mainWindow.webContents.setZoomFactor(1)
        mainWindow.webContents.setVisualZoomLevelLimits(1, 1)
    })
    if (process.env.NODE_ENV=="development"){
        mainWindow.loadURL("http://localhost:5173")
        mainWindow.webContents.openDevTools({ mode: "detach" })
    }
    else{
        let indexPath=path.join(__dirname, "../dist/index.html")
        console.log("Loading production index.html from:", indexPath)
        mainWindow.loadFile(indexPath).catch(error=>{
            console.error("Failed to load index.html:", error)
            let altPath=path.join(process.resourcesPath, "app.asar.unpacked", "dist", "index.html")
            console.log("Trying alternative path:", altPath)
            mainWindow.loadFile(altPath).catch(error2=>{
                console.error("Failed to load from alternative path:", error2)
                mainWindow.loadURL(`data:text/html,<h1>Failed to load application</h1><p>${error.message}</p>`)
            })
        })
    }
    mainWindow.once("ready-to-show", ()=>{
        console.log("Window is ready to show")
        mainWindow.show()
    })
    mainWindow.on("closed", ()=>{
        mainWindow=null
    })
}
app.whenReady().then(()=>{
    createWindow().catch(error=>{
        console.error("Failed to create window:", error)
        app.quit()
    })
})
app.on("window-all-closed", ()=>{
    if (!isMac) app.quit()
})
app.on("activate", ()=>{
    if (mainWindow==null){
        createWindow().catch(error=>{
            console.error("Failed to create window on activate:", error)
        })
    }
})
process.on("uncaughtException", (error)=>{
    console.error("Uncaught Exception:", error)
})
process.on("unhandledRejection", (reason, promise)=>{
    console.error("Unhandled Rejection at:", promise, "reason:", reason)
})
let fileParser=new FileParser()
ipcMain.handle("dialog:openFile", async ()=>{
    let result=await dialog.showOpenDialog(mainWindow,{
        properties: ["openFile", "multiSelections"],
        filters: [
          {name: "Documents", extensions: ["pdf", "docx", "doc", "rtf", "txt", "md", "html"]},
          {name: "All Files", extensions: ["*"]}
        ]
    })
    if (result.canceled) return []
    let files=await Promise.all(result.filePaths.map(async filePath=>{
        try{
            let stats=await fs.stat(filePath)
            return{
                path: filePath,
                name: path.basename(filePath),
                size: stats.size,
                type: path.extname(filePath).slice(1),
                lastModified: stats.mtime
            }
        }
        catch{
            return null
        }
    }))
    return files.filter(Boolean)
})
ipcMain.handle("file:parse", async (event, filePath, fileType)=>{
    try{
        let text=await fileParser.parseFile(filePath, fileType)
        return{success: true, content: text}
    }
    catch (error){
        return{success: false, error: error.message}
    }
})
ipcMain.handle("file:parseBatch", async (event, files)=>{
    try{
        let results=await fileParser.processFiles(files.map(f=>f.path))
        return{success: true, results}
    }
    catch (error){
        return{success: false, error: error.message}
    }
})
ipcMain.handle("file:read", async (event, filePath)=>{
    try{
        let content=await fs.readFile(filePath, "utf-8")
        return{success: true, content}
    }
    catch (error){
        return{success: false, error: error.message}
    }
})
ipcMain.handle("file:save", async (event, filePath, content)=>{
    try{
        await fs.writeFile(filePath, content, "utf-8")
        return{success: true}
    }
    catch (error){
        return{success: false, error: error.message}
    }
})
ipcMain.handle("dialog:saveFile", async (event, defaultFilename)=>{
    let result=await dialog.showSaveDialog(mainWindow,{
        defaultPath: defaultFilename||"training_data.jsonl",
        filters: [
          {name: "JSON Lines", extensions: ["jsonl"]},
          {name: "JSON", extensions: ["json"]},
          {name: "Text", extensions: ["txt"]},
          {name: "All Files", extensions: ["*"]}
        ]
    })
    if (result.canceled) return null
    return result.filePath
})
ipcMain.handle("ollama:check", async ()=>{
    try{
        let tagsResponse=await axios.get("http://localhost:11434/api/tags",{timeout: 5000})
        let version="unknown"
        try{
            let versionResponse=await axios.get("http://localhost:11434/api/version",{timeout: 3000})
            version=versionResponse.data.version||"unknown"
        }
        catch (versionError){
            console.warn("Could not get Ollama version:", versionError.message)
            if (tagsResponse.data&&tagsResponse.data.version){
                version=tagsResponse.data.version
            }
        }
        return{
            running: true,
            models: tagsResponse.data.models||[],
            version: version
        }
    }
    catch (error){
        return{running: false, error: error.message}
    }
})
ipcMain.handle("ollama:generate", async (event, payload)=>{
    let{model, prompt, options={}}=payload
    try{
        await axios.get(`http://localhost:11434/api/show`,{
            params:{ name: model },
            timeout: 10000
        }).catch(()=>{
            console.log(`Model ${model} might need to be loaded`)
        })
    }
    catch (error){
        console.log(`Model check for ${model} failed:`, error.message)
    }
    let promptLength=prompt.length
    let timeout=300000
    if (promptLength>10000){
        timeout=600000
    }
    else if (promptLength>5000){
        timeout=450000
    }
    let maxRetries=2
    let lastError=null
    for (let attempt=0; attempt<=maxRetries; attempt++){
        try{
            let response=await axios.post(
                "http://localhost:11434/api/generate",
                {
                    model,
                    prompt,
                    stream: false,
                    options:{
                        temperature: options.temperature??.7,
                        top_p: options.top_p??.9,
                        ...options
                    }
                },
                { 
                    timeout: timeout,
                    headers:{
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    }
                }
            )
            if (!response.data?.response){
                throw new Error("Invalid response from Ollama")
            }
            return{success: true, response: response.data.response}
            
        }
        catch (error){
            lastError=error
            if (error.code=="ECONNABORTED"||error.message.includes("timeout")){
                console.log(`Generation attempt ${attempt+1}/${maxRetries+1} timed out after ${timeout}ms`)
                if (attempt<maxRetries){
                    await new Promise(resolve=>setTimeout(resolve, 5000))
                    console.log(`Retrying generation (attempt ${attempt+2})...`)
                }
            }
            else{
                console.error("Generation failed with non-timeout error:", error.message)
                break
            }
        }
    }
    throw new Error(`Failed to generate after ${maxRetries+1} attempts: ${lastError?.message||"Unknown error"}`)
})
ipcMain.handle("app:getVersion", ()=>app.getVersion())
ipcMain.handle("app:getPlatform", ()=>process.platform)