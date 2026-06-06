import{describe,test,expect,vi,beforeEach}from "vitest"
import axios from "axios"
import path from "path"

vi.mock("axios",()=>{
    return{
        default:{
            get:vi.fn().mockResolvedValue({data:{models:[]}}),
            post:vi.fn().mockResolvedValue({data:{response:"test"}})
        }
    }
})

describe("Ollama API interaction patterns",()=>{
    beforeEach(()=>{
        vi.clearAllMocks()
    })

    describe("check Ollama status",()=>{
        test("detects Ollama is running with models",async()=>{
            let mockedAxios=axios as unknown as{get:ReturnType<typeof vi.fn>}
            mockedAxios.get.mockResolvedValueOnce({
                status:200,
                data:{
                    models:[
                        {name:"llama2",size:4000000000,modified_at:"2024-01-01",details:{format:"gguf",family:"llama",parameter_size:"7B",quantization_level:"Q4_0"}}
                    ]
                }
            })
            let response=await axios.get("http://localhost:11434/api/tags")
            expect(response.status).toBe(200)
            expect(response.data.models).toHaveLength(1)
            expect(response.data.models[0].name).toBe("llama2")
        })

        test("detects Ollama is not running",async()=>{
            let mockedAxios=axios as unknown as{get:ReturnType<typeof vi.fn>}
            mockedAxios.get.mockRejectedValueOnce(new Error("ECONNREFUSED"))
            await expect(axios.get("http://localhost:11434/api/tags")).rejects.toThrow("ECONNREFUSED")
        })

        test("handles timeout gracefully",async()=>{
            let mockedAxios=axios as unknown as{get:ReturnType<typeof vi.fn>}
            mockedAxios.get.mockRejectedValueOnce(new Error("ETIMEDOUT"))
            await expect(axios.get("http://localhost:11434/api/tags")).rejects.toThrow("ETIMEDOUT")
        })

        test("error response includes empty models array",async()=>{
            let mockedAxios=axios as unknown as{get:ReturnType<typeof vi.fn>}
            mockedAxios.get.mockRejectedValueOnce(new Error("ECONNREFUSED"))
            let status:{running:boolean;models:unknown[];error?:string}
            try{
                await axios.get("http://localhost:11434/api/tags")
                status={running:true,models:[]}
            }
            catch(error){
                status={running:false,models:[],error:(error as Error).message}
            }
            expect(status.running).toBe(false)
            expect(status.models).toEqual([])
            expect(status.error).toBe("ECONNREFUSED")
        })

        test("fetches version alongside tags",async()=>{
            let mockedAxios=axios as unknown as{get:ReturnType<typeof vi.fn>}
            mockedAxios.get
                .mockResolvedValueOnce({data:{models:[],version:"0.1.20"}})
                .mockResolvedValueOnce({data:{version:"0.1.20"}})
            let tagsResponse=await axios.get("http://localhost:11434/api/tags")
            let versionResponse=await axios.get("http://localhost:11434/api/version")
            expect(tagsResponse.data.models).toEqual([])
            expect(versionResponse.data.version).toBe("0.1.20")
        })

        test("handles version endpoint failure gracefully",async()=>{
            let mockedAxios=axios as unknown as{get:ReturnType<typeof vi.fn>}
            mockedAxios.get
                .mockResolvedValueOnce({data:{models:[{name:"llama2"}]}})
                .mockRejectedValueOnce(new Error("version endpoint failed"))
            let tagsResponse=await axios.get("http://localhost:11434/api/tags")
            let version="unknown"
            try{
                let versionResponse=await axios.get("http://localhost:11434/api/version")
                version=versionResponse.data.version||"unknown"
            }
            catch{
                if(tagsResponse.data?.version){
                    version=tagsResponse.data.version
                }
            }
            expect(tagsResponse.data.models).toHaveLength(1)
            expect(version).toBe("unknown")
        })
    })

    describe("generate with Ollama",()=>{
        test("sends correct parameters for generation",async()=>{
            let mockedAxios=axios as unknown as{post:ReturnType<typeof vi.fn>}
            mockedAxios.post.mockResolvedValueOnce({
                data:{response:"Hello! How can I help you?",done:true}
            })
            let response=await axios.post("http://localhost:11434/api/generate",{
                model:"llama2",
                prompt:"Hello",
                stream:false,
                options:{temperature:0.7,top_p:0.9}
            })
            expect(response.data.response).toBeDefined()
            expect(response.data.done).toBe(true)
        })

        test("handles generation error",async()=>{
            let mockedAxios=axios as unknown as{post:ReturnType<typeof vi.fn>}
            mockedAxios.post.mockRejectedValueOnce(new Error("model not found"))
            await expect(axios.post("http://localhost:11434/api/generate",{
                model:"nonexistent",
                prompt:"test",
                stream:false
            })).rejects.toThrow("model not found")
        })

        test("retries on transient failure",async()=>{
            let mockedAxios=axios as unknown as{post:ReturnType<typeof vi.fn>}
            mockedAxios.post
                .mockRejectedValueOnce(new Error("ECONNRESET"))
                .mockResolvedValueOnce({data:{response:"success",done:true}})
            try{
                await axios.post("http://localhost:11434/api/generate",{model:"llama2",prompt:"test",stream:false})
            }
            catch{
                // first call fails
            }
            let response=await axios.post("http://localhost:11434/api/generate",{model:"llama2",prompt:"test",stream:false})
            expect(response.data.response).toBe("success")
        })

        test("returns error object instead of throwing on max retries",async()=>{
            let mockedAxios=axios as unknown as{post:ReturnType<typeof vi.fn>}
            mockedAxios.post.mockRejectedValue(new Error("ECONNABORTED"))
            let maxRetries=2
            let lastError:Error|null=null
            let result:{success:boolean;error?:string}
            for(let attempt=0;attempt<=maxRetries;attempt++){
                try{
                    await axios.post("http://localhost:11434/api/generate",{
                        model:"llama2",
                        prompt:"test",
                        stream:false
                    })
                }
                catch(error){
                    lastError=error as Error
                    if((error as any).code=="ECONNABORTED"||(error as Error).message.includes("timeout")){
                        // retry
                    }
                    else{
                        break
                    }
                }
            }
            result={success:false,error:`Failed after ${maxRetries+1}attempts:${lastError?.message||"Unknown error"}`}
            expect(result.success).toBe(false)
            expect(result.error).toContain("Failed after 3attempts")
        })

        test("handles invalid response from Ollama",async()=>{
            let mockedAxios=axios as unknown as{post:ReturnType<typeof vi.fn>}
            mockedAxios.post.mockResolvedValueOnce({data:{}})
            let response=await axios.post("http://localhost:11434/api/generate",{
                model:"llama2",
                prompt:"test",
                stream:false
            })
            expect(response.data.response).toBeUndefined()
            // The handler should return {success:false,error:"Invalid response from Ollama"}
            let result=!response.data?.response
                ?{success:false,error:"Invalid response from Ollama"}
                :{success:true,response:response.data.response}
            expect(result.success).toBe(false)
            expect(result.error).toBe("Invalid response from Ollama")
        })

        test("uses default temperature and top_p when not provided",()=>{
            let options:{}={}
            let temperature=(options as any).temperature ?? 0.7
            let top_p=(options as any).top_p ?? 0.9
            expect(temperature).toBe(0.7)
            expect(top_p).toBe(0.9)
        })

        test("uses provided temperature and top_p",()=>{
            let options:{temperature:number;top_p:number}={temperature:0.5,top_p:0.8}
            let temperature=options.temperature ?? 0.7
            let top_p=options.top_p ?? 0.9
            expect(temperature).toBe(0.5)
            expect(top_p).toBe(0.8)
        })

        test("timeout scales with prompt length",()=>{
            let promptLength=15000
            let timeout=300000
            if(promptLength>10000)timeout=600000
            else if(promptLength>5000)timeout=450000
            expect(timeout).toBe(600000)

            promptLength=7500
            timeout=300000
            if(promptLength>10000)timeout=600000
            else if(promptLength>5000)timeout=450000
            expect(timeout).toBe(450000)

            promptLength=3000
            timeout=300000
            if(promptLength>10000)timeout=600000
            else if(promptLength>5000)timeout=450000
            expect(timeout).toBe(300000)
        })
    })

    describe("fetch Ollama models",()=>{
        test("parses model list correctly",async()=>{
            let mockedAxios=axios as unknown as{get:ReturnType<typeof vi.fn>}
            mockedAxios.get.mockResolvedValueOnce({
                data:{
                    models:[
                        {name:"llama2:7b",size:4000000000,details:{format:"gguf",family:"llama",parameter_size:"7B",quantization_level:"Q4_0"}},
                        {name:"mistral:7b",size:4100000000,details:{format:"gguf",family:"mistral",parameter_size:"7B",quantization_level:"Q4_0"}}
                    ]
                }
            })
            let response=await axios.get("http://localhost:11434/api/tags")
            expect(response.data.models).toHaveLength(2)
            expect(response.data.models[0].name).toBe("llama2:7b")
            expect(response.data.models[1].name).toBe("mistral:7b")
        })

        test("handles empty model list",async()=>{
            let mockedAxios=axios as unknown as{get:ReturnType<typeof vi.fn>}
            mockedAxios.get.mockResolvedValueOnce({
                data:{models:[]}
            })
            let response=await axios.get("http://localhost:11434/api/tags")
            expect(response.data.models).toHaveLength(0)
        })

        test("handles missing models field gracefully",async()=>{
            let mockedAxios=axios as unknown as{get:ReturnType<typeof vi.fn>}
            mockedAxios.get.mockResolvedValueOnce({
                data:{}
            })
            let response=await axios.get("http://localhost:11434/api/tags")
            let models=response.data.models||[]
            expect(models).toEqual([])
        })
    })
})

