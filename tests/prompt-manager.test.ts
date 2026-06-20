// @vitest-environment happy-dom
import{describe,it,expect,vi,beforeEach}from"vitest"
import PromptManager from"../src/renderer/promptManager.js"

let mockReadFile:any

beforeEach(()=>{
    mockReadFile=vi.fn()
    vi.stubGlobal("window",{
        electronAPI:{
            readFile:mockReadFile
        }
    })
})

describe("PromptManager",()=>{
    let pm:PromptManager

    beforeEach(()=>{
        pm=new PromptManager()
        mockReadFile.mockReset()
    })

    describe("getPrompt",()=>{
        it("should load prompt via electron API and cache it",async()=>{
            mockReadFile.mockResolvedValue({success:true,content:"You are a helpful assistant. {{text}}"})
            let result=await pm.getPrompt("en","instruction")
            expect(result).toBe("You are a helpful assistant. {{text}}")
            expect(mockReadFile).toHaveBeenCalledTimes(1)
            let result2=await pm.getPrompt("en","instruction")
            expect(result2).toBe("You are a helpful assistant. {{text}}")
            expect(mockReadFile).toHaveBeenCalledTimes(1)
        })

        it("should return null when file not found",async()=>{
            mockReadFile.mockResolvedValue({success:false,error:"not found"})
            let result=await pm.getPrompt("en","instruction")
            expect(result).toBeNull()
        })

        it("should try multiple paths",async()=>{
            mockReadFile
                .mockResolvedValueOnce({success:false})
                .mockResolvedValueOnce({success:false})
                .mockResolvedValueOnce({success:true,content:"prompt content"})
            let result=await pm.getPrompt("en","instruction")
            expect(result).toBe("prompt content")
            expect(mockReadFile).toHaveBeenCalledTimes(3)
        })

        it("should map processingType correctly",async()=>{
            mockReadFile.mockResolvedValue({success:true,content:"conversation prompt"})
            let result=await pm.getPrompt("en","conversation")
            expect(result).toBe("conversation prompt")
            expect(mockReadFile).toHaveBeenCalledWith("src/prompts/en_conversation.txt")
        })

        it("should fallback to instruction for unknown processingType",async()=>{
            mockReadFile.mockResolvedValue({success:true,content:"instruction prompt"})
            let result=await pm.getPrompt("en","unknown")
            expect(result).toBe("instruction prompt")
            expect(mockReadFile).toHaveBeenCalledWith("src/prompts/en_instruction.txt")
        })
    })

    describe("getPromptWithFallback",()=>{
        it("should return requested language prompt",async()=>{
            mockReadFile.mockResolvedValue({success:true,content:"Chinese prompt"})
            let result=await pm.getPromptWithFallback("zh","instruction")
            expect(result).toBe("Chinese prompt")
        })

        it("should fallback to English when requested language not found",async()=>{
            mockReadFile
                .mockResolvedValueOnce({success:false})
                .mockResolvedValueOnce({success:true,content:"English fallback"})
            let result=await pm.getPromptWithFallback("ja","instruction")
            expect(result).toBe("English fallback")
        })

        it("should return null when no language available",async()=>{
            mockReadFile.mockResolvedValue({success:false})
            let result=await pm.getPromptWithFallback("ja","instruction")
            expect(result).toBeNull()
        })

        it("should not fallback when English is requested",async()=>{
            mockReadFile.mockResolvedValue({success:false})
            let result=await pm.getPromptWithFallback("en","instruction")
            expect(result).toBeNull()
            expect(mockReadFile).toHaveBeenCalledTimes(4)
        })
    })

    describe("invalidateCache",()=>{
        it("should clear all cached prompts",async()=>{
            mockReadFile.mockResolvedValue({success:true,content:"cached prompt"})
            await pm.getPrompt("en","instruction")
            expect(mockReadFile).toHaveBeenCalledTimes(1)
            pm.invalidateCache()
            await pm.getPrompt("en","instruction")
            expect(mockReadFile).toHaveBeenCalledTimes(2)
        })
    })

    describe("invalidatePrompt",()=>{
        it("should clear specific cached prompt",async()=>{
            mockReadFile.mockResolvedValue({success:true,content:"prompt"})
            await pm.getPrompt("en","instruction")
            await pm.getPrompt("en","conversation")
            expect(mockReadFile).toHaveBeenCalledTimes(2)
            pm.invalidatePrompt("en","instruction")
            await pm.getPrompt("en","instruction")
            expect(mockReadFile).toHaveBeenCalledTimes(3)
            await pm.getPrompt("en","conversation")
            expect(mockReadFile).toHaveBeenCalledTimes(3)
        })
    })
})