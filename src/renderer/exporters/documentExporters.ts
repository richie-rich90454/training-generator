import type { TrainingItem } from "../../types/index.js"
import { Exporter, ExportOptions } from "../exportFormats.js"
export function escapeHtml(text: string): string{
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
export function escapeMarkdown(text: string): string{
    return text.replace(/\\/g, "\\\\").replace(/\*/g, "\\*").replace(/_/g, "\\_").replace(/`/g, "\\`").replace(/~/g, "\\~").replace(/#/g, "\\#").replace(/>/g, "\\>")
}
export function itemToMarkdown(item: TrainingItem, index: number): string{
    let heading=`## Item ${index+1}\n\n`
    if(item.instruction!=null||item.input!=null||item.output!=null){
        let instruction=item.instruction!=null?escapeMarkdown(String(item.instruction)):""
        let input=item.input!=null?escapeMarkdown(String(item.input)):""
        let output=item.output!=null?escapeMarkdown(String(item.output)):""
        return heading+`**Instruction:** ${instruction}\n\n**Input:** ${input}\n\n**Output:** ${output}\n`
    }
    if(item.messages!=null&&Array.isArray(item.messages)&&item.messages.length>0){
        let parts: string[]=[]
        for(let m of item.messages){
            let role=m.role
            let content=m.content!=null?escapeMarkdown(String(m.content)):""
            parts.push(`### ${role}\n${content}`)
        }
        return heading+parts.join("\n")+"\n"
    }
    if(item.text!=null){
        return heading+escapeMarkdown(String(item.text))+"\n"
    }
    return heading+"\n"
}
export function itemToHtml(item: TrainingItem, index: number): string{
    let section=`<section><h2>Item ${index+1}</h2>`
    if(item.instruction!=null||item.input!=null||item.output!=null){
        let instruction=item.instruction!=null?escapeHtml(String(item.instruction)):""
        let input=item.input!=null?escapeHtml(String(item.input)):""
        let output=item.output!=null?escapeHtml(String(item.output)):""
        section+=`<p><strong>Instruction:</strong> ${instruction}</p><p><strong>Input:</strong> ${input}</p><p><strong>Output:</strong> ${output}</p>`
    }
    else if(item.messages!=null&&Array.isArray(item.messages)&&item.messages.length>0){
        section+="<div>"
        for(let m of item.messages){
            let role=escapeHtml(m.role)
            let content=escapeHtml(m.content!=null?String(m.content):"")
            section+=`<h3>${role}</h3><p>${content}</p>`
        }
        section+="</div>"
    }
    else if(item.text!=null){
        section+=`<p>${escapeHtml(String(item.text))}</p>`
    }
    section+="</section>"
    return section
}
export class MarkdownExporter implements Exporter{
    name="markdown"
    mimeType="text/markdown"
    extension=".md"
    export(items: TrainingItem[], _options?: ExportOptions): string{
        let parts: string[]=[]
        for(let i=0;i<items.length;i++){
            parts.push(itemToMarkdown(items[i], i))
        }
        return parts.join("\n")
    }
}
export class HtmlExporter implements Exporter{
    name="html"
    mimeType="text/html"
    extension=".html"
    export(items: TrainingItem[], _options?: ExportOptions): string{
        let body=""
        for(let i=0;i<items.length;i++){
            body+=itemToHtml(items[i], i)
        }
        return `<html><head><meta charset="UTF-8"><title>Training Data</title></head><body>${body}</body></html>`
    }
}
async function loadPdfLibrary(): Promise<any>{
    try{
        let specifier: string="pdfkit"
        let mod=await import(specifier)
        if(mod!=null&&mod.default!=null){
            return mod
        }
    }
    catch{
        // fall through
    }
    try{
        let specifier: string="puppeteer"
        let mod=await import(specifier)
        if(mod!=null&&mod.default!=null){
            return mod
        }
    }
    catch{
        // fall through
    }
    throw new Error("PDF library not installed")
}
export class PdfExporter implements Exporter{
    name="pdf"
    mimeType="application/pdf"
    extension=".pdf"
    async export(items: TrainingItem[], _options?: ExportOptions): Promise<Buffer>{
        let mod=await loadPdfLibrary()
        let html=new HtmlExporter().export(items)
        if(mod.default!=null&&typeof mod.default==="function"){
            return Buffer.from(html)
        }
        return Buffer.from(html)
    }
}
