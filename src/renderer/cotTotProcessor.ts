import type{Provider, ProviderOptions, ProviderResult}from"./provider.js"
const MAX_TREE_DEPTH=10
export interface CoTResult{
    reasoning:string
    answer:string
    rawResponse:string
    provider:string
    tokens:number
}
export interface ToTNode{
    id:string
    thought:string
    children:ToTNode[]
    score:number
    isSolution:boolean
}
export interface ToTResult{
    tree:ToTNode
    bestPath:string[]
    solution:string
    rawResponse:string
    provider:string
    tokens:number
}
export const COT_SYSTEM_PROMPT=`You are an expert reasoning assistant. For each question, first provide step-by-step reasoning inside <reasoning> tags, then provide the final answer inside <answer> tags. Example:

<reasoning>
1. First, I need to understand what is being asked...
2. Then, I can apply the formula...
3. Therefore, the answer is...
</reasoning>
<answer>
The final answer
</answer>`
export const TOT_SYSTEM_PROMPT=`You are an expert reasoning assistant using Tree of Thoughts. Generate multiple thought branches, evaluate each, and select the best path to the solution. Format your response as JSON:

{
  "branches": [
    {
      "thought": "Initial approach",
      "score": 0.8,
      "sub_branches": [
        {
          "thought": "Refined approach",
          "score": 0.9,
          "sub_branches": [
            {
              "thought": "Final solution",
              "score": 0.95,
              "is_solution": true
            }
          ]
        }
      ]
    }
  ]
}`
export function parseCoTResponse(response:string):CoTResult{
    let reasoning=""
    let answer=""
    let reasoningMatch=response.match(/<reasoning>([\s\S]*?)<\/reasoning>/i)
    if(reasoningMatch)reasoning=reasoningMatch[1].trim()
    let answerMatch=response.match(/<answer>([\s\S]*?)<\/answer>/i)
    if(answerMatch)answer=answerMatch[1].trim()
    if(!reasoning&&!answer){
        answer=response.trim()
    }
    return{reasoning, answer, rawResponse:response, provider:"", tokens:0}
}
export function parseToTResponse(response:string, providerName:string="", tokens:number=0):ToTResult{
    let parsed:unknown
    try{
        parsed=JSON.parse(response)
    }
    catch{
        let fallback:ToTNode={id:"root", thought:response, children:[], score:0, isSolution:false}
        return{tree:fallback, bestPath:[response], solution:response, rawResponse:response, provider:providerName, tokens}
    }
    let tree=buildToTNode(parsed as Record<string, unknown>, "root")
    let bestPath=findBestPath(tree)
    let solution=bestPath.length>0?bestPath[bestPath.length-1]:""
    let solutionNode=findNodeByText(tree, solution)
    return{tree, bestPath, solution, rawResponse:response, provider:providerName, tokens}
}
function buildToTNode(data:Record<string, unknown>, id:string, depth:number=0):ToTNode{
    let thought=String(data.thought||"")
    let score=Number(data.score)||0
    let isSolution=Boolean(data.is_solution||data.isSolution)
    let children:ToTNode[]=[]
    if(depth<MAX_TREE_DEPTH){
        let branches=data.branches||data.sub_branches||data.children
        if(Array.isArray(branches)){
            children=branches.map((b:Record<string, unknown>, i:number)=>buildToTNode(b, `${id}-${i}`, depth+1))
        }
    }
    return{id, thought, children, score, isSolution}
}
function findBestPath(node:ToTNode, depth:number=0):string[]{
    if(node.isSolution||node.children.length===0||depth>=MAX_TREE_DEPTH){
        return[node.thought]
    }
    let bestChildPath:string[]=[]
    let bestScore=-1
    for(let child of node.children){
        let childPath=findBestPath(child, depth+1)
        let childScore=child.score
        if(childScore>bestScore){
            bestScore=childScore
            bestChildPath=childPath
        }
    }
    return[node.thought, ...bestChildPath]
}
function findNodeByText(node:ToTNode, text:string, depth:number=0):ToTNode|null{
    if(node.thought===text)return node
    if(depth>=MAX_TREE_DEPTH)return null
    for(let child of node.children){
        let found=findNodeByText(child, text, depth+1)
        if(found)return found
    }
    return null
}
export async function generateCoT(
    provider:Provider,
    question:string,
    model:string,
    options?:ProviderOptions
):Promise<CoTResult>{
    let prompt=`${COT_SYSTEM_PROMPT}\n\nQuestion: ${question}`
    let result=await provider.generate(prompt, model, options)
    let parsed=parseCoTResponse(result.text)
    parsed.provider=result.provider
    parsed.tokens=result.tokens
    return parsed
}
export async function generateToT(
    provider:Provider,
    question:string,
    model:string,
    options?:ProviderOptions
):Promise<ToTResult>{
    let prompt=`${TOT_SYSTEM_PROMPT}\n\nQuestion: ${question}`
    let result=await provider.generate(prompt, model, options)
    return parseToTResponse(result.text, result.provider, result.tokens)
}
