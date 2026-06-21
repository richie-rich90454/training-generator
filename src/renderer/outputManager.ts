import type{TrainingItem,QAPair,ConversationTurn}from"../types/index.js"

class OutputManager{
    app:any
    outputData:TrainingItem[]

    constructor(app:any){
        this.app=app
        this.outputData=[]
    }
    createTrainingItem(input:string,output:string,processingType:string):TrainingItem[]{
        let format=this.app.uiManager.outputFormat.value
        let items:TrainingItem[]=[]
        if(processingType=="instruction"){
            let qaPairs=this.parseQuestionAnswerPairs(output)
            if(qaPairs.length>0){
                qaPairs.forEach(pair=>{
                    if(format=="chatml"){
                        items.push({
                            messages:[
                                {role:"user",content:pair.question},
                                {role:"assistant",content:pair.answer}
                            ]
                        })
                    }
                    else if(format=="text"){
                        items.push({text:pair.answer})
                    }
                    else if(format=="csv"){
                        items.push({input:pair.question,output:pair.answer})
                    }
                    else{
                        items.push({
                            instruction:"Answer the question based on the text",
                            input:pair.question,
                            output:pair.answer
                        })
                    }
                })
                return items
            }
        }
        else if(processingType=="conversation"){
            let conversationTurns=this.parseConversationTurns(output)
            if(conversationTurns.length>0){
                if(format=="chatml"){
                    let messages:Array<{role:string;content:string}>=[]
                    conversationTurns.forEach(turn=>{
                        messages.push({role:"user",content:turn.user})
                        messages.push({role:"assistant",content:turn.assistant})
                    })
                    items.push({messages})
                }
                else{
                    conversationTurns.forEach(turn=>{
                        if(format=="text"){
                            items.push({text:turn.assistant})
                        }
                        else if(format=="csv"){
                            items.push({input:turn.user,output:turn.assistant})
                        }
                        else{
                            items.push({
                                instruction:"Respond to the user's message",
                                input:turn.user,
                                output:turn.assistant
                            })
                        }
                    })
                }
                return items
            }
        }
        if(format=="chatml"){
            items.push({
                messages:[
                    {role:"user",content:input},
                    {role:"assistant",content:output}
                ]
            })
        }
        else if(format=="text"){
            items.push({text:output})
        }
        else if(format=="csv"){
            items.push({input,output})
        }
        else{
            items.push({
                instruction:processingType=="instruction"?"Answer the question based on the text":"Process the following text",
                input:input,
                output:output
            })
        }
        return items
    }
    parseQuestionAnswerPairs(text:string):QAPair[]{
        if(!text||typeof text!=='string'){
            console.warn('parseQuestionAnswerPairs: text is not a string',text)
            return[]
        }
        let pairs:QAPair[]=[]
        let lines=text.split("\n")
        let currentQuestion=""
        let currentAnswer=""
        let inAnswer=false
        for(let line of lines){
            let trimmedLine=line.trim()
            if(trimmedLine.match(/^question:?\s*/i)){
                if(currentQuestion&&currentAnswer){
                    pairs.push({
                        question:currentQuestion.trim(),
                        answer:currentAnswer.trim()
                    })
                }
                currentQuestion=trimmedLine.replace(/^question:?\s*/i,"")
                currentAnswer=""
                inAnswer=false
            }
            else if(trimmedLine.match(/^answer:?\s*/i)){
                inAnswer=true
                currentAnswer=trimmedLine.replace(/^answer:?\s*/i,"")
            }
            else if(trimmedLine){
                if(inAnswer&&currentAnswer){
                    currentAnswer+=" "+trimmedLine
                }
                else if(currentQuestion&&!inAnswer){
                    currentQuestion+=" "+trimmedLine
                }
            }
        }
        if(currentQuestion&&currentAnswer){
            pairs.push({
                question:currentQuestion.trim(),
                answer:currentAnswer.trim()
            })
        }
        if(pairs.length==0&&text.length<100000){
            let qaMatches=text.match(/Q:\s*(.*?)\s*A:\s*(.*?)(?=Q:|$)/gis)
            if(qaMatches){
                for(let match of qaMatches){
                    let qMatch=match.match(/Q:\s*(.*?)\s*A:\s*(.*)/is)
                    if(qMatch&&qMatch[1]&&qMatch[2]){
                        pairs.push({
                            question:qMatch[1].trim(),
                            answer:qMatch[2].trim()
                        })
                    }
                }
            }
        }
        return pairs
    }
    parseConversationTurns(text:string):ConversationTurn[]{
        if(!text||typeof text!=='string'){
            console.warn('parseConversationTurns: text is not a string',text)
            return[]
        }
        let turns:ConversationTurn[]=[]
        let lines=text.split("\n")
        let currentUser=""
        let currentAssistant=""
        let inUser=false
        let inAssistant=false
        for(let line of lines){
            let trimmedLine=line.trim()
            if(trimmedLine.match(/^user:?\s*/i)){
                if(currentUser&&currentAssistant){
                    turns.push({
                        user:currentUser.trim(),
                        assistant:currentAssistant.trim()
                    })
                }
                currentUser=trimmedLine.replace(/^user:?\s*/i,"")
                currentAssistant=""
                inUser=true
                inAssistant=false
            }
            else if(trimmedLine.match(/^assistant:?\s*/i)){
                inUser=false
                inAssistant=true
                currentAssistant=trimmedLine.replace(/^assistant:?\s*/i,"")
            }
            else if(trimmedLine){
                if(inAssistant&&currentAssistant){
                    currentAssistant+=" "+trimmedLine
                }
                else if(inUser&&currentUser){
                    currentUser+=" "+trimmedLine
                }
            }
        }
        if(currentUser&&currentAssistant){
            turns.push({
                user:currentUser.trim(),
                assistant:currentAssistant.trim()
            })
        }
        if(turns.length==0&&text.length<100000){
            let convMatches=text.match(/Human:\s*(.*?)\s*Assistant:\s*(.*?)(?=Human:|$)/gis)
            if(convMatches){
                for(let match of convMatches){
                    let hMatch=match.match(/Human:\s*(.*?)\s*Assistant:\s*(.*)/is)
                    if(hMatch&&hMatch[1]&&hMatch[2]){
                        turns.push({
                            user:hMatch[1].trim(),
                            assistant:hMatch[2].trim()
                        })
                    }
                }
            }
        }
        return turns
    }
    async exportOutput():Promise<void>{
        if(this.outputData.length==0){
            this.app.addLog("No data to export","warning")
            return
        }
        try{
            let format=this.app.uiManager.outputFormat.value
            let SPLIT_THRESHOLD=100000
            if(this.outputData.length>SPLIT_THRESHOLD){
                let partCount=Math.ceil(this.outputData.length/SPLIT_THRESHOLD)
                this.app.addLog(`Output exceeds ${SPLIT_THRESHOLD} items, splitting into ${partCount} files`,"info")
                for(let i=0;i<partCount;i++){
                    let start=i*SPLIT_THRESHOLD
                    let end=Math.min((i+1)*SPLIT_THRESHOLD,this.outputData.length)
                    let partData=this.outputData.slice(start,end)
                    let content=this.formatData(partData,format)
                    let partFilename=`training_data-${i+1}`
                    if(format=="jsonl")partFilename+=".jsonl"
                    else if(format=="json")partFilename+=".json"
                    else if(format=="csv")partFilename+=".csv"
                    else partFilename+=".txt"
                    let savePath=await window.electronAPI.saveFileDialog(partFilename)
                    if(!savePath){
                        this.app.addLog("Export cancelled","info")
                        return
                    }
                    let result=await window.electronAPI.saveFile(savePath,content)
                    if(result.success){
                        this.app.addLog(`Exported part ${i+1}/${partCount} to ${savePath}`,"success")
                    }
                    else{
                        this.app.addLog(`Failed to export part ${i+1}: ${result.error}`,"error")
                        return
                    }
                }
                return
            }
            let content=this.formatData(this.outputData,format)
            let defaultFilename="training_data"
            if(format=="jsonl")defaultFilename+=".jsonl"
            else if(format=="json")defaultFilename+=".json"
            else if(format=="csv")defaultFilename+=".csv"
            else defaultFilename+=".txt"
            let savePath=await window.electronAPI.saveFileDialog(defaultFilename)
            if(!savePath){
                this.app.addLog("Export cancelled","info")
                return
            }
            let result=await window.electronAPI.saveFile(savePath,content)
            if(result.success){
                this.app.addLog(`Exported to ${savePath}`,"success")
            }
            else{
                this.app.addLog(`Failed to export: ${result.error}`,"error")
            }
        }
        catch(error){
            this.app.addLog(`Export failed: ${(error as Error).message}`,"error")
        }
    }
    private formatData(data:TrainingItem[],format:string):string{
        if(format=="jsonl"){
            return data.map(item=>JSON.stringify(item)).join("\n")
        }
        else if(format=="json"){
            return JSON.stringify(data,null,2)
        }
        else if(format=="csv"){
            let headers=["input","output"]
            let rows=data.map(item=>{
                let input=this.app.uiManager.escapeCsvField(item.input||"")
                let output=this.app.uiManager.escapeCsvField(item.output||"")
                if(item.messages){
                    output=JSON.stringify(item.messages).replace(/"/g,'""')
                    if(/^[=+\-@]/.test(output))output="'"+output
                }
                if(item.text){
                    output=this.app.uiManager.escapeCsvField(item.text)
                }
                return `"${input}","${output}"`
            })
            return headers.join(",")+"\n"+rows.join("\n")
        }
        else if(format=="text"){
            return data.map(item=>item.output||"").join("\n\n")
        }
        return data.map(item=>JSON.stringify(item)).join("\n")
    }
    async copyOutput():Promise<void>{
        if(this.outputData.length==0){
            this.app.addLog("No data to copy","warning")
            return
        }
        try{
            let format=this.app.uiManager.outputFormat.value
            let content=""
            if(format=="jsonl"){
                content=this.outputData.map(item=>JSON.stringify(item)).join("\n")
            }
            else if(format=="json"){
                content=JSON.stringify(this.outputData,null,2)
            }
            else if(format=="csv"){
                let headers=["input","output"]
                let rows=this.outputData.map(item=>{
                    let input=this.app.uiManager.escapeCsvField(item.input||"")
                    let output=this.app.uiManager.escapeCsvField(item.output||"")
                    if(item.messages){
                        output=JSON.stringify(item.messages).replace(/"/g,'""')
                        if(/^[=+\-@]/.test(output))output="'"+output
                    }
                    if(item.text){
                        output=this.app.uiManager.escapeCsvField(item.text)
                    }
                    return `"${input}","${output}"`
                })
                content=headers.join(",")+"\n"+rows.join("\n")
            }
            else if(format=="text"){
                content=this.outputData.map(item=>item.output||"").join("\n\n")
            }
            await navigator.clipboard.writeText(content)
            this.app.addLog("Copied to clipboard","success")
        }
        catch(error){
            this.app.addLog(`Failed to copy: ${(error as Error).message}`,"error")
        }
    }
}

export default OutputManager