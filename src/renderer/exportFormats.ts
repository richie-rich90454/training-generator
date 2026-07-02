import type{TrainingItem}from"../types/index.js"
export function exportJSONL(items:TrainingItem[]):string{
    return items.map(item=>JSON.stringify(item)).join("\n")
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
            instruction=csvEscape(item.instruction||"")
            input=csvEscape(item.input||"")
            output=csvEscape(item.output||"")
        }
        return `${instruction},${input},${output}`
    })
    return [header,...rows].join("\n")
}
function csvEscape(value:string):string{
    if(value.includes(",")||value.includes('"')||value.includes("\n")){
        return `"${value.replace(/"/g,'""')}"`
    }
    return value
}
