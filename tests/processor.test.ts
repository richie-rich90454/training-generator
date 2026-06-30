// @vitest-environment happy-dom
import{describe,it,expect,vi,beforeEach}from"vitest"
import Processor from"../src/renderer/processor.js"
import type{Provider,ProviderResult}from"../src/renderer/provider.js"
import{clearCache}from"../src/renderer/cache.js"

let processor:Processor
let mockGeneratePrompt:any
let mockCreateTrainingItem:any
let mockOnChunkComplete:any
let mockOnChunkError:any
let mockProvider:Provider

beforeEach(async()=>{
    await clearCache()
    mockGeneratePrompt=vi.fn(async(chunk:string,type:string)=>`Prompt for: ${chunk}`)
    mockCreateTrainingItem=vi.fn((input:string,output:string,type:string)=>{
        return[{input,output}]
    })
    mockOnChunkComplete=vi.fn()
    mockOnChunkError=vi.fn()
    mockProvider={
        name:"mock",
        generate:vi.fn(async(prompt:string,model:string,options?:any):Promise<ProviderResult>=>{
            return{text:`Response for: ${prompt.substring(0,30)}`,tokens:10,provider:"mock"}
        })
    }
    vi.stubGlobal("window",{
        electronAPI:{
            generateWithOllamaStream:vi.fn(),
            loadCache:vi.fn(async()=>({success:true,data:{}})),
            saveCache:vi.fn(async()=>({success:true})),
            clearCache:vi.fn(async()=>({success:true}))
        }
    })
    processor=new Processor()
    processor.provider=mockProvider
})

