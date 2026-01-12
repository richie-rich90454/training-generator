class OutputFormatter{
    parseQuestionAnswerPairs(text){
        if(!text||typeof text!=="string"){
            return [];
        }
        const pairs=[];
        const lines=text.split("\n");
        let currentQuestion="";
        let currentAnswer="";
        let inAnswer=false;
        for(const line of lines){
            const trimmedLine=line.trim();
            if(trimmedLine.match(/^question:?\s*/i)){
                if(currentQuestion&&currentAnswer){
                    pairs.push({
                        question:currentQuestion.trim(),
                        answer:currentAnswer.trim()
                    });
                }
                currentQuestion=trimmedLine.replace(/^question:?\s*/i,"");
                currentAnswer="";
                inAnswer=false;
            }
            else if(trimmedLine.match(/^answer:?\s*/i)){
                inAnswer=true;
                currentAnswer=trimmedLine.replace(/^answer:?\s*/i,"");
            }
            else if(trimmedLine){
                if(inAnswer&&currentAnswer){
                    currentAnswer+=" "+trimmedLine;
                }
                else if(currentQuestion &&!inAnswer){
                    currentQuestion+=" "+trimmedLine;
                }
            }
        }
        if(currentQuestion&&currentAnswer){
            pairs.push({
                question:currentQuestion.trim(),
                answer:currentAnswer.trim()
            });
        }
        if(pairs.length==0){
            const qaMatches=text.match(/Q:\s*(.*?)\s*A:\s*(.*?)(?=Q:|$)/gis);
            if(qaMatches){
                for(const match of qaMatches){
                    const qMatch=match.match(/Q:\s*(.*?)\s*A:\s*(.*)/is);
                    if(qMatch&&qMatch[1]&&qMatch[2]){
                        pairs.push({
                            question:qMatch[1].trim(),
                            answer:qMatch[2].trim()
                        });
                    }
                }
            }
        }
        return pairs;
    }
    parseConversationTurns(text){
        if(!text||typeof text!=="string"){
            return [];
        }
        const turns=[];
        const lines=text.split("\n");
        let currentUser="";
        let currentAssistant="";
        let inUser=false;
        let inAssistant=false;
        for(const line of lines){
            const trimmedLine=line.trim();
            if(trimmedLine.match(/^user:?\s*/i)){
                if(currentUser&&currentAssistant){
                    turns.push({
                        user:currentUser.trim(),
                        assistant:currentAssistant.trim()
                    });
                }
                currentUser=trimmedLine.replace(/^user:?\s*/i,"");
                currentAssistant="";
                inUser=true;
                inAssistant=false;
            }
            else if(trimmedLine.match(/^assistant:?\s*/i)){
                inUser=false;
                inAssistant=true;
                currentAssistant=trimmedLine.replace(/^assistant:?\s*/i,"");
            }
            else if(trimmedLine){
                if(inAssistant&&currentAssistant){
                    currentAssistant+=" "+trimmedLine;
                }
                else if(inUser&&currentUser){
                    currentUser+=" "+trimmedLine;
                }
            }
        }
        if(currentUser&&currentAssistant){
            turns.push({
                user:currentUser.trim(),
                assistant:currentAssistant.trim()
            });
        }
        if(turns.length==0){
            const convMatches=text.match(/Human:\s*(.*?)\s*Assistant:\s*(.*?)(?=Human:|$)/gis);
            if(convMatches){
                for(const match of convMatches){
                    const hMatch=match.match(/Human:\s*(.*?)\s*Assistant:\s*(.*)/is);
                    if(hMatch&&hMatch[1]&&hMatch[2]){
                        turns.push({
                            user:hMatch[1].trim(),
                            assistant:hMatch[2].trim()
                        });
                    }
                }
            }
        }
        return turns;
    }
    createTrainingItems(input,output,processingType,outputFormat){
        const items=[];
        if(processingType=="instruction"){
            const qaPairs=this.parseQuestionAnswerPairs(output);
            if(qaPairs.length>0){
                qaPairs.forEach(pair=>{
                    if(outputFormat=="chatml"){
                        items.push({
                            messages:[
                                {role:"user",content:pair.question},
                                {role:"assistant",content:pair.answer}
                            ]
                        });
                    }
                    else if(outputFormat=="text"){
                        items.push({text:pair.answer});
                    }
                    else if(outputFormat=="csv"){
                        items.push({input:pair.question,output:pair.answer});
                    }
                    else{
                        items.push({
                            instruction:"Answer the question based on the text",
                            input:pair.question,
                            output:pair.answer
                        });
                    }
                });
                return items;
            }
        }
        else if(processingType=="conversation"){
            const conversationTurns=this.parseConversationTurns(output);
            if(conversationTurns.length>0){
                if(outputFormat=="chatml"){
                    const messages=[];
                    conversationTurns.forEach(turn=>{
                        messages.push({role:"user",content:turn.user});
                        messages.push({role:"assistant",content:turn.assistant});
                    });
                    items.push({messages});
                }
                else{
                    conversationTurns.forEach(turn=>{
                        if(outputFormat=="text"){
                            items.push({text:turn.assistant});
                        }
                        else if(outputFormat=="csv"){
                            items.push({input:turn.user,output:turn.assistant});
                        }
                        else{
                            items.push({
                                instruction:"Respond to the user\"s message",
                                input:turn.user,
                                output:turn.assistant
                            });
                        }
                    });
                }
                return items;
            }
        }
        if(outputFormat=="chatml"){
            items.push({
                messages:[
                    {role:"user",content:input},
                    {role:"assistant",content:output}
                ]
            });
        }
        else if(outputFormat=="text"){
            items.push({text:output});
        }
        else if(outputFormat=="csv"){
            items.push({input,output});
        }
        else{
            items.push({
                instruction:processingType=="instruction"?"Answer the question based on the text":"Process the following text",
                input,
                output
            });
        }
        return items;
    }
    formatOutput(data,format){
        if(format=="jsonl"){
            return data.map(item=>JSON.stringify(item)).join("\n");
        }
        else if(format=="json"){
            return JSON.stringify(data,null,2);
        }
        else if(format=="csv"){
            if(data.length==0)return "";
            const headers=["input","output"];
            const rows=data.map(item=>{
                const input=item.input||item.messages?.[0]?.content||"";
                const output=item.output||item.messages?.[1]?.content||item.text||"";
                return `"${input.replace(/"/g,'""')}","${output.replace(/"/g,'""')}"`;
            });
            return headers.join(",")+"\n"+rows.join("\n");
        }
        else if(format=="text"){
            return data.map(item=>item.text||item.output||"").join("\n\n");
        }
        else if(format=="chatml"){
            return JSON.stringify(data,null,2);
        }
        return JSON.stringify(data,null,2);
    }
}
module.exports=OutputFormatter;