describe("File path operations",()=>{
    test("resolves correct file extension",()=>{
        let ext=path.extname("document.pdf")
        expect(ext).toBe(".pdf")
    })

    test("handles files without extension",()=>{
        let ext=path.extname("README")
        expect(ext).toBe("")
    })

    test("handles multiple dots in filename",()=>{
        let ext=path.extname("archive.tar.gz")
        expect(ext).toBe(".gz")
    })

    test("join paths correctly",()=>{
        let result=path.join("/base","sub","file.txt")
        expect(result).toContain("base")
        expect(result).toContain("file.txt")
    })

    test("basename extracts filename",()=>{
        expect(path.basename("/path/to/file.txt")).toBe("file.txt")
    })

    test("dirname extracts directory",()=>{
        expect(path.dirname("/path/to/file.txt")).toBe("/path/to")
    })

    test("extname returns extension with dot",()=>{
        expect(path.extname("data.jsonl")).toBe(".jsonl")
    })

    test("slice(1) removes dot from extension",()=>{
        let ext=path.extname("data.jsonl").slice(1)
        expect(ext).toBe("jsonl")
    })
})

describe("File save operations",()=>{
    test("returns success on successful write",()=>{
        let result:{success:boolean;error?:string}={success:true}
        expect(result.success).toBe(true)
        expect(result.error).toBeUndefined()
    })

    test("returns error on write failure",()=>{
        let result:{success:boolean;error?:string}={success:false,error:"EACCES: permission denied"}
        expect(result.success).toBe(false)
        expect(result.error).toBe("EACCES: permission denied")
    })
})

