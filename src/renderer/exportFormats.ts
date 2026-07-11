import type { TrainingItem } from "../types/index.js"
import { t } from "./i18n.js"
export interface ExportOptions{
    format?: string
    includeMetadata?: boolean
    pretty?: boolean
    [key: string]: unknown
}
export interface Exporter{
    name: string
    mimeType: string
    extension: string
    export(items: TrainingItem[], options?: ExportOptions): Buffer|string|Promise<Buffer|string>
}
export class ExporterRegistry{
    private exporters: Map<string, Exporter>=new Map()
    register(exporter: Exporter): void{
        this.exporters.set(exporter.name, exporter)
    }
    unregister(name: string): void{
        this.exporters.delete(name)
    }
    get(name: string): Exporter|undefined{
        return this.exporters.get(name)
    }
    list(): Exporter[]{
        return Array.from(this.exporters.values())
    }
    export(format: string, items: TrainingItem[], options?: ExportOptions): Buffer|string|Promise<Buffer|string>{
        let exporter=this.exporters.get(format)
        if(!exporter){
            throw new Error(t("error.unsupportedExportFormat", undefined, { format }))
        }
        return exporter.export(items, options)
    }
    getSupportedFormats(): string[]{
        return Array.from(this.exporters.keys())
    }
}
export function exportJSONL(items: TrainingItem[]): string{
    let lines=items.map(item=>JSON.stringify(item))
    return lines.length>0?lines.join("\n")+"\n":""
}
export function exportJSONArray(items: TrainingItem[]): string{
    return JSON.stringify(items, null, 2)
}
export function exportCSV(items: TrainingItem[]): string{
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
export function csvEscape(value: string): string{
    let escaped=value.replace(/"/g,'""')
    if(/^[\=\+\-\@\t\r]/.test(escaped)){
        escaped="'"+escaped
    }
    if(escaped.includes(",")||escaped.includes('"')||escaped.includes("\n")||escaped.includes("\r")){
        return `"${escaped}"`
    }
    return escaped
}
export class JSONLExporter implements Exporter{
    name="jsonl"
    mimeType="application/jsonlines"
    extension=".jsonl"
    export(items: TrainingItem[], _options?: ExportOptions): string{
        return exportJSONL(items)
    }
}
export class JSONArrayExporter implements Exporter{
    name="json"
    mimeType="application/json"
    extension=".json"
    export(items: TrainingItem[], _options?: ExportOptions): string{
        return exportJSONArray(items)
    }
}
export class CSVExporter implements Exporter{
    name="csv"
    mimeType="text/csv"
    extension=".csv"
    export(items: TrainingItem[], options?: ExportOptions): string{
        let includeMetadata=options?.includeMetadata===true
        let validItems=items.filter(item=>item!=null&&typeof item==="object")
        if(validItems.length===0){
            let header="instruction,input,output"
            if(includeMetadata){
                header+=",metadata"
            }
            return "\uFEFF"+header+"\n"
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
        if(includeMetadata){
            header+=",metadata"
        }
        let rows=validItems.map(item=>{
            let row=""
            if(header.startsWith("messages")){
                row=csvEscape(JSON.stringify(item.messages))
            }
            else if(header.startsWith("text")){
                row=csvEscape(item.text!=null?String(item.text):"")
            }
            else{
                let instruction=csvEscape(item.instruction!=null?String(item.instruction):"")
                let input=csvEscape(item.input!=null?String(item.input):"")
                let output=csvEscape(item.output!=null?String(item.output):"")
                row=`${instruction},${input},${output}`
            }
            if(includeMetadata){
                row+=","+csvEscape(JSON.stringify(item.metadata!=null?item.metadata:null))
            }
            return row
        })
        return "\uFEFF"+[header,...rows].join("\n")+"\n"
    }
}
export class TextExporter implements Exporter{
    name="text"
    mimeType="text/plain"
    extension=".txt"
    export(items: TrainingItem[], _options?: ExportOptions): string{
        return items.map(item=>{
            if(item.text){
                return item.text
            }
            if(item.output){
                return item.output
            }
            if(item.messages&&item.messages.length>0){
                return item.messages.map(m=>m.content).join(" ")
            }
            if(item.instruction){
                return item.instruction
            }
            if(item.input){
                return item.input
            }
            return ""
        }).join("\n")
    }
}
export function createDefaultExporterRegistry(): ExporterRegistry{
    let registry=new ExporterRegistry()
    registry.register(new JSONLExporter())
    registry.register(new JSONArrayExporter())
    registry.register(new CSVExporter())
    registry.register(new TextExporter())
    return registry
}
let defaultRegistry=createDefaultExporterRegistry()
export function exportFormat(format: string, items: TrainingItem[], options?: ExportOptions): Buffer|string|Promise<Buffer|string>{
    return defaultRegistry.export(format, items, options)
}
