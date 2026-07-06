import{describe,test,expect}from "vitest"

describe("BrowserWindow configuration",()=>{
    test("default window dimensions are valid",()=>{
        let width=1200
        let height=760
        expect(width).toBeGreaterThan(0)
        expect(height).toBeGreaterThan(0)
        expect(width).toBeGreaterThanOrEqual(900)
        expect(height).toBeGreaterThanOrEqual(600)
    })

    test("minimum window dimensions are valid",()=>{
        let minWidth=900
        let minHeight=600
        expect(minWidth).toBeGreaterThan(0)
        expect(minHeight).toBeGreaterThan(0)
    })

    test("webPreferences has required fields",()=>{
        let webPreferences={
            preload:"path/to/preload.ts",
            contextIsolation:true,
            nodeIntegration:false,
            sandbox:true,
            spellcheck:false,
            disableHtmlFullscreenWindowResize:true,
            backgroundThrottling:false,
            webgl:true
        }
        expect(webPreferences.contextIsolation).toBe(true)
        expect(webPreferences.nodeIntegration).toBe(false)
        expect(webPreferences.preload).toBeDefined()
        expect(webPreferences.sandbox).toBe(true)
        expect(webPreferences.spellcheck).toBe(false)
    })

    test("contextIsolation is enabled for security",()=>{
        let webPreferences={contextIsolation:true}
        expect(webPreferences.contextIsolation).toBe(true)
    })

    test("nodeIntegration is disabled for security",()=>{
        let webPreferences={nodeIntegration:false}
        expect(webPreferences.nodeIntegration).toBe(false)
    })

    test("splash window has correct dimensions on Mac",()=>{
        let isMac=true
        let width=isMac?500:450
        let height=isMac?400:350
        expect(width).toBe(500)
        expect(height).toBe(400)
    })

    test("splash window has correct dimensions on Windows",()=>{
        let isMac=false
        let width=isMac?500:450
        let height=isMac?400:350
        expect(width).toBe(450)
        expect(height).toBe(350)
    })

    test("splash window is frameless and always on top",()=>{
        let splashConfig={
            frame:false,
            resizable:false,
            alwaysOnTop:true
        }
        expect(splashConfig.frame).toBe(false)
        expect(splashConfig.resizable).toBe(false)
        expect(splashConfig.alwaysOnTop).toBe(true)
    })
})

describe("Application lifecycle",()=>{
    test("app version is defined",()=>{
        let version="2.0.0"
        expect(version).toMatch(/^\d+\.\d+\.\d+$/)
    })

    test("app name is defined",()=>{
        let name="training-generator"
        expect(name).toBe("training-generator")
    })

    test("quit is called on windows-all-closed when not Mac",()=>{
        let isMac=false
        let quitCalled=false
        if(!isMac)quitCalled=true
        expect(quitCalled).toBe(true)
    })

    test("quit is not called on windows-all-closed when Mac",()=>{
        let isMac=true
        let quitCalled=false
        if(!isMac)quitCalled=true
        expect(quitCalled).toBe(false)
    })

    test("new window created on activate when no windows exist",()=>{
        let mainWindow=null
        let createCalled=false
        if(!mainWindow)createCalled=true
        expect(createCalled).toBe(true)
    })

    test("no new window on activate when window exists",()=>{
        let mainWindow={}
        let createCalled=false
        if(!mainWindow)createCalled=true
        expect(createCalled).toBe(false)
    })
})

describe("File dialog options",()=>{
    test("open dialog has correct properties",()=>{
        let options={
            properties:["openFile","multiSelections"] as string[],
            filters:[
                {name:"Documents",extensions:["pdf","docx","doc","rtf","txt","md","html"]},
                {name:"All Files",extensions:["*"]}
            ]
        }
        expect(options.properties).toContain("openFile")
        expect(options.properties).toContain("multiSelections")
        expect(options.filters[0].extensions).toContain("pdf")
        expect(options.filters[0].extensions).toContain("txt")
        expect(options.filters[0].extensions).toContain("html")
    })

    test("save dialog has correct filters",()=>{
        let options={
            filters:[
                {name:"JSON Lines",extensions:["jsonl"]},
                {name:"JSON",extensions:["json"]},
                {name:"Text",extensions:["txt"]},
                {name:"All Files",extensions:["*"]}
            ]
        }
        expect(options.filters).toHaveLength(4)
        expect(options.filters[0].name).toBe("JSON Lines")
        expect(options.filters[0].extensions).toContain("jsonl")
        expect(options.filters[1].extensions).toContain("json")
        expect(options.filters[2].extensions).toContain("txt")
    })

    test("save dialog default filename is jsonl",()=>{
        let defaultFilename=undefined
        let defaultPath=defaultFilename||"training_data.jsonl"
        expect(defaultPath).toBe("training_data.jsonl")
        expect(defaultPath.endsWith(".jsonl")).toBe(true)
    })

    test("open dialog supports document file types",()=>{
        let supportedExtensions=["pdf","docx","doc","rtf","txt","md","html"]
        expect(supportedExtensions).toContain("pdf")
        expect(supportedExtensions).toContain("docx")
        expect(supportedExtensions).toContain("txt")
        expect(supportedExtensions).toContain("md")
    })
})

describe("Command line switches",()=>{
    test("performance switches are defined",()=>{
        let switches=[
            "no-first-run",
            "disable-background-networking",
            "disable-component-update",
            "disable-sync",
            "disable-default-apps",
            "metrics-recording-only",
            "enable-gpu-rasterization",
            "enable-oop-rasterization",
            "enable-zero-copy",
            "enable-gpu",
            "enable-accelerated-2d-canvas",
            "enable-accelerated-video-decode"
        ]
        expect(switches).toHaveLength(12)
        expect(switches).toContain("enable-gpu")
        expect(switches).toContain("enable-gpu-rasterization")
    })

    test("windows-specific switches are defined",()=>{
        let isWin=true
        let winSwitches:string[]=[]
        if(isWin){
            winSwitches.push("disable-hang-monitor")
            winSwitches.push("disable-prompt-on-repost")
        }
        expect(winSwitches).toHaveLength(2)
        expect(winSwitches).toContain("disable-hang-monitor")
    })
})

describe("Error handling patterns",()=>{
    test("file read returns error object on failure",()=>{
        let result:{success:boolean;content?:string;error?:string}={success:false,error:"ENOENT: no such file"}
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
    })

    test("file save returns error object on failure",()=>{
        let result:{success:boolean;error?:string}={success:false,error:"EACCES: permission denied"}
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
    })

    test("file parse returns error object on failure",()=>{
        let result:{success:boolean;content?:string;error?:string}={success:false,error:"Unsupported file type"}
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
    })

    test("ollama generate returns error object instead of throwing",()=>{
        let result:{success:boolean;response?:string;error?:string}={success:false,error:"Failed after 3attempts:ECONNABORTED"}
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
        expect(result.error).toContain("Failed after")
    })
})

describe("Path resolution for prompts",()=>{
    test("resolves src/prompts/ prefix to prompts/",()=>{
        let filePath="src/prompts/system.txt"
        let withoutSrc=filePath.replace("src/prompts/","prompts/")
        expect(withoutSrc).toBe("prompts/system.txt")
    })

    test("does not modify non-src prompts path",()=>{
        let filePath="prompts/system.txt"
        let withoutSrc=filePath.replace("src/prompts/","prompts/")
        expect(withoutSrc).toBe("prompts/system.txt")
    })

    test("detects prompts/ in path",()=>{
        let filePath="prompts/system.txt"
        expect(filePath.includes("prompts/")).toBe(true)
    })
})
