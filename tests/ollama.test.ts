import{describe,test,expect,beforeAll}from "vitest"
import axios from "axios"

let ollamaAvailable:boolean=false

beforeAll(async()=>{
    try{
        await axios.get("http://localhost:11434/api/tags",{timeout:5000})
        ollamaAvailable=true
    }
    catch{
        ollamaAvailable=false
    }
})

describe("Ollama API integration",()=>{
    test.skipIf(()=>!ollamaAvailable)("Ollama is running and responds to tags endpoint",async()=>{
        let response=await axios.get("http://localhost:11434/api/tags",{timeout:5000})
        expect(response.status).toBe(200)
        expect(response.data).toHaveProperty("models")
    })

    test.skipIf(()=>!ollamaAvailable)("Ollama has at least one model available",async()=>{
        let response=await axios.get("http://localhost:11434/api/tags",{timeout:5000})
        let models:unknown[]=response.data.models||[]
        expect(models.length).toBeGreaterThan(0)
    })

    test.skipIf(()=>!ollamaAvailable)("Ollama can generate a response",{timeout:130000},async()=>{
        let tagsResponse=await axios.get("http://localhost:11434/api/tags",{timeout:5000})
        let models:Array<Record<string,unknown>>=tagsResponse.data.models||[]
        expect(models.length).toBeGreaterThan(0)
        let testModel:string=models[0].name as string
        let generateResponse=await axios.post("http://localhost:11434/api/generate",{
            model:testModel,
            prompt:"Hello,how are you?Respond with a short greeting.",
            stream:false,
            options:{
                temperature:0.7,
                top_p:0.9,
                num_predict:50
            }
        },{
            timeout:120000
        })
        expect(generateResponse.data).toHaveProperty("response")
        expect(typeof generateResponse.data.response).toBe("string")
        expect(generateResponse.data.response.length).toBeGreaterThan(0)
    })
})
