import type{Provider, ProviderOptions, ProviderResult}from"./provider.js"
export type ChainStepType='summarize'|'extract'|'transform'|'generate'|'validate'|'custom'
export interface ChainStep{
    id:string
    type:ChainStepType
    promptTemplate:string
    model?:string
    options?:ProviderOptions
    dependsOn?:string[]
    inputTransform?:(input:string, previousResults:Map<string, string>)=>string
    outputTransform?:(output:string)=>string
}
export interface ChainResult{
    stepId:string
    input:string
    output:string
    result:ProviderResult
    durationMs:number
}
export interface ChainExecutionResult{
    steps:ChainResult[]
    finalOutput:string
    totalTokens:number
    totalDurationMs:number
    success:boolean
    error?:string
}
export class PromptChain{
    private steps:ChainStep[]
    constructor(steps:ChainStep[]){
        this.steps=steps
        this.validateChain()
    }
    private validateChain():void{
        let ids=new Set<string>()
        for(let step of this.steps){
            if(ids.has(step.id))throw new Error(`Duplicate step id: ${step.id}`)
            ids.add(step.id)
            if(step.dependsOn){
                for(let dep of step.dependsOn){
                    if(!ids.has(dep))throw new Error(`Step ${step.id} depends on unknown step: ${dep}`)
                }
            }
        }
    }
    getSteps():ChainStep[]{
        return this.steps
    }
    private resolveTemplate(template:string, input:string, previousResults:Map<string, string>):string{
        return template.replace(/\{\{input\}\}/g, input).replace(/\{\{([^}]+)\}\}/g, (match, key)=>{
            let value=previousResults.get(key)
            if(value===undefined){
                return match
            }
            return value
        })
    }
    async executeStep(
        provider:Provider,
        step:ChainStep,
        input:string,
        previousResults:Map<string, string>,
        defaultModel:string
    ):Promise<ChainResult>{
        let resolvedInput=step.inputTransform?step.inputTransform(input, previousResults):input
        let resolvedPrompt=this.resolveTemplate(step.promptTemplate, resolvedInput, previousResults)
        let start=Date.now()
        let result=await provider.generate(resolvedPrompt, step.model||defaultModel, step.options)
        let durationMs=Date.now()-start
        let output=step.outputTransform?step.outputTransform(result.text):result.text
        return{stepId:step.id, input:resolvedInput, output, result, durationMs}
    }
    async execute(
        provider:Provider,
        initialInput:string,
        defaultModel:string
    ):Promise<ChainExecutionResult>{
        let results:ChainResult[]=[]
        let previousResults=new Map<string, string>()
        let currentInput=initialInput
        let totalTokens=0
        let totalDurationMs=0
        let start=Date.now()
        try{
            for(let step of this.steps){
                let chainResult=await this.executeStep(provider, step, currentInput, previousResults, defaultModel)
                results.push(chainResult)
                previousResults.set(step.id, chainResult.output)
                currentInput=chainResult.output
                totalTokens+=chainResult.result.tokens
                totalDurationMs+=chainResult.durationMs
            }
            return{
                steps:results,
                finalOutput:currentInput,
                totalTokens,
                totalDurationMs:Date.now()-start,
                success:true
            }
        }
        catch(error){
            return{
                steps:results,
                finalOutput:currentInput,
                totalTokens,
                totalDurationMs:Date.now()-start,
                success:false,
                error:(error as Error).message
            }
        }
    }
    async executeBatch(
        provider:Provider,
        inputs:string[],
        defaultModel:string,
        maxInputs:number=1000
    ):Promise<ChainExecutionResult[]>{
        let results:ChainExecutionResult[]=[]
        let limit=Math.min(inputs.length, maxInputs)
        for(let i=0;i<limit;i++){
            let result=await this.execute(provider, inputs[i], defaultModel)
            results.push(result)
        }
        return results
    }
}
export function createSimpleChain(steps:{id:string, prompt:string, model?:string}[]):PromptChain{
    return new PromptChain(steps.map(s=>({
        id:s.id,
        type:'custom'as ChainStepType,
        promptTemplate:s.prompt,
        model:s.model
    })))
}
export const COMMON_CHAIN_TEMPLATES:{
    name:string
    description:string
    steps:ChainStep[]
}[]=[
    {
        name:"summarize-then-qa",
        description:"Summarize the text, then generate Q&A from the summary",
        steps:[
            {
                id:"summarize",
                type:"summarize",
                promptTemplate:"Summarize the following text in 3-5 sentences:\n\n{{input}}"
            },
            {
                id:"qa",
                type:"generate",
                promptTemplate:"Based on this summary, generate 3 question-answer pairs in JSON format:\n\n{{summarize}}",
                dependsOn:["summarize"]
            }
        ]
    },
    {
        name:"extract-then-refine",
        description:"Extract key facts, then refine into training format",
        steps:[
            {
                id:"extract",
                type:"extract",
                promptTemplate:"Extract the key facts from the following text as a bullet list:\n\n{{input}}"
            },
            {
                id:"refine",
                type:"transform",
                promptTemplate:"Convert these facts into instruction-output training pairs in JSON format:\n\n{{extract}}",
                dependsOn:["extract"]
            }
        ]
    },
    {
        name:"translate-then-verify",
        description:"Translate text, then verify the translation",
        steps:[
            {
                id:"translate",
                type:"transform",
                promptTemplate:"Translate the following text to English:\n\n{{input}}"
            },
            {
                id:"verify",
                type:"validate",
                promptTemplate:"Verify this translation is accurate and natural. List any issues:\n\nOriginal: {{input}}\nTranslation: {{translate}}",
                dependsOn:["translate"]
            }
        ]
    }
]
