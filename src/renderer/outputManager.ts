import type{TrainingItem,QAPair,ConversationTurn,ChatMessage}from"../types/index.js"
import{exportJSONL,exportJSONArray,exportCSV}from"./exportFormats.js"
class OutputManager{
    app:any
    outputData:TrainingItem[]
    constructor(app:any){
        this.app=app
        this.outputData=[]
    }
    private getItemText(item:TrainingItem):string{
        if(item.output)return item.output
        if(item.instruction)return item.instruction
        if(item.input)return item.input
        if(item.messages)return item.messages.map(m=>m.content).join(" ")
        if(item.text)return item.text
        return""
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
                            format:"chatml",
                            messages:[
                                {role:"user",content:pair.question},
                                {role:"assistant",content:pair.answer}
                            ]
                        })
                    }
                    else if(format=="text"){
                        items.push({format:"text",text:pair.answer})
                    }
                    else if(format=="csv"){
                        items.push({format:"instruction",input:pair.question,output:pair.answer})
                    }
                    else{
                        items.push({
                            format:"instruction",
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
                    let messages:ChatMessage[]=[]
                    conversationTurns.forEach(turn=>{
                        messages.push({role:"user",content:turn.user})
                        messages.push({role:"assistant",content:turn.assistant})
                    })
                    items.push({format:"chatml",messages})
                }
                else{
                    conversationTurns.forEach(turn=>{
                        if(format=="text"){
                            items.push({format:"text",text:turn.assistant})
                        }
                        else if(format=="csv"){
                            items.push({format:"instruction",input:turn.user,output:turn.assistant})
                        }
                        else{
                            items.push({
                                format:"instruction",
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
                format:"chatml",
                messages:[
                    {role:"user",content:input},
                    {role:"assistant",content:output}
                ]
            })
        }
        else if(format=="text"){
            items.push({format:"text",text:output})
        }
        else if(format=="csv"){
            items.push({format:"instruction",input,output})
        }
        else{
            items.push({
                format:"instruction",
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
        let flushPair=()=>{
            if(currentQuestion||currentAnswer){
                pairs.push({
                    question:currentQuestion.trim(),
                    answer:currentAnswer.trim()
                })
                if(currentQuestion&&!currentAnswer){
                    this.app.addLog("QA pair missing answer; exporting partial pair","warning")
                }
                else if(!currentQuestion&&currentAnswer){
                    this.app.addLog("QA pair missing question; exporting partial pair","warning")
                }
            }
            currentQuestion=""
            currentAnswer=""
            inAnswer=false
        }
        for(let line of lines){
            let trimmedLine=line.trim()
            if(trimmedLine.match(/^question:\s*/i)){
                flushPair()
                currentQuestion=trimmedLine.replace(/^question:\s*/i,"")
            }
            else if(trimmedLine.match(/^answer:\s*/i)){
                inAnswer=true
                currentAnswer=trimmedLine.replace(/^answer:\s*/i,"")
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
        flushPair()
        if(pairs.length==0&&text.length<100000){
            let qaMatches=text.match(/Q:\s*(.*?)\s*A:\s*(.*?)(?=Q:|$)/gis)
            if(qaMatches){
                for(let match of qaMatches){
                    let qMatch=match.match(/Q:\s*(.*?)\s*A:\s*(.*)/is)
                    if(qMatch&&(qMatch[1]||qMatch[2])){
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
    private getFormat(exportFormat?:string):string{
        let format=exportFormat||this.app.uiManager.exportFormat?.value||this.app.uiManager.outputFormat.value
        if(!format||typeof format!=="string")return"jsonl"
        return format
    }
    private extensionForFormat(format:string):string{
        if(format=="jsonl")return".jsonl"
        if(format=="json")return".json"
        if(format=="csv")return".csv"
        if(format=="text")return".txt"
        return".jsonl"
    }
    private dirname(filePath:string):string{
        let idx=filePath.lastIndexOf("/")
        let idx2=filePath.lastIndexOf("\\")
        let sepIdx=Math.max(idx,idx2)
        if(sepIdx<=0)return""
        return filePath.slice(0,sepIdx)
    }
    async exportOutput(exportFormat?:string):Promise<void>{
        if(this.outputData.length==0){
            this.app.addLog("No data to export","warning")
            return
        }
        try{
            let format=this.getFormat(exportFormat)
            let SPLIT_THRESHOLD=100000
            if(this.outputData.length>SPLIT_THRESHOLD){
                let partCount=Math.ceil(this.outputData.length/SPLIT_THRESHOLD)
                this.app.addLog(`Output exceeds ${SPLIT_THRESHOLD} items, splitting into ${partCount} files`,"info")
                let firstPath=await window.electronAPI!.saveFileDialog(`training_data-1${this.extensionForFormat(format)}`)
                if(!firstPath){
                    this.app.addLog("Export cancelled","info")
                    return
                }
                let baseDir=this.dirname(firstPath)
                for(let i=0;i<partCount;i++){
                    let start=i*SPLIT_THRESHOLD
                    let end=Math.min((i+1)*SPLIT_THRESHOLD,this.outputData.length)
                    let partData=this.outputData.slice(start,end)
                    let content=this.formatData(partData,format)
                    let partFilename=`training_data-${i+1}${this.extensionForFormat(format)}`
                    let savePath=baseDir?`${baseDir}/${partFilename}`:partFilename
                    let result=await window.electronAPI!.saveFile(savePath,content)
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
            let defaultFilename=`training_data${this.extensionForFormat(format)}`
            let savePath=await window.electronAPI!.saveFileDialog(defaultFilename)
            if(!savePath){
                this.app.addLog("Export cancelled","info")
                return
            }
            let result=await window.electronAPI!.saveFile(savePath,content)
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
            return exportJSONL(data)
        }
        else if(format=="json"){
            return exportJSONArray(data)
        }
        else if(format=="csv"){
            return exportCSV(data)
        }
        else if(format=="text"){
            return data.map(item=>this.getItemText(item)).join("\n\n")
        }
        return data.map(item=>JSON.stringify(item)).join("\n")
    }
    async copyOutput():Promise<void>{
        if(this.outputData.length==0){
            this.app.addLog("No data to copy","warning")
            return
        }
        try{
            let format=this.getFormat()
            let content=""
            if(format=="jsonl"){
                content=exportJSONL(this.outputData)
            }
            else if(format=="json"){
                content=exportJSONArray(this.outputData)
            }
            else if(format=="csv"){
                content=exportCSV(this.outputData)
            }
            else if(format=="text"){
                content=this.outputData.map(item=>this.getItemText(item)).join("\n\n")
            }
            const MAX_CLIPBOARD_SIZE=5*1024*1024
            if(content.length>MAX_CLIPBOARD_SIZE){
                this.app.addLog(`Output too large to copy (${content.length} chars); use export instead`,"warning")
                return
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