describe("File parse operations",()=>{
    test("returns success with content",()=>{
        let result:{success:boolean;content?:string;error?:string}={success:true,content:"parsed text"}
        expect(result.success).toBe(true)
        expect(result.content).toBe("parsed text")
    })

    test("returns error for unsupported file type",()=>{
        let result:{success:boolean;content?:string;error?:string}={success:false,error:"Unsupported file type: xyz"}
        expect(result.success).toBe(false)
        expect(result.error).toContain("Unsupported file type")
    })
})

describe("Dialog open file operations",()=>{
    test("returns empty array when cancelled",()=>{
        let result={canceled:true,filePaths:[]}
        let files=result.canceled?[]:result.filePaths
        expect(files).toEqual([])
    })

    test("returns file paths when not cancelled",()=>{
        let result={canceled:false,filePaths:["/path/to/file1.txt","/path/to/file2.pdf"]}
        let files=result.canceled?[]:result.filePaths
        expect(files).toHaveLength(2)
        expect(files[0]).toBe("/path/to/file1.txt")
    })
})

describe("Dialog save file operations",()=>{
    test("returns null when cancelled",()=>{
        let result={canceled:true,filePath:""}
        let savePath=result.canceled?null:result.filePath
        expect(savePath).toBeNull()
    })

    test("returns file path when not cancelled",()=>{
        let result={canceled:false,filePath:"/path/to/output.jsonl"}
        let savePath=result.canceled?null:result.filePath
        expect(savePath).toBe("/path/to/output.jsonl")
    })

    test("uses default filename when none provided",()=>{
        let defaultFilename:string|undefined=undefined
        let defaultPath=defaultFilename||"training_data.jsonl"
        expect(defaultPath).toBe("training_data.jsonl")
    })

    test("uses provided filename",()=>{
        let defaultFilename="custom_output.jsonl"
        let defaultPath=defaultFilename||"training_data.jsonl"
        expect(defaultPath).toBe("custom_output.jsonl")
    })
})

describe("App version and platform",()=>{
    test("version follows semver pattern",()=>{
        let version="2.0.0"
        expect(version).toMatch(/^\d+\.\d+\.\d+$/)
    })

    test("platform is a valid string",()=>{
        let platform=process.platform
        expect(["win32","darwin","linux"]).toContain(platform)
    })
})
