import type{Provider, ProviderOptions}from"./provider.js"
export interface ChunkRef{
    index:number
    text:string
    label:string
}
export interface MultiHopQuestion{
    question:string
    answer:string
    hops:number
    sourceChunks:number[]
    reasoning:string
}
export interface MultiHopConfig{
    model:string
    minHops:number
    maxHops:number
    options?:ProviderOptions
}
export const DEFAULT_MULTIHOP_CONFIG:MultiHopConfig={
    model:"gpt-3.5-turbo",
    minHops:2,
    maxHops:4
}
export const MULTIHOP_PROMPT=`You are an expert at creating multi-hop reasoning questions. Given multiple text chunks, create a question that requires information from at least 2 chunks to answer correctly. Respond in JSON format:

{
  "question": "the question that requires cross-chunk reasoning",
  "answer": "the complete answer",
  "hops": number_of_chunks_needed,
  "source_chunks": [list of chunk indices used, 0-based],
  "reasoning": "step-by-step reasoning showing which chunks were used and how"
}`
export function parseMultiHopResponse(response:string):MultiHopQuestion{
    let parsed:{question?:string, answer?:string, hops?:number, source_chunks?:number[], reasoning?:string}
    try{
        parsed=JSON.parse(response)
    }
    catch{
        return{question:response, answer:"", hops:1, sourceChunks:[], reasoning:""}
    }
    return{
        question:parsed.question||"",
        answer:parsed.answer||"",
        hops:parsed.hops||1,
        sourceChunks:parsed.source_chunks||[],
        reasoning:parsed.reasoning||""
    }
}
export function formatChunksForPrompt(chunks:ChunkRef[]):string{
    return chunks.map(c=>`[Chunk ${c.index}] ${c.label}:\n${c.text}`).join("\n\n")
}
export async function generateMultiHopQuestion(
    provider:Provider,
    chunks:ChunkRef[],
    config:MultiHopConfig=DEFAULT_MULTIHOP_CONFIG
):Promise<MultiHopQuestion>{
    if(chunks.length<2)throw new Error("Multi-hop questions require at least 2 chunks")
    let prompt=`${MULTIHOP_PROMPT}\n\nUse between ${config.minHops} and ${config.maxHops} chunks. Ensure the question cannot be answered from a single chunk.\n\n${formatChunksForPrompt(chunks)}`
    let result=await provider.generate(prompt, config.model, config.options)
    return parseMultiHopResponse(result.text)
}
export async function generateMultiHopBatch(
    provider:Provider,
    chunks:ChunkRef[],
    count:number,
    config:MultiHopConfig=DEFAULT_MULTIHOP_CONFIG
):Promise<MultiHopQuestion[]>{
    let questions:MultiHopQuestion[]=[]
    for(let i=0;i<count;i++){
        let question=await generateMultiHopQuestion(provider, chunks, config)
        questions.push(question)
    }
    return questions
}
export function validateMultiHop(question:MultiHopQuestion, minHops:number=2):{valid:boolean, reason:string}{
    if(question.hops<minHops){
        return{valid:false, reason:`Only ${question.hops} hops, minimum is ${minHops}`}
    }
    if(question.sourceChunks.length<minHops){
        return{valid:false, reason:`Only ${question.sourceChunks.length} source chunks, need at least ${minHops}`}
    }
    if(!question.question||!question.answer){
        return{valid:false, reason:"Missing question or answer"}
    }
    if(question.sourceChunks.some(i=>i<0)){
        return{valid:false, reason:"Negative chunk index in sourceChunks"}
    }
    return{valid:true, reason:""}
}
export function selectRandomChunks(chunks:ChunkRef[], count:number, seed?:number):ChunkRef[]{
    if(chunks.length<=count)return chunks
    let rng=seed!==undefined?mulberry32(seed):Math.random
    let indices=[...chunks.keys()]
    let selected:ChunkRef[]=[]
    for(let i=0;i<count&&indices.length>0;i++){
        let r=Math.floor(rng()*indices.length)
        let idx=indices.splice(r, 1)[0]
        selected.push(chunks[idx])
    }
    return selected
}
function mulberry32(seed:number):()=>number{
    let a=seed
    return function(){
        a|=0
        a=a+0x6D2B79F5|0
        let t=Math.imul(a^a>>>15, 1|a)
        t=t+Math.imul(t^t>>>7, 61|t)^t
        return((t^t>>>14)>>>0)/4294967296
    }
}
