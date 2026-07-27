// @vitest-environment happy-dom
import{describe,it,expect,vi,beforeEach}from"vitest"
import PromptManager from"../src/renderer/promptManager.js"
let mockGetPrompt:any
let mockReadFile:any
beforeEach(()=>{
    mockGetPrompt=vi.fn()
    mockReadFile=vi.fn().mockResolvedValue({success:false})
    vi.stubGlobal("window",{
        electronAPI:{
            getPrompt:mockGetPrompt,
            readFile:mockReadFile
        }
    })
    vi.stubGlobal("fetch",vi.fn(async()=>({ok:false})))
    vi.spyOn(console,"error").mockImplementation(()=>{})
    vi.spyOn(console,"warn").mockImplementation(()=>{})
})
afterEach(()=>{
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})
describe("PromptManager",()=>{
    let pm:PromptManager
    beforeEach(()=>{
        pm=new PromptManager()
        mockGetPrompt.mockReset()
        mockReadFile.mockReset()
    })
    describe("getPrompt",()=>{
        it("should load prompt via IPC getPrompt and cache it",async()=>{
            mockGetPrompt.mockResolvedValue({success:true,content:"You are a helpful assistant. {{text}}"})
            let result=await pm.getPrompt("en","instruction")
            expect(result).toBe("You are a helpful assistant. {{text}}")
            expect(mockGetPrompt).toHaveBeenCalledTimes(1)
            expect(mockGetPrompt).toHaveBeenCalledWith("en","instruction")
            let result2=await pm.getPrompt("en","instruction")
            expect(result2).toBe("You are a helpful assistant. {{text}}")
            expect(mockGetPrompt).toHaveBeenCalledTimes(1)
        })
        it("should return null when IPC reports not found and cache negative result",async()=>{
            mockGetPrompt.mockResolvedValue({success:false,error:"not found"})
            let result=await pm.getPrompt("en","instruction")
            expect(result).toBeNull()
            let result2=await pm.getPrompt("en","instruction")
            expect(result2).toBeNull()
            expect(mockGetPrompt).toHaveBeenCalledTimes(1)
        })
        it("should fallback to readFile when IPC is unavailable",async()=>{
            vi.stubGlobal("window",{
                electronAPI:{
                    readFile:mockReadFile
                }
            })
            mockReadFile.mockResolvedValueOnce({success:false}).mockResolvedValueOnce({success:false}).mockResolvedValueOnce({success:true,content:"prompt content"})
            let result=await pm.getPrompt("en","instruction")
            expect(result).toBe("prompt content")
            expect(mockReadFile).toHaveBeenCalledTimes(3)
        })
        it("should de-duplicate concurrent getPrompt calls",async()=>{
            let resolveFn:((value:{success:boolean;content?:string})=>void)|null=null
            mockGetPrompt.mockImplementation(()=>new Promise((resolve)=>{resolveFn=resolve}))
            let p1=pm.getPrompt("en","instruction")
            let p2=pm.getPrompt("en","instruction")
            expect(mockGetPrompt).toHaveBeenCalledTimes(1)
            resolveFn!({success:true,content:"shared prompt"})
            expect(await p1).toBe("shared prompt")
            expect(await p2).toBe("shared prompt")
            expect(mockGetPrompt).toHaveBeenCalledTimes(1)
        })
        it("should map processingType correctly",async()=>{
            mockGetPrompt.mockResolvedValue({success:true,content:"conversation prompt"})
            let result=await pm.getPrompt("en","conversation")
            expect(result).toBe("conversation prompt")
            expect(mockGetPrompt).toHaveBeenCalledWith("en","conversation")
        })
        it("should fallback to instruction for unknown processingType",async()=>{
            mockGetPrompt.mockResolvedValue({success:true,content:"instruction prompt"})
            let result=await pm.getPrompt("en","unknown")
            expect(result).toBe("instruction prompt")
            expect(mockGetPrompt).toHaveBeenCalledWith("en","instruction")
        })
    })
    describe("getPromptWithFallback",()=>{
        it("should return requested language prompt",async()=>{
            mockGetPrompt.mockResolvedValue({success:true,content:"Chinese prompt"})
            let result=await pm.getPromptWithFallback("zh","instruction")
            expect(result).toBe("Chinese prompt")
        })
        it("should fallback to English when requested language not found",async()=>{
            mockGetPrompt
                .mockResolvedValueOnce({success:false,error:"not found"})
                .mockResolvedValueOnce({success:true,content:"English fallback"})
            let result=await pm.getPromptWithFallback("ja","instruction")
            expect(result).toBe("English fallback")
        })
        it("should return null when no language available",async()=>{
            mockGetPrompt.mockResolvedValue({success:false,error:"not found"})
            let result=await pm.getPromptWithFallback("ja","instruction")
            expect(result).toBeNull()
            expect(mockGetPrompt).toHaveBeenCalledTimes(2)
        })
        it("should not fallback when English is requested",async()=>{
            mockGetPrompt.mockResolvedValue({success:false,error:"not found"})
            let result=await pm.getPromptWithFallback("en","instruction")
            expect(result).toBeNull()
            expect(mockGetPrompt).toHaveBeenCalledTimes(1)
        })
    })
    describe("invalidateCache",()=>{
        it("should clear all cached prompts",async()=>{
            mockGetPrompt.mockResolvedValue({success:true,content:"cached prompt"})
            await pm.getPrompt("en","instruction")
            expect(mockGetPrompt).toHaveBeenCalledTimes(1)
            pm.invalidateCache()
            await pm.getPrompt("en","instruction")
            expect(mockGetPrompt).toHaveBeenCalledTimes(2)
        })
        it("should clear negative cache",async()=>{
            mockGetPrompt.mockResolvedValue({success:false,error:"not found"})
            await pm.getPrompt("en","instruction")
            expect(mockGetPrompt).toHaveBeenCalledTimes(1)
            pm.invalidateCache()
            await pm.getPrompt("en","instruction")
            expect(mockGetPrompt).toHaveBeenCalledTimes(2)
        })
    })
    describe("invalidatePrompt",()=>{
        it("should clear specific cached prompt",async()=>{
            mockGetPrompt.mockResolvedValue({success:true,content:"prompt"})
            await pm.getPrompt("en","instruction")
            await pm.getPrompt("en","conversation")
            expect(mockGetPrompt).toHaveBeenCalledTimes(2)
            pm.invalidatePrompt("en","instruction")
            await pm.getPrompt("en","instruction")
            expect(mockGetPrompt).toHaveBeenCalledTimes(3)
            await pm.getPrompt("en","conversation")
            expect(mockGetPrompt).toHaveBeenCalledTimes(3)
        })
    })
})
