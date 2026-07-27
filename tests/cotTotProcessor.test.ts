import{describe, it, expect, vi}from"vitest"
import type{Provider, ProviderOptions, ProviderResult}from"../src/renderer/provider.js"
import{
    parseCoTResponse,
    parseToTResponse,
    generateCoT,
    generateToT,
    COT_SYSTEM_PROMPT,
    TOT_SYSTEM_PROMPT
}from"../src/renderer/cotTotProcessor.js"
function makeMockProvider(name:string, response:string, tokens:number=10):Provider{
    return{
        name,
        async generate(prompt:string, model:string, options?:ProviderOptions):Promise<ProviderResult>{
            return{text:response, tokens, provider:name}
        }
    }
}
function makeCapturingProvider(name:string, response:string, tokens:number=10):{provider:Provider, getLastPrompt:()=>string, getLastModel:()=>string, getLastOptions:()=>ProviderOptions|undefined}{
    let lastPrompt=""
    let lastModel=""
    let lastOptions:ProviderOptions|undefined
    let provider:Provider={
        name,
        async generate(prompt:string, model:string, options?:ProviderOptions):Promise<ProviderResult>{
            lastPrompt=prompt
            lastModel=model
            lastOptions=options
            return{text:response, tokens, provider:name}
        }
    }
    return{
        provider,
        getLastPrompt:()=>lastPrompt,
        getLastModel:()=>lastModel,
        getLastOptions:()=>lastOptions
    }
}
describe("parseCoTResponse", ()=>{
    it("extracts reasoning and answer when both tags present", ()=>{
        let response="<reasoning>Step 1 then Step 2</reasoning><answer>42</answer>"
        let result=parseCoTResponse(response)
        expect(result.reasoning).toBe("Step 1 then Step 2")
        expect(result.answer).toBe("42")
        expect(result.rawResponse).toBe(response)
        expect(result.provider).toBe("")
        expect(result.tokens).toBe(0)
    })
    it("puts everything in answer when no tags present", ()=>{
        let response="Just a plain answer with no tags"
        let result=parseCoTResponse(response)
        expect(result.reasoning).toBe("")
        expect(result.answer).toBe("Just a plain answer with no tags")
    })
    it("leaves answer empty when only reasoning tag present", ()=>{
        let response="<reasoning>Thinking through it</reasoning>"
        let result=parseCoTResponse(response)
        expect(result.reasoning).toBe("Thinking through it")
        expect(result.answer).toBe("")
    })
    it("leaves reasoning empty when only answer tag present", ()=>{
        let response="<answer>The final answer</answer>"
        let result=parseCoTResponse(response)
        expect(result.reasoning).toBe("")
        expect(result.answer).toBe("The final answer")
    })
    it("handles multiline content inside tags", ()=>{
        let response="<reasoning>\nLine one\nLine two\nLine three\n</reasoning>\n<answer>\nFinal\n</answer>"
        let result=parseCoTResponse(response)
        expect(result.reasoning).toBe("Line one\nLine two\nLine three")
        expect(result.answer).toBe("Final")
    })
    it("matches tags case-insensitively", ()=>{
        let response="<REASONING>Upper case reasoning</REASONING><ANSWER>Upper case answer</ANSWER>"
        let result=parseCoTResponse(response)
        expect(result.reasoning).toBe("Upper case reasoning")
        expect(result.answer).toBe("Upper case answer")
    })
})
describe("parseToTResponse", ()=>{
    it("builds correct tree from valid JSON", ()=>{
        let response=JSON.stringify({
            branches:[
                {thought:"approach A", score:0.5, sub_branches:[
                    {thought:"refined A", score:0.9, is_solution:true}
                ]},
                {thought:"approach B", score:0.3}
            ]
        })
        let result=parseToTResponse(response, "mock", 20)
        expect(result.provider).toBe("mock")
        expect(result.tokens).toBe(20)
        expect(result.rawResponse).toBe(response)
        expect(result.tree.id).toBe("root")
        expect(result.tree.thought).toBe("")
        expect(result.tree.children).toHaveLength(2)
        expect(result.tree.children[0].thought).toBe("approach A")
        expect(result.tree.children[0].score).toBe(0.5)
        expect(result.tree.children[0].children).toHaveLength(1)
        expect(result.tree.children[0].children[0].thought).toBe("refined A")
        expect(result.tree.children[0].children[0].score).toBe(0.9)
        expect(result.tree.children[0].children[0].isSolution).toBe(true)
        expect(result.tree.children[1].thought).toBe("approach B")
        expect(result.tree.children[1].score).toBe(0.3)
    })
    it("creates fallback node when JSON is invalid", ()=>{
        let response="not valid json at all"
        let result=parseToTResponse(response, "mock", 5)
        expect(result.tree.id).toBe("root")
        expect(result.tree.thought).toBe(response)
        expect(result.tree.children).toEqual([])
        expect(result.tree.score).toBe(0)
        expect(result.tree.isSolution).toBe(false)
        expect(result.bestPath).toEqual([response])
        expect(result.solution).toBe(response)
        expect(result.provider).toBe("mock")
        expect(result.tokens).toBe(5)
    })
    it("finds best path by highest score among children", ()=>{
        let response=JSON.stringify({
            branches:[
                {thought:"low score", score:0.2},
                {thought:"high score", score:0.9},
                {thought:"mid score", score:0.5}
            ]
        })
        let result=parseToTResponse(response)
        expect(result.bestPath[0]).toBe("")
        expect(result.bestPath[1]).toBe("high score")
        expect(result.solution).toBe("high score")
    })
    it("handles nested branches recursively", ()=>{
        let response=JSON.stringify({
            branches:[
                {
                    thought:"root branch A",
                    score:0.4,
                    sub_branches:[
                        {thought:"deep A1", score:0.6, sub_branches:[
                            {thought:"deepest A1a", score:0.95, is_solution:true}
                        ]},
                        {thought:"deep A2", score:0.3}
                    ]
                },
                {thought:"root branch B", score:0.1}
            ]
        })
        let result=parseToTResponse(response)
        expect(result.bestPath).toEqual(["", "root branch A", "deep A1", "deepest A1a"])
        expect(result.solution).toBe("deepest A1a")
    })
    it("identifies solution node and stops descent at solution", ()=>{
        let response=JSON.stringify({
            branches:[
                {thought:"path to solution", score:0.7, is_solution:true, sub_branches:[
                    {thought:"should not be reached", score:0.99}
                ]}
            ]
        })
        let result=parseToTResponse(response)
        expect(result.tree.children[0].isSolution).toBe(true)
        expect(result.bestPath).toEqual(["", "path to solution"])
        expect(result.solution).toBe("path to solution")
    })
    it("handles missing fields gracefully by using defaults", ()=>{
        let response=JSON.stringify({
            branches:[
                {},
                {thought:"only thought"},
                {score:0.8},
                {is_solution:true}
            ]
        })
        let result=parseToTResponse(response)
        expect(result.tree.children).toHaveLength(4)
        expect(result.tree.children[0].thought).toBe("")
        expect(result.tree.children[0].score).toBe(0)
        expect(result.tree.children[0].isSolution).toBe(false)
        expect(result.tree.children[0].children).toEqual([])
        expect(result.tree.children[1].thought).toBe("only thought")
        expect(result.tree.children[1].score).toBe(0)
        expect(result.tree.children[2].thought).toBe("")
        expect(result.tree.children[2].score).toBe(0.8)
        expect(result.tree.children[3].thought).toBe("")
        expect(result.tree.children[3].isSolution).toBe(true)
    })
    it("uses default provider and tokens when not provided", ()=>{
        let response=JSON.stringify({branches:[]})
        let result=parseToTResponse(response)
        expect(result.provider).toBe("")
        expect(result.tokens).toBe(0)
        expect(result.tree.children).toEqual([])
        expect(result.bestPath).toEqual([""])
        expect(result.solution).toBe("")
    })
    it("treats children key as alternative to branches", ()=>{
        let response=JSON.stringify({
            children:[
                {thought:"child A", score:0.4},
                {thought:"child B", score:0.8}
            ]
        })
        let result=parseToTResponse(response)
        expect(result.tree.children).toHaveLength(2)
        expect(result.tree.children[0].thought).toBe("child A")
        expect(result.solution).toBe("child B")
    })
})
describe("findBestPath via parseToTResponse", ()=>{
    it("returns single node for leaf without children", ()=>{
        let response=JSON.stringify({thought:"lonely", score:0.5})
        let result=parseToTResponse(response)
        expect(result.tree.thought).toBe("lonely")
        expect(result.tree.children).toEqual([])
        expect(result.bestPath).toEqual(["lonely"])
        expect(result.solution).toBe("lonely")
    })
    it("returns single node when leaf is solution", ()=>{
        let response=JSON.stringify({
            branches:[
                {thought:"solution leaf", score:0.9, is_solution:true}
            ]
        })
        let result=parseToTResponse(response)
        expect(result.bestPath).toEqual(["", "solution leaf"])
    })
})
describe("generateCoT", ()=>{
    it("calls provider with CoT system prompt and returns parsed result", async()=>{
        let cotResponse="<reasoning>Step by step</reasoning><answer>The answer</answer>"
        let{provider, getLastPrompt, getLastModel, getLastOptions}=makeCapturingProvider("mock-provider", cotResponse, 42)
        let result=await generateCoT(provider, "What is 2+2?", "gpt-4", {temperature:0.5})
        expect(getLastPrompt()).toContain(COT_SYSTEM_PROMPT)
        expect(getLastPrompt()).toContain("What is 2+2?")
        expect(getLastPrompt()).toContain("Question:")
        expect(getLastModel()).toBe("gpt-4")
        expect(getLastOptions()).toEqual({temperature:0.5})
        expect(result.reasoning).toBe("Step by step")
        expect(result.answer).toBe("The answer")
        expect(result.provider).toBe("mock-provider")
        expect(result.tokens).toBe(42)
        expect(result.rawResponse).toBe(cotResponse)
    })
    it("passes options as undefined when not provided", async()=>{
        let cotResponse="<answer>quick</answer>"
        let{provider, getLastOptions}=makeCapturingProvider("mock", cotResponse, 1)
        let result=await generateCoT(provider, "q", "m")
        expect(getLastOptions()).toBeUndefined()
        expect(result.answer).toBe("quick")
        expect(result.tokens).toBe(1)
    })
    it("propagates provider errors", async()=>{
        let provider:Provider={
            name:"failing",
            async generate():Promise<ProviderResult>{
                throw new Error("provider unavailable")
            }
        }
        await expect(generateCoT(provider, "q", "m")).rejects.toThrow("provider unavailable")
    })
})
describe("generateToT", ()=>{
    it("calls provider with ToT system prompt and returns parsed result", async()=>{
        let totResponse=JSON.stringify({
            branches:[
                {thought:"approach", score:0.9, is_solution:true}
            ]
        })
        let{provider, getLastPrompt, getLastModel, getLastOptions}=makeCapturingProvider("tot-provider", totResponse, 99)
        let result=await generateToT(provider, "Solve puzzle", "claude-3", {temperature:0.2, max_tokens:1024})
        expect(getLastPrompt()).toContain(TOT_SYSTEM_PROMPT)
        expect(getLastPrompt()).toContain("Solve puzzle")
        expect(getLastPrompt()).toContain("Question:")
        expect(getLastModel()).toBe("claude-3")
        expect(getLastOptions()).toEqual({temperature:0.2, max_tokens:1024})
        expect(result.provider).toBe("tot-provider")
        expect(result.tokens).toBe(99)
        expect(result.tree.children).toHaveLength(1)
        expect(result.tree.children[0].thought).toBe("approach")
        expect(result.solution).toBe("approach")
        expect(result.bestPath).toEqual(["", "approach"])
    })
    it("passes options as undefined when not provided", async()=>{
        let totResponse=JSON.stringify({branches:[]})
        let{provider, getLastOptions}=makeCapturingProvider("mock", totResponse, 0)
        let result=await generateToT(provider, "q", "m")
        expect(getLastOptions()).toBeUndefined()
        expect(result.tokens).toBe(0)
    })
    it("propagates provider errors", async()=>{
        let provider:Provider={
            name:"failing",
            async generate():Promise<ProviderResult>{
                throw new Error("tot provider failed")
            }
        }
        await expect(generateToT(provider, "q", "m")).rejects.toThrow("tot provider failed")
    })
})
describe("default mock provider", ()=>{
    it("makeMockProvider returns provider with given name and response", async()=>{
        let provider=makeMockProvider("simple", "hello", 7)
        let result=await provider.generate("p", "m")
        expect(result.text).toBe("hello")
        expect(result.tokens).toBe(7)
        expect(result.provider).toBe("simple")
    })
})
