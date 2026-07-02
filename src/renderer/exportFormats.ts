import type{TrainingItem}from"../types/index.js"
export function exportJSONL(items:TrainingItem[]):string{
    return items.map(item=>JSON.stringify(item)).join("\n")+"\n"
}
export function exportJSONArray(items:TrainingItem[]):string{
    return JSON.stringify(items,null,2)
}
export function exportCSV(items:TrainingItem[]):string{
    let header="instruction,input,output"
    let rows=items.map(item=>{
        let instruction:string
        let input:string
        let output:string
        if(item.messages){
            instruction=""
            input=""
            output=csvEscape(JSON.stringify(item.messages))
        }
        else if(item.text){
            instruction=""
            input=""
            output=csvEscape(item.text)
        }
        else{
            instruction=csvEscape(item.instruction!=null?String(item.instruction):"")
            input=csvEscape(item.input!=null?String(item.input):"")
            output=csvEscape(item.output!=null?String(item.output):"")
        }
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
