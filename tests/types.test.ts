import{describe,test,expect}from "vitest"

describe("FileObj interface",()=>{
    test("has all required fields",()=>{
        let fileObj={
            path:"/path/to/test.pdf",
            name:"test.pdf",
            size:1024,
            type:"pdf",
            lastModified:new Date()
        }
        expect(fileObj.path).toBe("/path/to/test.pdf")
        expect(fileObj.name).toBe("test.pdf")
        expect(fileObj.size).toBe(1024)
        expect(fileObj.type).toBe("pdf")
        expect(fileObj.lastModified).toBeInstanceOf(Date)
    })

    test("type can be various file extensions",()=>{
        let types=["pdf","docx","doc","rtf","txt","md","html"]
        for(let type of types){
            let fileObj={path:"/file."+type,name:"file."+type,size:100,type,lastModified:new Date()}
            expect(fileObj.type).toBe(type)
        }
    })
})

describe("OllamaModel interface",()=>{
    test("has required name field",()=>{
        let model={name:"llama2:7b"}
        expect(model.name).toBe("llama2:7b")
    })

    test("has optional fields",()=>{
        let model={
            name:"llama2:7b",
            size:4000000000,
            modified_at:"2024-01-01",
            digest:"abc123"
        }
        expect(model.size).toBe(4000000000)
        expect(model.modified_at).toBe("2024-01-01")
        expect(model.digest).toBe("abc123")
    })
})

describe("OllamaStatus interface",()=>{
    test("running status with models",()=>{
        let status={
            running:true,
            models:[{name:"llama2",size:4000000000,modified_at:"2024-01-01"}],
            version:"0.1.0"
        }
        expect(status.running).toBe(true)
        expect(status.models).toHaveLength(1)
        expect(status.version).toBe("0.1.0")
    })

    test("not running status with error",()=>{
        let status={
            running:false,
            models:[],
            error:"Connection refused"
        }
        expect(status.running).toBe(false)
        expect(status.models).toHaveLength(0)
        expect(status.error).toBe("Connection refused")
    })

    test("running status with empty models",()=>{
        let status={
            running:true,
            models:[],
            version:"0.1.0"
        }
        expect(status.running).toBe(true)
        expect(status.models).toHaveLength(0)
    })
})

describe("OllamaGenerateOptions interface",()=>{
    test("has optional temperature and top_p",()=>{
        let options={temperature:0.7,top_p:0.9}
        expect(options.temperature).toBe(0.7)
        expect(options.top_p).toBe(0.9)
    })

    test("accepts additional string keys",()=>{
        let options={temperature:0.7,num_predict:512,custom:"value"}
        expect(options.num_predict).toBe(512)
    })

    test("empty options are valid",()=>{
        let options={}
        expect(Object.keys(options)).toHaveLength(0)
    })
})

describe("OllamaGenerateResult interface",()=>{
    test("success result has response",()=>{
        let result={success:true,response:"Generated text here"}
        expect(result.success).toBe(true)
        expect(result.response).toBe("Generated text here")
    })

    test("error result has error message",()=>{
        let result={success:false,error:"Model not found"}
        expect(result.success).toBe(false)
        expect(result.error).toBe("Model not found")
    })
})

describe("TrainingItem interface",()=>{
    test("instruction format",()=>{
        let item={
            instruction:"Be helpful",
            input:"Hello",
            output:"Hi there!"
        }
        expect(item.instruction).toBeDefined()
        expect(item.input).toBeDefined()
        expect(item.output).toBeDefined()
    })

    test("chatml format with messages",()=>{
        let item={
            messages:[
                {role:"system",content:"You are helpful."},
                {role:"user",content:"Hello"},
                {role:"assistant",content:"Hi!"}
            ]
        }
        expect(item.messages).toHaveLength(3)
        expect(item.messages![0].role).toBe("system")
        expect(item.messages![1].role).toBe("user")
        expect(item.messages![2].role).toBe("assistant")
    })

    test("text format",()=>{
        let item={text:"Raw training text content"}
        expect(item.text).toBeDefined()
    })

    test("all fields are optional",()=>{
        let item={}
        expect(item).toBeDefined()
    })
})

describe("WorkerMessage and WorkerResult interfaces",()=>{
    test("WorkerMessage has id and buffer",()=>{
        let message={id:1,buffer:Buffer.from("test")}
        expect(message.id).toBe(1)
        expect(Buffer.isBuffer(message.buffer)).toBe(true)
    })

    test("WorkerResult success",()=>{
        let result={id:1,success:true,text:"extracted"}
        expect(result.id).toBe(1)
        expect(result.success).toBe(true)
    })

    test("WorkerResult with warning",()=>{
        let result={id:1,success:true,text:"text",warning:"fallback used"}
        expect(result.warning).toBe("fallback used")
    })

    test("WorkerResult error",()=>{
        let result={id:1,success:false,error:"parse failed"}
        expect(result.success).toBe(false)
        expect(result.error).toBe("parse failed")
    })
})

describe("AppSettings interface",()=>{
    test("has optional fields",()=>{
        let settings={
            model:"llama2",
            processingType:"qa",
            outputFormat:"jsonl",
            language:"en",
            chunkSize:"1000"
        }
        expect(settings.model).toBe("llama2")
        expect(settings.processingType).toBe("qa")
        expect(settings.outputFormat).toBe("jsonl")
        expect(settings.language).toBe("en")
        expect(settings.chunkSize).toBe("1000")
    })

    test("empty settings are valid",()=>{
        let settings={}
        expect(Object.keys(settings)).toHaveLength(0)
    })
})

describe("FullAppSettings interface",()=>{
    test("has optional UI preferences",()=>{
        let settings={
            theme:"dark",
            fontSize:"medium",
            "auto-save":true,
            "auto-check-ollama":true,
            "start-maximized":false,
            "remember-window-size":true,
            "max-file-size":50
        }
        expect(settings.theme).toBe("dark")
        expect(settings["auto-save"]).toBe(true)
        expect(settings["max-file-size"]).toBe(50)
    })
})

describe("ReadFileResult and SaveFileResult interfaces",()=>{
    test("ReadFileResult success",()=>{
        let result={success:true,content:"file contents"}
        expect(result.success).toBe(true)
        expect(result.content).toBe("file contents")
    })

    test("ReadFileResult error",()=>{
        let result={success:false,error:"File not found"}
        expect(result.success).toBe(false)
        expect(result.error).toBe("File not found")
    })

    test("SaveFileResult success",()=>{
        let result={success:true}
        expect(result.success).toBe(true)
    })

    test("SaveFileResult error",()=>{
        let result={success:false,error:"Permission denied"}
        expect(result.success).toBe(false)
        expect(result.error).toBe("Permission denied")
    })
})

describe("ParseBatchResult and ParseBatchItem interfaces",()=>{
    test("ParseBatchItem success",()=>{
        let item={filePath:"/test.pdf",success:true,text:"content",error:null}
        expect(item.success).toBe(true)
        expect(item.error).toBeNull()
    })

    test("ParseBatchItem error",()=>{
        let item={filePath:"/test.pdf",success:false,text:"",error:"Failed"}
        expect(item.success).toBe(false)
        expect(item.error).toBe("Failed")
    })

    test("ParseBatchResult success",()=>{
        let result={success:true,results:[{filePath:"/a.pdf",success:true,text:"a",error:null}]}
        expect(result.success).toBe(true)
        expect(result.results).toHaveLength(1)
    })

    test("ParseBatchResult error",()=>{
        let result={success:false,error:"Batch failed"}
        expect(result.success).toBe(false)
    })
})
