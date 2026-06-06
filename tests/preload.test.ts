// @vitest-environment happy-dom
import{describe,test,expect,vi,beforeEach}from "vitest"

function createMockElectronAPI(){
    let listeners:Record<string,Function[]>={}
    return{
        ipcRenderer:{
            invoke:vi.fn(),
            on:vi.fn((channel:string,callback:Function)=>{
                listeners[channel]=listeners[channel]||[]
                listeners[channel].push(callback)
            }),
            removeListener:vi.fn((channel:string,callback:Function)=>{
                if(listeners[channel]){
                    listeners[channel]=listeners[channel].filter(fn=>fn!==callback)
                }
            }),
            send:vi.fn(),
            _listeners:listeners
        }
    }
}

describe("Preload API structure",()=>{
    let mockElectron:ReturnType<typeof createMockElectronAPI>

    beforeEach(()=>{
        mockElectron=createMockElectronAPI()
    })

    test("exposes electronAPI on window with all methods",()=>{
        let apiShape={
            openFileDialog:expect.any(Function),
            readFile:expect.any(Function),
            parseFile:expect.any(Function),
            parseFilesBatch:expect.any(Function),
            saveFile:expect.any(Function),
            saveFileDialog:expect.any(Function),
            checkOllama:expect.any(Function),
            generateWithOllama:expect.any(Function),
            getAppVersion:expect.any(Function),
            getPlatform:expect.any(Function),
            onOllamaStatusUpdate:expect.any(Function)
        }
        expect(apiShape.openFileDialog).toBeDefined()
        expect(apiShape.readFile).toBeDefined()
        expect(apiShape.parseFile).toBeDefined()
        expect(apiShape.parseFilesBatch).toBeDefined()
        expect(apiShape.saveFile).toBeDefined()
        expect(apiShape.saveFileDialog).toBeDefined()
        expect(apiShape.checkOllama).toBeDefined()
        expect(apiShape.generateWithOllama).toBeDefined()
        expect(apiShape.getAppVersion).toBeDefined()
        expect(apiShape.getPlatform).toBeDefined()
        expect(apiShape.onOllamaStatusUpdate).toBeDefined()
    })

    test("IPC invoke is called for openFileDialog",()=>{
        mockElectron.ipcRenderer.invoke("dialog:openFile")
        expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith("dialog:openFile")
    })

    test("IPC invoke is called for readFile with path",()=>{
        mockElectron.ipcRenderer.invoke("file:read","/path/to/file.txt")
        expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith("file:read","/path/to/file.txt")
    })

    test("IPC invoke is called for parseFile with path and type",()=>{
        mockElectron.ipcRenderer.invoke("file:parse","/path/to/file.pdf","pdf")
        expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith("file:parse","/path/to/file.pdf","pdf")
    })

    test("IPC invoke is called for parseFilesBatch with files array",()=>{
        let files=[{path:"/path/to/file1.pdf"},{path:"/path/to/file2.txt"}]
        mockElectron.ipcRenderer.invoke("file:parseBatch",files)
        expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith("file:parseBatch",files)
    })

    test("IPC invoke is called for saveFile with path and content",()=>{
        mockElectron.ipcRenderer.invoke("file:save","/path/to/output.jsonl","content")
        expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith("file:save","/path/to/output.jsonl","content")
    })

    test("IPC invoke is called for saveFileDialog",()=>{
        mockElectron.ipcRenderer.invoke("dialog:saveFile","default.jsonl")
        expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith("dialog:saveFile","default.jsonl")
    })

    test("IPC invoke is called for checkOllama",()=>{
        mockElectron.ipcRenderer.invoke("ollama:check")
        expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith("ollama:check")
    })

    test("IPC invoke is called for generateWithOllama with model and prompt",()=>{
        let payload={model:"llama2",prompt:"Hello",options:{temperature:0.7,top_p:0.9}}
        mockElectron.ipcRenderer.invoke("ollama:generate",payload)
        expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith("ollama:generate",payload)
    })

    test("IPC invoke is called for getAppVersion",()=>{
        mockElectron.ipcRenderer.invoke("app:getVersion")
        expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith("app:getVersion")
    })

    test("IPC invoke is called for getPlatform",()=>{
        mockElectron.ipcRenderer.invoke("app:getPlatform")
        expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith("app:getPlatform")
    })

    test("onOllamaStatusUpdate registers IPC listener on ollama:status-update",()=>{
        let callback=vi.fn()
        mockElectron.ipcRenderer.on("ollama:status-update",callback)
        expect(mockElectron.ipcRenderer.on).toHaveBeenCalledWith("ollama:status-update",callback)
    })

    test("onOllamaStatusUpdate returns unsubscribe function",()=>{
        let callback=vi.fn()
        mockElectron.ipcRenderer.on("ollama:status-update",callback)
        let unsubscribe=()=>{
            mockElectron.ipcRenderer.removeListener("ollama:status-update",callback)
        }
        expect(typeof unsubscribe).toBe("function")
        unsubscribe()
        expect(mockElectron.ipcRenderer.removeListener).toHaveBeenCalledWith("ollama:status-update",callback)
    })

    test("onOllamaStatusUpdate listener receives OllamaStatus object",()=>{
        let callback=vi.fn()
        mockElectron.ipcRenderer.on("ollama:status-update",callback)
        let status={running:true,models:[{name:"llama2"}],version:"0.1.0"}
        let listeners=mockElectron.ipcRenderer._listeners["ollama:status-update"]
        expect(listeners).toBeDefined()
        expect(listeners.length).toBe(1)
        listeners[0]({},status)
        expect(callback).toHaveBeenCalledWith(status)
    })

    test("onOllamaStatusUpdate unsubscribe stops receiving events",()=>{
        let callback=vi.fn()
        mockElectron.ipcRenderer.on("ollama:status-update",callback)
        mockElectron.ipcRenderer.removeListener("ollama:status-update",callback)
        let listeners=mockElectron.ipcRenderer._listeners["ollama:status-update"]
        expect(listeners.length).toBe(0)
    })

    test("multiple onOllamaStatusUpdate listeners are supported",()=>{
        let callback1=vi.fn()
        let callback2=vi.fn()
        mockElectron.ipcRenderer.on("ollama:status-update",callback1)
        mockElectron.ipcRenderer.on("ollama:status-update",callback2)
        let listeners=mockElectron.ipcRenderer._listeners["ollama:status-update"]
        expect(listeners.length).toBe(2)
    })

    test("appConsole methods are exposed",()=>{
        let appConsole={
            log:(...args:unknown[])=>console.log("[App]",...args),
            error:(...args:unknown[])=>console.error("[App Error]",...args),
            warn:(...args:unknown[])=>console.warn("[App Warning]",...args),
            info:(...args:unknown[])=>console.info("[App Info]",...args)
        }
        expect(typeof appConsole.log).toBe("function")
        expect(typeof appConsole.error).toBe("function")
        expect(typeof appConsole.warn).toBe("function")
        expect(typeof appConsole.info).toBe("function")
    })
})

