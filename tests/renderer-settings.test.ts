// @vitest-environment happy-dom
import{describe,test,expect,beforeEach}from "vitest"

// Default settings matching the renderer
interface AppSettings{
    model:string
    temperature:number
    topP:number
    chunkSize:number
    overlap:number
    outputFormat:string
    trainingFormat:string
    language:string
    customPrompt:string
    maxTokens:number
}

function getDefaultSettings():AppSettings{
    return{
        model:"llama2",
        temperature:0.7,
        topP:0.9,
        chunkSize:1000,
        overlap:100,
        outputFormat:"jsonl",
        trainingFormat:"instruction",
        language:"en",
        customPrompt:"",
        maxTokens:2048
    }
}

function validateSettings(settings:Partial<AppSettings>):AppSettings{
    let defaults=getDefaultSettings()
    let merged={...defaults,...settings}
    // Validate ranges
    if(merged.temperature<0) merged.temperature=0
    if(merged.temperature>2) merged.temperature=2
    if(merged.topP<0) merged.topP=0
    if(merged.topP>1) merged.topP=1
    if(merged.chunkSize<100) merged.chunkSize=100
    if(merged.overlap<0) merged.overlap=0
    if(merged.overlap>=merged.chunkSize) merged.overlap=merged.chunkSize-1
    if(merged.maxTokens<1) merged.maxTokens=1
    return merged
}

describe("getDefaultSettings",()=>{
    test("returns complete settings object",()=>{
        let settings=getDefaultSettings()
        expect(settings).toHaveProperty("model")
        expect(settings).toHaveProperty("temperature")
        expect(settings).toHaveProperty("topP")
        expect(settings).toHaveProperty("chunkSize")
        expect(settings).toHaveProperty("overlap")
        expect(settings).toHaveProperty("outputFormat")
        expect(settings).toHaveProperty("trainingFormat")
        expect(settings).toHaveProperty("language")
        expect(settings).toHaveProperty("customPrompt")
        expect(settings).toHaveProperty("maxTokens")
    })

    test("has valid default values",()=>{
        let settings=getDefaultSettings()
        expect(settings.temperature).toBeGreaterThanOrEqual(0)
        expect(settings.temperature).toBeLessThanOrEqual(2)
        expect(settings.topP).toBeGreaterThanOrEqual(0)
        expect(settings.topP).toBeLessThanOrEqual(1)
        expect(settings.chunkSize).toBeGreaterThan(0)
        expect(settings.overlap).toBeLessThan(settings.chunkSize)
        expect(settings.maxTokens).toBeGreaterThan(0)
    })
})

describe("validateSettings",()=>{
    test("fills in missing values with defaults",()=>{
        let validated=validateSettings({})
        expect(validated.model).toBe("llama2")
        expect(validated.temperature).toBe(0.7)
    })

    test("preserves valid custom values",()=>{
        let validated=validateSettings({temperature:1.5,model:"mistral"})
        expect(validated.temperature).toBe(1.5)
        expect(validated.model).toBe("mistral")
    })

    test("clamps temperature below 0",()=>{
        let validated=validateSettings({temperature:-1})
        expect(validated.temperature).toBe(0)
    })

    test("clamps temperature above 2",()=>{
        let validated=validateSettings({temperature:5})
        expect(validated.temperature).toBe(2)
    })

    test("clamps topP below 0",()=>{
        let validated=validateSettings({topP:-0.5})
        expect(validated.topP).toBe(0)
    })

    test("clamps topP above 1",()=>{
        let validated=validateSettings({topP:1.5})
        expect(validated.topP).toBe(1)
    })

    test("clamps chunkSize below 100",()=>{
        let validated=validateSettings({chunkSize:50})
        expect(validated.chunkSize).toBe(100)
    })

    test("clamps overlap below 0",()=>{
        let validated=validateSettings({overlap:-10})
        expect(validated.overlap).toBe(0)
    })

    test("clamps overlap when >= chunkSize",()=>{
        let validated=validateSettings({chunkSize:500,overlap:500})
        expect(validated.overlap).toBe(499)
    })

    test("clamps maxTokens below 1",()=>{
        let validated=validateSettings({maxTokens:0})
        expect(validated.maxTokens).toBe(1)
    })

    test("handles multiple invalid values",()=>{
        let validated=validateSettings({temperature:-1,topP:2,chunkSize:10,overlap:-5,maxTokens:0})
        expect(validated.temperature).toBe(0)
        expect(validated.topP).toBe(1)
        expect(validated.chunkSize).toBe(100)
        expect(validated.overlap).toBe(0)
        expect(validated.maxTokens).toBe(1)
    })
})

describe("Settings persistence",()=>{
    beforeEach(()=>{
        localStorage.clear()
    })

    test("saves and loads settings from localStorage",()=>{
        let settings=getDefaultSettings()
        localStorage.setItem("appSettings",JSON.stringify(settings))
        let loaded=JSON.parse(localStorage.getItem("appSettings")||"{}")
        expect(loaded.model).toBe(settings.model)
        expect(loaded.temperature).toBe(settings.temperature)
    })

    test("handles missing localStorage gracefully",()=>{
        let loaded=JSON.parse(localStorage.getItem("nonexistent")||"null")
        expect(loaded).toBeNull()
    })

    test("handles corrupted localStorage data",()=>{
        localStorage.setItem("appSettings","not valid json")
        try{
            JSON.parse(localStorage.getItem("appSettings")||"null")
        }
        catch(e){
            expect(e).toBeInstanceOf(SyntaxError)
        }
    })
})