describe("Processor",()=>{
    describe("processChunks",()=>{
        it("should process all chunks with concurrency=2",async()=>{
            let chunks=["chunk1","chunk2","chunk3"]
            processor.concurrency=2
            let results=await processor.processChunks(
                chunks,"llama2","instruction",
                mockGeneratePrompt,mockCreateTrainingItem,
                mockOnChunkComplete,mockOnChunkError
            )
            expect(results.length).toBe(3)
            expect(mockOnChunkComplete).toHaveBeenCalledTimes(3)
            expect(mockOnChunkError).not.toHaveBeenCalled()
        })

        it("should handle empty chunks array",async()=>{
            let results=await processor.processChunks(
                [],"llama2","instruction",
                mockGeneratePrompt,mockCreateTrainingItem,
                mockOnChunkComplete,mockOnChunkError
            )
            expect(results).toEqual([])
            expect(mockOnChunkComplete).not.toHaveBeenCalled()
        })

        it("should skip empty chunk strings",async()=>{
            let chunks=["","  ","valid chunk"]
            processor.concurrency=1
            // Set provider name to "ollama" to disable batching so empty chunks are filtered in queue path
            mockProvider.name="ollama"
            let results=await processor.processChunks(
                chunks,"llama2","instruction",
                mockGeneratePrompt,mockCreateTrainingItem,
                mockOnChunkComplete,mockOnChunkError
            )
            expect(results.length).toBe(1)
            expect(mockOnChunkComplete).toHaveBeenCalledTimes(1)
        })

        it("should handle concurrency=1 (serial)",async()=>{
            let chunks=["a","b","c"]
            processor.concurrency=1
            let results=await processor.processChunks(
                chunks,"llama2","instruction",
                mockGeneratePrompt,mockCreateTrainingItem,
                mockOnChunkComplete,mockOnChunkError
            )
            expect(results.length).toBe(3)
        })

        it("should handle concurrency=5",async()=>{
            let chunks=["a","b","c","d","e","f","g"]
            processor.concurrency=5
            let results=await processor.processChunks(
                chunks,"llama2","instruction",
                mockGeneratePrompt,mockCreateTrainingItem,
                mockOnChunkComplete,mockOnChunkError
            )
            expect(results.length).toBe(7)
        })

        it("should call onChunkComplete with correct index and total",async()=>{
            let chunks=["a","b","c"]
            processor.concurrency=3
            await processor.processChunks(
                chunks,"llama2","instruction",
                mockGeneratePrompt,mockCreateTrainingItem,
                mockOnChunkComplete,mockOnChunkError
            )
            let calls=mockOnChunkComplete.mock.calls
            let idxs=calls.map((c:any[])=>c[0]).sort((a:number,b:number)=>a-b)
            expect(idxs).toEqual([0,1,2])
            expect(calls[0][1]).toBe(3)
        })

        it("should pass training items to onChunkComplete",async()=>{
            let chunks=["chunk1"]
            processor.concurrency=1
            mockCreateTrainingItem.mockReturnValue([{input:"in",output:"out"}])
            await processor.processChunks(
                chunks,"llama2","instruction",
                mockGeneratePrompt,mockCreateTrainingItem,
                mockOnChunkComplete,mockOnChunkError
            )
            expect(mockOnChunkComplete).toHaveBeenCalledWith(0,1,[{input:"in",output:"out"}])
        })
    })

    describe("abort",()=>{
        it("should stop processing when aborted",async()=>{
            let slowProvider:Provider={
                name:"slow",
                generate:vi.fn(async():Promise<ProviderResult>=>{
                    await new Promise(resolve=>setTimeout(resolve,100))
                    return{text:"response",tokens:10,provider:"slow"}
                })
            }
            processor.provider=slowProvider
            let chunks=["a","b","c","d","e","f","g","h","i","j"]
            processor.concurrency=2
            let promise=processor.processChunks(
                chunks,"llama2","instruction",
                mockGeneratePrompt,mockCreateTrainingItem,
                mockOnChunkComplete,mockOnChunkError
            )
            await new Promise(resolve=>setTimeout(resolve,50))
            processor.abort()
            let results=await promise
            expect(results.length).toBeLessThan(10)
            expect(processor.isAborted).toBe(true)
        })
    })

    describe("isAborted",()=>{
        it("should return false when not aborted",()=>{
            processor.reset()
            expect(processor.isAborted).toBe(false)
        })

        it("should return true after abort when AbortController exists",()=>{
            processor.reset()
            processor.abort()
            expect(processor.isAborted).toBe(true)
        })
    })

    describe("demoMode",()=>{
        it("should use demo responses when demo mode is enabled",async()=>{
            processor.enableDemoMode()
            expect(processor.demoMode).toBe(true)
            let mockStream=vi.fn()
            vi.stubGlobal("window",{
                electronAPI:{
                    generateWithOllamaStream:mockStream,
                    loadCache:vi.fn(async()=>({success:true,data:{}})),
                    saveCache:vi.fn(async()=>({success:true}))
                }
            })
            let chunks=["test chunk"]
            processor.concurrency=1
            let results=await processor.processChunks(
                chunks,"llama2","instruction",
                mockGeneratePrompt,mockCreateTrainingItem,
                mockOnChunkComplete,mockOnChunkError
            )
            expect(results.length).toBe(1)
            expect(mockStream).not.toHaveBeenCalled()
        })

        it("should disable demo mode",()=>{
            processor.enableDemoMode()
            processor.disableDemoMode()
            expect(processor.demoMode).toBe(false)
        })

        it("should get demo response for instruction type",()=>{
            processor.enableDemoMode()
            let response=(processor as any).getDemoResponse("test","instruction")
            expect(response).toBeTruthy()
            expect(typeof response).toBe("string")
        })

        it("should get demo response for conversation type",()=>{
            processor.enableDemoMode()
            let response=(processor as any).getDemoResponse("test","conversation")
            expect(response).toBeTruthy()
        })
    })

    describe("onChunkError",()=>{
        it("should call onChunkError when generatePrompt fails",async()=>{
            let failingGeneratePrompt=vi.fn(async()=>{
                throw new Error("prompt generation failed")
            })
            let chunks=["test chunk"]
            processor.concurrency=1
            let results=await processor.processChunks(
                chunks,"llama2","instruction",
                failingGeneratePrompt,mockCreateTrainingItem,
                mockOnChunkComplete,mockOnChunkError
            )
            expect(results.length).toBe(0)
            expect(mockOnChunkError).toHaveBeenCalledTimes(1)
        })

        it("should call onChunkError when Ollama call fails",async()=>{
            let failingProvider:Provider={
                name:"mock",
                generate:vi.fn(async()=>{
                    throw new Error("Ollama error")
                })
            }
            processor.provider=failingProvider
            let chunks=["test chunk"]
            processor.concurrency=1
            let results=await processor.processChunks(
                chunks,"llama2","instruction",
                mockGeneratePrompt,mockCreateTrainingItem,
                mockOnChunkComplete,mockOnChunkError
            )
            expect(results.length).toBe(0)
            expect(mockOnChunkError).toHaveBeenCalledTimes(1)
        })

        it("should call onChunkError when Ollama returns failure",async()=>{
            let failingProvider:Provider={
                name:"mock",
                generate:vi.fn(async()=>{
                    throw new Error("model not found")
                })
            }
            processor.provider=failingProvider
            let chunks=["test chunk"]
            processor.concurrency=1
            let results=await processor.processChunks(
                chunks,"llama2","instruction",
                mockGeneratePrompt,mockCreateTrainingItem,
                mockOnChunkComplete,mockOnChunkError
            )
            expect(results.length).toBe(0)
            expect(mockOnChunkError).toHaveBeenCalledTimes(1)
        })
    })

    describe("reset",()=>{
        it("should create a new AbortController",()=>{
            processor.reset()
            expect(processor.isAborted).toBe(false)
        })
    })

    describe("concurrency default",()=>{
        it("should default to 3",()=>{
            expect(processor.concurrency).toBe(3)
        })
    })

    describe("demoMode default",()=>{
        it("should default to false",()=>{
            expect(processor.demoMode).toBe(false)
        })
    })
})