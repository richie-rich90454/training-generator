export interface FewShotExample{
    input:string
    output:string
    processingType:string
    qualityScore?:number
}
export interface FewShotConfig{
    bufferSize:number
    minQualityScore:number
    maxExamplesPerPrompt:number
    processingType?:string
}
export const DEFAULT_FEW_SHOT_CONFIG:FewShotConfig={
    bufferSize:20,
    minQualityScore:0.7,
    maxExamplesPerPrompt:3
}
export class FewShotBuffer{
    private examples:FewShotExample[]=[]
    private config:FewShotConfig
    constructor(config:FewShotConfig=DEFAULT_FEW_SHOT_CONFIG){
        this.config=config
    }
    add(example:FewShotExample):void{
        if(example.qualityScore!==undefined&&example.qualityScore<this.config.minQualityScore)return
        this.examples.push(example)
        if(this.examples.length>this.config.bufferSize){
            this.examples.shift()
        }
    }
    getExamples(count?:number, processingType?:string):FewShotExample[]{
        let filtered=processingType||this.config.processingType?
            this.examples.filter(e=>e.processingType===(processingType||this.config.processingType)):
            this.examples
        let max=count??this.config.maxExamplesPerPrompt
        let sorted=[...filtered].sort((a, b)=>(b.qualityScore??0)-(a.qualityScore??0))
        return sorted.slice(0, max)
    }
    size():number{
        return this.examples.length
    }
    clear():void{
        this.examples=[]
    }
    setConfig(config:Partial<FewShotConfig>):void{
        this.config={...this.config, ...config}
        if(this.examples.length>this.config.bufferSize){
            this.examples=this.examples.slice(-this.config.bufferSize)
        }
    }
    getConfig():FewShotConfig{
        return this.config
    }
    toJSON():FewShotExample[]{
        return this.examples
    }
    fromJSON(examples:FewShotExample[]):void{
        this.examples=examples.slice(-this.config.bufferSize)
    }
}
export function formatExamplesForPrompt(examples:FewShotExample[]):string{
    if(examples.length===0)return""
    let formatted=examples.map((e, i)=>`Example ${i+1}:\nInput: ${e.input}\nOutput: ${e.output}`).join("\n\n")
    return`Here are some examples of high-quality training data:\n\n${formatted}\n\nNow generate a new training item following the same format and quality.`
}
export function injectExamples(prompt:string, examples:FewShotExample[]):string{
    let formatted=formatExamplesForPrompt(examples)
    if(formatted==="")return prompt
    return`${formatted}\n\n${prompt}`
}
export function createRingBuffer(size:number):FewShotBuffer{
    return new FewShotBuffer({bufferSize:size, minQualityScore:0, maxExamplesPerPrompt:3})
}
