import{describe,it,expect,vi,beforeEach}from"vitest"
import{EventEmitter}from"events"

vi.mock("electron",()=>{
    let appEventEmitter=new EventEmitter()
    return{
        app:{
            getPath:vi.fn((name:string)=>{
                if(name==="documents")return process.cwd()
                if(name==="downloads")return process.cwd()
                if(name==="desktop")return process.cwd()
                if(name==="home")return process.cwd()
                return process.cwd()
            }),
            setPath:vi.fn(),
            getAppPath:vi.fn(()=>process.cwd()),
            commandLine:{
                appendSwitch:vi.fn()
            },
            whenReady:vi.fn(()=>Promise.resolve()),
            on:vi.fn((event:string,cb:(...args:any[])=>void)=>appEventEmitter.on(event,cb)),
            getVersion:vi.fn(()=>"1.0.0"),
            quit:vi.fn()
        },
        BrowserWindow:vi.fn(function(){
            return{
                loadFile:vi.fn(()=>Promise.resolve()),
                loadURL:vi.fn(()=>Promise.resolve()),
                on:vi.fn(),
                once:vi.fn(),
                show:vi.fn(),
                hide:vi.fn(),
                focus:vi.fn(),
                close:vi.fn(),
                center:vi.fn(),
                restore:vi.fn(),
                setMenu:vi.fn(),
                setBackgroundMaterial:vi.fn(),
                isDestroyed:vi.fn(()=>false),
                isMinimized:vi.fn(()=>false),
                isVisible:vi.fn(()=>true),
                isFocused:vi.fn(()=>true),
                webContents:{
                    executeJavaScript:vi.fn(()=>Promise.resolve()),
                    openDevTools:vi.fn(),
                    setWindowOpenHandler:vi.fn(),
                    on:vi.fn(),
                    once:vi.fn(),
                    send:vi.fn()
                }
            }
        }),
        ipcMain:{
            handle:vi.fn()
        },
        dialog:{
            showOpenDialog:vi.fn(),
            showSaveDialog:vi.fn(),
            showErrorBox:vi.fn()
        },
        protocol:{
            registerSchemesAsPrivileged:vi.fn(),
            handle:vi.fn()
        },
        nativeImage:{
            createFromPath:vi.fn(()=>({isEmpty:vi.fn(()=>false)}))
        },
        Tray:vi.fn(function(){
            return{
                setToolTip:vi.fn(),
                setContextMenu:vi.fn(),
                on:vi.fn(),
                setImage:vi.fn()
            }
        }),
        Menu:{
            buildFromTemplate:vi.fn(()=>({
                on:vi.fn(),
                popup:vi.fn()
            }))
        }
    }
})

vi.mock("axios",()=>{
    return{
        default:{
            post:vi.fn()
        }
    }
})

vi.mock("../src/core/fileParserLazy.js",()=>{
    return{
        default:vi.fn()
    }
})

let tick=()=>new Promise(r=>setTimeout(r,10))

describe("handleOllamaGenerateStream",()=>{
    let axios:any
    let handleOllamaGenerateStream:any
    let mockEvent:any

    beforeEach(async()=>{
        let axiosModule=await import("axios")
        axios=axiosModule.default
        vi.clearAllMocks()
        let mainModule=await import("../src/main.js")
        handleOllamaGenerateStream=mainModule.handleOllamaGenerateStream
        mockEvent={
            sender:{
                send:vi.fn()
            }
        }
    })

    it("should reject invalid model name(empty)",async()=>{
        let result=await handleOllamaGenerateStream(mockEvent,{model:"",prompt:"test"})
        expect(result.success).toBe(false)
        expect(result.error).toBe("Invalid model name or prompt")
    })

    it("should reject invalid model name(number)",async()=>{
        let result=await handleOllamaGenerateStream(mockEvent,{model:123 as any,prompt:"test"})
        expect(result.success).toBe(false)
    })

    it("should reject invalid prompt",async()=>{
        let result=await handleOllamaGenerateStream(mockEvent,{model:"llama2",prompt:""})
        expect(result.success).toBe(false)
    })

    it("should reject prompt larger than 500000 chars",async()=>{
        let largePrompt="x".repeat(500001)
        let result=await handleOllamaGenerateStream(mockEvent,{model:"llama2",prompt:largePrompt})
        expect(result.success).toBe(false)
        expect(result.error).toBe("Prompt is too large")
    })

    it("should handle successful streaming response",async()=>{
        let mockStream=new EventEmitter()
        axios.post.mockResolvedValue({data:mockStream})
        let promise=handleOllamaGenerateStream(mockEvent,{model:"llama2",prompt:"test"})
        await tick()
        mockStream.emit("data",Buffer.from('{"response":"Hello","done":false}\n'))
        mockStream.emit("data",Buffer.from('{"response":" World","done":true}\n'))
        let result=await promise
        expect(result.success).toBe(true)
        expect(result.response).toBe("Hello World")
    })

    it("should handle stream error",async()=>{
        let mockStream=new EventEmitter()
        axios.post.mockResolvedValue({data:mockStream})
        let promise=handleOllamaGenerateStream(mockEvent,{model:"llama2",prompt:"test"})
        await tick()
        mockStream.emit("error",new Error("Connection error"))
        await expect(promise).resolves.toEqual({success:false,error:"Failed to generate response from Ollama: Connection error"})
    })

    it("should handle empty stream end",async()=>{
        let mockStream=new EventEmitter()
        axios.post.mockResolvedValue({data:mockStream})
        let promise=handleOllamaGenerateStream(mockEvent,{model:"llama2",prompt:"test"})
        await tick()
        mockStream.emit("end")
        await expect(promise).resolves.toEqual({success:false,error:"Failed to generate response from Ollama: Stream ended without response"})
    })

    it("should use extended timeout for large prompts",async()=>{
        let mockStream=new EventEmitter()
        axios.post.mockResolvedValue({data:mockStream})
        let mediumPrompt="x".repeat(6000)
        let promise=handleOllamaGenerateStream(mockEvent,{model:"llama2",prompt:mediumPrompt})
        // Streaming handler no longer passes axios timeout — it uses per-data-packet timers
        expect(axios.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                prompt:mediumPrompt,
                stream:true,
                options:expect.objectContaining({num_predict:4096})
            }),
            expect.objectContaining({responseType:"stream"})
        )
        await tick()
        mockStream.emit("data",Buffer.from('{"response":"ok","done":true}\n'))
        await promise
    })

    it("should sanitize model name by removing control characters",async()=>{
        let mockStream=new EventEmitter()
        axios.post.mockResolvedValue({data:mockStream})
        let promise=handleOllamaGenerateStream(mockEvent,{model:"llama\x002",prompt:"test"})
        expect(axios.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({model:"llama2"}),
            expect.any(Object)
        )
        await tick()
        mockStream.emit("data",Buffer.from('{"response":"ok","done":true}\n'))
        await promise
    })

    it("should handle axios post failure",async()=>{
        axios.post.mockRejectedValue(new Error("Network error"))
        let result=await handleOllamaGenerateStream(mockEvent,{model:"llama2",prompt:"test"})
        expect(result.success).toBe(false)
        expect(result.error).toBe("Failed to generate response from Ollama: Network error")
    })
})