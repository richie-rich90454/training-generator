import type{TrainingItem}from"../types/index.js"
export function exportJSONL(items:TrainingItem[]):string{
    return items.map(item=>JSON.stringify(item)).join("\n")+"\n"
}
export function exportJSONArray(items:TrainingItem[]):string{
    return JSON.stringify(items,null,2)
}
export function exportCSV(items:TrainingItem[]):string{
    let validItems=items.filter(item=>item!=null&&typeof item==="object")
    if(validItems.length===0){
        return "\uFEFFinstruction,input,output\n"
    }
    let messagesCount=0
    let textCount=0
    let instructionCount=0
    for(let item of validItems){
        if(item.messages){
            messagesCount++
        }
        else if(item.text){
            textCount++
        }
        else{
            instructionCount++
        }
    }
    let header="instruction,input,output"
    if(messagesCount>validItems.length/2){
        header="messages"
    }
    else if(textCount>validItems.length/2){
        header="text"
    }
    let rows=validItems.map(item=>{
        if(header==="messages"){
            return csvEscape(JSON.stringify(item.messages))
        }
        if(header==="text"){
            return csvEscape(item.text!=null?String(item.text):"")
        }
        let instruction=csvEscape(item.instruction!=null?String(item.instruction):"")
        let input=csvEscape(item.input!=null?String(item.input):"")
        let output=csvEscape(item.output!=null?String(item.output):"")
        return `${instruction},${input},${output}`
    })
    return "\uFEFF"+[header,...rows].join("\n")+"\n"
}
export function csvEscape(value:string):string{
    let escaped=value.replace(/"/g,'""')
    if(/^[\=\+\-\@\t\r]/.test(escaped)){
        escaped="'"+escaped
    }
    if(escaped.includes(",")||escaped.includes('"')||escaped.includes("\n")||escaped.includes("\r")){
        return `"${escaped}"`
    }
    return escaped
}
