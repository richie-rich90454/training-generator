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
            return csvEscape(item.messages!=null?JSON.stringify(item.messages):"")
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
                row=csvEscape(item.messages!=null?JSON.stringify(item.messages):"")
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

// Maximum sample size used when estimating total export size. Sampling keeps
// the estimation O(1)-ish regardless of how large the dataset grows.
const ESTIMATE_SAMPLE_SIZE = 50

function byteLength(str: string): number {
    // TextEncoder counts UTF-8 bytes — accurate for multi-byte content
    // (CJK, emoji, etc.) and available in both browser and Node contexts.
    return new TextEncoder().encode(str).length
}

/**
 * Estimate the total byte size of exporting `items` with the given `format`.
 *
 * Samples up to {@link ESTIMATE_SAMPLE_SIZE} items, serializes each with the
 * active exporter, averages the per-item byte count, and scales up to the full
 * dataset. Returns `0` for empty input or unknown formats — callers should
 * render "~0 B" in that case.
 *
 * Notes:
 * - Async exporters are skipped (the default registry only registers sync
 *   exporters, so this is defensive).
 * - Buffer returns are skipped because the renderer context does not define
 *   `Buffer`; only string returns are measured.
 * - A throwing exporter (e.g., malformed item) is caught and contributes 0
 *   bytes to the sample sum.
 */
export function estimateExportSize(items: TrainingItem[], format: string): number {
    if (!items || items.length === 0) return 0
    const exporter = defaultRegistry.get(format)
    if (!exporter) return 0
    const sampleSize = Math.min(ESTIMATE_SAMPLE_SIZE, items.length)
    const sample = items.slice(0, sampleSize)
    let totalSampleBytes = 0
    for (const item of sample) {
        try {
            const result = exporter.export([item])
            if (typeof result === "string") {
                totalSampleBytes += byteLength(result)
            }
            // Skip Buffer and Promise<...> results — sync string output is the
            // only case the renderer can measure without async glue.
        } catch {
            // Defensive: a single malformed item should not zero-out the
            // estimate for the rest of the dataset.
            continue
        }
    }
    if (sampleSize === 0 || totalSampleBytes === 0) return 0
    const avgBytesPerItem = totalSampleBytes / sampleSize
    return Math.round(avgBytesPerItem * items.length)
}
