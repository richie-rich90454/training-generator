import type { TrainingItem } from "../../types/index.js"
import { Exporter, ExportOptions, csvEscape } from "../exportFormats.js"
export interface AutoMLOptions extends ExportOptions{
    columns?: string[]
    task?: "classification"|"regression"
    systemInstruction?: string
}
export function extractLabel(item: TrainingItem): string{
    let record=item as unknown as Record<string, unknown>
    if (record.output!=null&&record.output!==""){
        return String(record.output)
    }
    if (record.label!=null&&record.label!==""){
        return String(record.label)
    }
    if (record.text!=null&&record.text!==""){
        return String(record.text)
    }
    return ""
}
export function extractText(item: TrainingItem): string{
    let record=item as unknown as Record<string, unknown>
    if (record.instruction!=null&&record.instruction!==""){
        return String(record.instruction)
    }
    if (record.input!=null&&record.input!==""){
        return String(record.input)
    }
    if (record.text!=null&&record.text!==""){
        return String(record.text)
    }
    return ""
}
export function convertToAutomlRow(item: TrainingItem, task?: "classification"|"regression"): {textContent: string, label?: string, value?: number}{
    let textContent=extractText(item)
    let result: {textContent: string, label?: string, value?: number}={
        textContent: textContent
    }
    if (task=="regression"){
        let parsed=parseFloat(extractLabel(item))
        if (!isNaN(parsed)){
            result.value=parsed
        }
    }
    else{
        result.label=extractLabel(item)
    }
    return result
}
export class AutoMLCsvExporter implements Exporter{
    name="automl-csv"
    mimeType="text/csv"
    extension=".csv"
    export(items: TrainingItem[], options?: AutoMLOptions): string{
        let columns=["text", "label"]
        if (options?.columns!=null&&options.columns.length>0){
            columns=options.columns
        }
        let lines: string[]=[]
        lines.push(columns.map(col=>csvEscape(col)).join(","))
        for (let item of items){
            let record=item as unknown as Record<string, unknown>
            let row: Record<string, string>={
                text: extractText(item),
                label: extractLabel(item),
                instruction: record.instruction!=null?String(record.instruction):"",
                input: record.input!=null?String(record.input):"",
                output: record.output!=null?String(record.output):""
            }
            let values=columns.map(col=>{
                let value=row[col]!=null?String(row[col]):""
                return csvEscape(value)
            })
            lines.push(values.join(","))
        }
        return "\uFEFF"+lines.join("\n")+"\n"
    }
}
export class AutoMLJsonlExporter implements Exporter{
    name="automl-jsonl"
    mimeType="application/jsonl"
    extension=".jsonl"
    export(items: TrainingItem[], options?: AutoMLOptions): string{
        let isRegression=options?.task=="regression"
        let lines: string[]=[]
        for (let item of items){
            let text=extractText(item)
            let label=extractLabel(item)
            if (label===""){
                continue
            }
            if (isRegression){
                let parsed=parseFloat(label)
                if (isNaN(parsed)){
                    continue
                }
                let row={
                    textContent: text,
                    regressionAnnotation: {
                        value: parsed
                    }
                }
                lines.push(JSON.stringify(row))
            }
            else{
                let row={
                    textContent: text,
                    classificationAnnotation: {
                        displayName: label
                    }
                }
                lines.push(JSON.stringify(row))
            }
        }
        return lines.join("\n")+(lines.length>0?"\n":"")
    }
}
export class VertexAiExporter implements Exporter{
    name="vertex-ai"
    mimeType="application/jsonl"
    extension=".jsonl"
    export(items: TrainingItem[], options?: AutoMLOptions): string{
        let systemInstruction=options?.systemInstruction
        let hasSystemOverride=systemInstruction!=null&&systemInstruction!==""
        let lines: string[]=[]
        for (let item of items){
            let messages: {role: string, content: string}[]=[]
            if (hasSystemOverride){
                messages.push({ role: "system", content: systemInstruction as string })
            }
            if (item.messages!=null&&item.messages.length>0){
                for (let msg of item.messages){
                    if (msg.role=="system"&&hasSystemOverride){
                        continue
                    }
                    messages.push({ role: msg.role, content: msg.content })
                }
            }
            else{
                messages.push({ role: "user", content: extractText(item) })
                messages.push({ role: "assistant", content: extractLabel(item) })
            }
            lines.push(JSON.stringify({ messages: messages }))
        }
        return lines.join("\n")+(lines.length>0?"\n":"")
    }
}
