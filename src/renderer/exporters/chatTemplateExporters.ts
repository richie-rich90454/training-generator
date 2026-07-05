import type { TrainingItem, ChatMessage } from "../../types/index.js"
import { Exporter, ExportOptions } from "../exportFormats.js"
export function itemToMessages(item: TrainingItem): ChatMessage[]{
    if(item.messages!=null&&Array.isArray(item.messages)&&item.messages.length>0){
        let valid: ChatMessage[]=[]
        for(let m of item.messages){
            if(m!=null&&typeof m==="object"&&m.role!=null&&m.content!=null){
                let role=m.role
                if(role==="system"||role==="user"||role==="assistant"){
                    valid.push({ role: role, content: String(m.content) })
                }
            }
        }
        return valid
    }
    if(item.instruction!=null||item.input!=null||item.output!=null){
        let messages: ChatMessage[]=[]
        let userContent=""
        if(item.instruction!=null){
            userContent=String(item.instruction)
        }
        if(item.input!=null&&String(item.input).length>0){
            if(userContent.length>0){
                userContent+="\n"
            }
            userContent+=String(item.input)
        }
        if(userContent.length>0){
            messages.push({ role: "user", content: userContent })
        }
        if(item.output!=null){
            messages.push({ role: "assistant", content: String(item.output) })
        }
        return messages
    }
    if(item.text!=null){
        return [{ role: "user", content: String(item.text) }]
    }
    return []
}
export function applyShareGptTemplate(messages: ChatMessage[]): {id: number, conversations: {from: string, value: string}[]}{
    let conversations: {from: string, value: string}[]=[]
    for(let m of messages){
        let from="human"
        if(m.role==="assistant"){
            from="gpt"
        }
        else if(m.role==="system"){
            from="system"
        }
        else if(m.role!=="user"){
            continue
        }
        conversations.push({ from: from, value: m.content })
    }
    return { id: 1, conversations: conversations }
}
export function applyLlama2Template(messages: ChatMessage[]): string{
    let system=""
    let turns=messages
    if(messages.length>0&&messages[0].role==="system"){
        system=messages[0].content
        turns=messages.slice(1)
    }
    let result=""
    if(system.length>0){
        result="<<SYS>>\n"+system+"\n<</SYS>>\n\n"
    }
    let parts: string[]=[]
    for(let i=0;i<turns.length;i+=2){
        let user=turns[i]
        let assistant=turns[i+1]
        if(user!=null&&user.role==="user"&&assistant!=null&&assistant.role==="assistant"){
            parts.push("[INST] "+user.content+" [/INST] "+assistant.content)
        }
        else if(user!=null&&user.role==="user"){
            parts.push("[INST] "+user.content+" [/INST] ")
        }
    }
    result+=parts.join("")
    return result
}
export function applyLlama3Template(messages: ChatMessage[]): string{
    let result="<|begin_of_text|>"
    let system=""
    let turns=messages
    if(messages.length>0&&messages[0].role==="system"){
        system=messages[0].content
        turns=messages.slice(1)
    }
    if(system.length>0){
        result+="<|start_header_id|>system<|end_header_id|>\n\n"+system+"<|eot_id|>"
    }
    for(let i=0;i<turns.length;i+=2){
        let user=turns[i]
        let assistant=turns[i+1]
        if(user!=null&&user.role==="user"&&assistant!=null&&assistant.role==="assistant"){
            result+="<|start_header_id|>user<|end_header_id|>\n\n"+user.content+"<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"+assistant.content+"<|eot_id|>"
        }
        else if(user!=null&&user.role==="user"){
            result+="<|start_header_id|>user<|end_header_id|>\n\n"+user.content+"<|eot_id|>"
        }
    }
    return result
}
export function applyMistralTemplate(messages: ChatMessage[]): string{
    let system=""
    let turns=messages
    if(messages.length>0&&messages[0].role==="system"){
        system=messages[0].content
        turns=messages.slice(1)
    }
    let result=""
    let first=true
    for(let i=0;i<turns.length;i+=2){
        let user=turns[i]
        let assistant=turns[i+1]
        if(user!=null&&user.role==="user"&&assistant!=null&&assistant.role==="assistant"){
            if(first&&system.length>0){
                result+="[INST] "+system+"\n\n"+user.content+" [/INST] "+assistant.content
            }
            else{
                result+="[INST] "+user.content+" [/INST] "+assistant.content
            }
            first=false
        }
        else if(user!=null&&user.role==="user"){
            if(first&&system.length>0){
                result+="[INST] "+system+"\n\n"+user.content+" [/INST] "
            }
            else{
                result+="[INST] "+user.content+" [/INST] "
            }
            first=false
        }
    }
    return result
}
export class ShareGptExporter implements Exporter{
    name="sharegpt"
    mimeType="application/jsonl"
    extension=".jsonl"
    export(items: TrainingItem[], _options?: ExportOptions): string{
        let lines: string[]=[]
        for(let i=0;i<items.length;i++){
            let messages=itemToMessages(items[i])
            if(messages.length===0){
                continue
            }
            let record=applyShareGptTemplate(messages)
            if(record.conversations.length===0){
                continue
            }
            lines.push(JSON.stringify({ id: i+1, conversations: record.conversations }))
        }
        return lines.join("\n")+"\n"
    }
}
export class OpenAIFineTuneExporter implements Exporter{
    name="openai-finetune"
    mimeType="application/jsonl"
    extension=".jsonl"
    export(items: TrainingItem[], _options?: ExportOptions): string{
        let lines: string[]=[]
        for(let item of items){
            let messages=itemToMessages(item)
            if(messages.length===0){
                continue
            }
            let valid: ChatMessage[]=[]
            for(let m of messages){
                if(m.role==="system"||m.role==="user"||m.role==="assistant"){
                    valid.push(m)
                }
            }
            if(valid.length===0){
                continue
            }
            lines.push(JSON.stringify({ messages: valid }))
        }
        return lines.join("\n")+"\n"
    }
}
export class Llama2Exporter implements Exporter{
    name="llama2"
    mimeType="application/jsonl"
    extension=".jsonl"
    export(items: TrainingItem[], _options?: ExportOptions): string{
        let lines: string[]=[]
        for(let item of items){
            let messages=itemToMessages(item)
            if(messages.length===0){
                continue
            }
            lines.push(JSON.stringify({ text: applyLlama2Template(messages) }))
        }
        return lines.join("\n")+"\n"
    }
}
export class Llama3Exporter implements Exporter{
    name="llama3"
    mimeType="application/jsonl"
    extension=".jsonl"
    export(items: TrainingItem[], _options?: ExportOptions): string{
        let lines: string[]=[]
        for(let item of items){
            let messages=itemToMessages(item)
            if(messages.length===0){
                continue
            }
            lines.push(JSON.stringify({ text: applyLlama3Template(messages) }))
        }
        return lines.join("\n")+"\n"
    }
}
export class MistralExporter implements Exporter{
    name="mistral"
    mimeType="application/jsonl"
    extension=".jsonl"
    export(items: TrainingItem[], _options?: ExportOptions): string{
        let lines: string[]=[]
        for(let item of items){
            let messages=itemToMessages(item)
            if(messages.length===0){
                continue
            }
            lines.push(JSON.stringify({ text: applyMistralTemplate(messages) }))
        }
        return lines.join("\n")+"\n"
    }
}
