export function parseQAPairs(text:string):{question:string;answer:string}[]{
    if(!text||typeof text!=="string")return[]
    let pairs:{question:string;answer:string}[]=[]
    let lines=text.split("\n")
    let currentQuestion=""
    let currentAnswer=""
    let inAnswer=false
    for(let line of lines){
        let trimmed=line.trim()
        if(trimmed.match(/^question:\s*/i)){
            if(currentQuestion&&currentAnswer){
                pairs.push({question:currentQuestion.trim(),answer:currentAnswer.trim()})
            }
            currentQuestion=trimmed.replace(/^question:\s*/i,"")
            currentAnswer=""
            inAnswer=false
        }
        else if(trimmed.match(/^answer:\s*/i)){
            inAnswer=true
            currentAnswer=trimmed.replace(/^answer:\s*/i,"")
        }
        else if(trimmed){
            if(inAnswer&&currentAnswer){
                currentAnswer+=" "+trimmed
            }
            else if(currentQuestion){
                currentQuestion+=" "+trimmed
            }
        }
    }
    if(currentQuestion&&currentAnswer){
        pairs.push({question:currentQuestion.trim(),answer:currentAnswer.trim()})
    }
    return pairs
}

export function parseConversationTurns(text:string):{user:string;assistant:string}[]{
    if(!text||typeof text!=="string")return[]
    let turns:{user:string;assistant:string}[]=[]
    let lines=text.split("\n")
    let currentUser=""
    let currentAssistant=""
    let inUser=false
    let inAssistant=false
    for(let line of lines){
        let trimmed=line.trim()
        if(trimmed.match(/^user:\s*/i)){
            if(currentUser&&currentAssistant){
                turns.push({user:currentUser.trim(),assistant:currentAssistant.trim()})
            }
            currentUser=trimmed.replace(/^user:\s*/i,"")
            currentAssistant=""
            inUser=true
            inAssistant=false
        }
        else if(trimmed.match(/^assistant:\s*/i)){
            inUser=false
            inAssistant=true
            currentAssistant=trimmed.replace(/^assistant:\s*/i,"")
        }
        else if(trimmed){
            if(inAssistant&&currentAssistant){
                currentAssistant+=" "+trimmed
            }
            else if(inUser&&currentUser){
                currentUser+=" "+trimmed
            }
        }
    }
    if(currentUser&&currentAssistant){
        turns.push({user:currentUser.trim(),assistant:currentAssistant.trim()})
    }
    return turns
}
