// @vitest-environment happy-dom
import{describe,test,expect}from "vitest"

interface OllamaModel{
    name:string
    size:number
    modified_at:string
    details:{
        format:string
        family:string
        parameter_size:string
        quantization_level:string
    }
}

interface OllamaStatus{
    running:boolean
    models:OllamaModel[]
    version:string
    error?:string
}

function formatOllamaStatus(status:OllamaStatus):string{
    if(!status.running){
        return `Ollama: Offline${status.error?" - "+status.error:""}`
    }
    let versionText:string=status.version?` (v${status.version})`:""
    return `Ollama: Online${versionText} (${status.models.length} models)`
}

function getModelDisplayName(modelName:string):string{
    return modelName.split(":")[0]
}

function getModelSize(model:OllamaModel):string{
    let bytes:number=model.size
    if(bytes===0) return"0 B"
    let k:number=1024
    let sizes:string[]=["B","KB","MB","GB"]
    let i:number=Math.floor(Math.log(bytes)/Math.log(k))
    return parseFloat((bytes/Math.pow(k,i)).toFixed(2))+" "+sizes[i]
}

function sortModelsBySize(models:OllamaModel[]):OllamaModel[]{
    return[...models].sort((a,b)=>b.size-a.size)
}

describe("Ollama status formatting",()=>{
    test("formats online status with models",()=>{
        let status:OllamaStatus={
            running:true,
            models:[{name:"llama2:7b",size:4000000000,modified_at:"2024-01-01",details:{format:"gguf",family:"llama",parameter_size:"7B",quantization_level:"Q4_0"}}],
            version:"0.1.0"
        }
        let formatted=formatOllamaStatus(status)
        expect(formatted).toContain("Online")
        expect(formatted).toContain("1 models")
        expect(formatted).toContain("v0.1.0")
    })

    test("formats online status without version",()=>{
        let status:OllamaStatus={
            running:true,
            models:[],
            version:""
        }
        let formatted=formatOllamaStatus(status)
        expect(formatted).toContain("Online")
        expect(formatted).toContain("0 models")
        expect(formatted).not.toContain("v")
    })

    test("formats offline status",()=>{
        let status:OllamaStatus={
            running:false,
            models:[],
            version:"",
            error:"Connection refused"
        }
        let formatted=formatOllamaStatus(status)
        expect(formatted).toContain("Offline")
        expect(formatted).toContain("Connection refused")
    })

    test("formats offline status without error",()=>{
        let status:OllamaStatus={
            running:false,
            models:[],
            version:""
        }
        let formatted=formatOllamaStatus(status)
        expect(formatted).toContain("Offline")
        expect(formatted).not.toContain(" - ")
    })

    test("formats multiple models count",()=>{
        let status:OllamaStatus={
            running:true,
            models:[
                {name:"llama2",size:4000000000,modified_at:"2024-01-01",details:{format:"gguf",family:"llama",parameter_size:"7B",quantization_level:"Q4_0"}},
                {name:"mistral",size:4100000000,modified_at:"2024-01-01",details:{format:"gguf",family:"mistral",parameter_size:"7B",quantization_level:"Q4_0"}},
                {name:"codellama",size:4000000000,modified_at:"2024-01-01",details:{format:"gguf",family:"llama",parameter_size:"7B",quantization_level:"Q4_0"}}
            ],
            version:"0.1.0"
        }
        let formatted=formatOllamaStatus(status)
        expect(formatted).toContain("3 models")
    })
})

describe("Model display name",()=>{
    test("extracts base name from tagged model",()=>{
        expect(getModelDisplayName("llama2:7b")).toBe("llama2")
        expect(getModelDisplayName("mistral:instruct")).toBe("mistral")
    })

    test("returns name as-is when no tag",()=>{
        expect(getModelDisplayName("llama2")).toBe("llama2")
    })

    test("handles complex tags",()=>{
        expect(getModelDisplayName("codellama:13b-python")).toBe("codellama")
    })
})

describe("Model size formatting",()=>{
    test("formats model sizes correctly",()=>{
        let model:OllamaModel={name:"test",size:4000000000,modified_at:"2024-01-01",details:{format:"gguf",family:"test",parameter_size:"7B",quantization_level:"Q4_0"}}
        let size=getModelSize(model)
        expect(size).toContain("GB")
    })

    test("handles small models",()=>{
        let model:OllamaModel={name:"test",size:500000,modified_at:"2024-01-01",details:{format:"gguf",family:"test",parameter_size:"7B",quantization_level:"Q4_0"}}
        let size=getModelSize(model)
        expect(size).toContain("KB")
    })

    test("handles zero size",()=>{
        let model:OllamaModel={name:"test",size:0,modified_at:"2024-01-01",details:{format:"gguf",family:"test",parameter_size:"7B",quantization_level:"Q4_0"}}
        let size=getModelSize(model)
        expect(size).toBe("0 B")
    })
})

describe("Model sorting",()=>{
    test("sorts models by size descending",()=>{
        let models:OllamaModel[]=[
            {name:"small",size:1000000,modified_at:"2024-01-01",details:{format:"gguf",family:"test",parameter_size:"1B",quantization_level:"Q4_0"}},
            {name:"large",size:7000000000,modified_at:"2024-01-01",details:{format:"gguf",family:"test",parameter_size:"7B",quantization_level:"Q4_0"}},
            {name:"medium",size:4000000000,modified_at:"2024-01-01",details:{format:"gguf",family:"test",parameter_size:"4B",quantization_level:"Q4_0"}}
        ]
        let sorted=sortModelsBySize(models)
        expect(sorted[0].name).toBe("large")
        expect(sorted[1].name).toBe("medium")
        expect(sorted[2].name).toBe("small")
    })

    test("does not mutate original array",()=>{
        let models:OllamaModel[]=[
            {name:"small",size:1000000,modified_at:"2024-01-01",details:{format:"gguf",family:"test",parameter_size:"1B",quantization_level:"Q4_0"}},
            {name:"large",size:7000000000,modified_at:"2024-01-01",details:{format:"gguf",family:"test",parameter_size:"7B",quantization_level:"Q4_0"}}
        ]
        let sorted=sortModelsBySize(models)
        expect(models[0].name).toBe("small")
        expect(sorted[0].name).toBe("large")
    })

    test("handles empty array",()=>{
        let sorted=sortModelsBySize([])
        expect(sorted).toHaveLength(0)
    })

    test("handles single model",()=>{
        let models:OllamaModel[]=[
            {name:"only",size:1000000,modified_at:"2024-01-01",details:{format:"gguf",family:"test",parameter_size:"1B",quantization_level:"Q4_0"}}
        ]
        let sorted=sortModelsBySize(models)
        expect(sorted).toHaveLength(1)
        expect(sorted[0].name).toBe("only")
    })
})