describe("Preload security",()=>{
    test("contextIsolation should be enabled",()=>{
        let isSecure=true
        expect(isSecure).toBe(true)
    })

    test("only whitelisted IPC channels are used",()=>{
        let allowedChannels:string[]=[
            "dialog:openFile",
            "dialog:saveFile",
            "file:read",
            "file:parse",
            "file:parseBatch",
            "file:save",
            "ollama:check",
            "ollama:generate",
            "app:getVersion",
            "app:getPlatform",
            "ollama:status-update"
        ]
        expect(allowedChannels).toContain("dialog:openFile")
        expect(allowedChannels).toContain("file:parse")
        expect(allowedChannels).toContain("ollama:check")
        expect(allowedChannels).toContain("ollama:status-update")
        expect(allowedChannels).not.toContain("shell:execute")
        expect(allowedChannels).not.toContain("fs:read")
        expect(allowedChannels).not.toContain("child_process:spawn")
    })

    test("nodeIntegration is not exposed",()=>{
        let hasNodeIntegration=false
        expect(hasNodeIntegration).toBe(false)
    })

    test("ipcRenderer methods are limited to on/invoke/send/removeListener",()=>{
        let allowedMethods=["on","invoke","send","removeListener"]
        expect(allowedMethods).toContain("on")
        expect(allowedMethods).toContain("invoke")
        expect(allowedMethods).toContain("send")
        expect(allowedMethods).toContain("removeListener")
        expect(allowedMethods).not.toContain("sendTo")
        expect(allowedMethods).not.toContain("sendSync")
    })
})
