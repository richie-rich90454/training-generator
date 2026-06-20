import nlp from"compromise"

export function semanticChunk(text:string,chunkSize:number=2000,overlap:number=100):string[]{
    if(!text||text.trim().length===0)return[]
    if(text.length<=chunkSize)return[text]

    let sentences=splitSentences(text)
    let chunks:string[]=[]
    let currentChunk=""

    for(let sentence of sentences){
        if(currentChunk.length+sentence.length>chunkSize&&currentChunk.length>0){
            chunks.push(currentChunk.trim())
            if(overlap>0){
                let overlapText=currentChunk.slice(-overlap)
                currentChunk=overlapText+" "+sentence
            }
            else{
                currentChunk=sentence
            }
        }
        else{
            currentChunk+=(currentChunk?" ":"")+sentence
        }
    }
    if(currentChunk.trim().length>0){
        chunks.push(currentChunk.trim())
    }
    return chunks
}

function splitSentences(text:string):string[]{
    try{
        let doc=nlp(text)
        let sentences=doc.sentences().out("array") as string[]
        if(sentences&&sentences.length>0)return sentences
    }
    catch{}
    let result:string[]=[]
    let current=""
    for(let i=0;i<text.length;i++){
        current+=text[i]
        let c=text[i]
        let next=text[i+1]||""
        if((c==="."||c==="!"||c==="?")&&(next===" "||next==="\n"||next==="\r"||i===text.length-1)){
            result.push(current.trim())
            current=""
        }
        else if(c==="\n"&&current.trim().length>0){
            result.push(current.trim())
            current=""
        }
    }
    if(current.trim().length>0){
        result.push(current.trim())
    }
    return result.length>0?result:[text]
}

export function simpleChunk(text:string,chunkSize:number=2000):string[]{
    if(!text||text.trim().length===0)return[]
    if(text.length<=chunkSize)return[text]
    let chunks:string[]=[]
    let start=0
    while(start<text.length){
        let end=start+chunkSize
        if(end<text.length){
            let lastPeriod=text.lastIndexOf(".",end)
            let lastNewline=text.lastIndexOf("\n",end)
            let breakPoint=Math.max(lastPeriod,lastNewline)
            if(breakPoint>start+chunkSize/2){
                end=breakPoint+1
            }
        }
        chunks.push(text.slice(start,end).trim())
        start=end
    }
    return chunks
}