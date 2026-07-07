import type { TrainingItem } from "../../types/index.js"
import { Exporter, ExportOptions, exportJSONL } from "../exportFormats.js"
import { t } from "../i18n.js"
import axios from "axios"
export interface DatasetCard{
    name: string
    description: string
    license: string
    language: string[]
    splits?: string[]
    stats: Record<string, unknown>
}
export interface HuggingFaceExportOptions extends ExportOptions{
    name?: string
    description?: string
    license?: string
    language?: string[]
    splits?: string[]
    includeParquet?: boolean
}
export function computeDatasetStats(items: TrainingItem[]): Record<string, unknown>{
    let count=items.length
    let formatCounts: Record<string, number>={}
    let totalInstructionLength=0
    let totalOutputLength=0
    let instructionSamples=0
    let outputSamples=0
    let hasMetadataCount=0
    for(let item of items){
        let format=item.format||"unknown"
        if(formatCounts[format]==null){
            formatCounts[format]=0
        }
        formatCounts[format]++
        if(item.instruction!=null){
            totalInstructionLength+=item.instruction.length
            instructionSamples++
        }
        if(item.output!=null){
            totalOutputLength+=item.output.length
            outputSamples++
        }
        else if(item.text!=null){
            totalOutputLength+=item.text.length
            outputSamples++
        }
        if(item.metadata!=null&&Object.keys(item.metadata).length>0){
            hasMetadataCount++
        }
    }
    let avgInstructionLength=instructionSamples>0?totalInstructionLength/instructionSamples:0
    let avgOutputLength=outputSamples>0?totalOutputLength/outputSamples:0
    return {
        count: count,
        formatCounts: formatCounts,
        avgInstructionLength: avgInstructionLength,
        avgOutputLength: avgOutputLength,
        hasMetadataCount: hasMetadataCount
    }
}
function computeSizeCategory(count: number): string{
    if(count<1000){
        return "n<1K"
    }
    else if(count<10000){
        return "1K<n<10K"
    }
    else if(count<100000){
        return "10K<n<100K"
    }
    else{
        return "100K<n<1M"
    }
}
export function generateDatasetCard(items: TrainingItem[], options?: {name?: string, description?: string, license?: string, language?: string[], splits?: string[], stats?: Record<string, unknown>}): string{
    let stats=options?.stats??computeDatasetStats(items)
    let name=options?.name??t("export.huggingface.defaultName")
    let description=options?.description??t("export.huggingface.defaultDescription")
    let license=options?.license??"mit"
    let language=options?.language??["en"]
    let splits=options?.splits
    let sizeCategory=computeSizeCategory(items.length)
    let lines: string[]=[]
    lines.push("---")
    lines.push("task_categories:")
    lines.push("  - text-generation")
    lines.push("tags:")
    lines.push("  - instruction-following")
    lines.push("language:")
    for(let lang of language){
        lines.push(`  - ${lang}`)
    }
    lines.push(`license: ${license}`)
    lines.push("size_categories:")
    lines.push(`  - ${sizeCategory}`)
    if(splits!=null&&splits.length>0){
        lines.push("splits:")
        for(let split of splits){
            lines.push(`  - ${split}`)
        }
    }
    lines.push("---")
    lines.push(`# ${name}`)
    lines.push("")
    lines.push(description)
    lines.push("")
    lines.push(`## ${t("export.huggingface.datasetStatistics")}`)
    lines.push("")
    lines.push(`- ${t("export.huggingface.statItems", undefined, { count: String(stats.count) })}`)
    lines.push(`- ${t("export.huggingface.statAvgInstructionLength", undefined, { length: String(stats.avgInstructionLength) })}`)
    lines.push(`- ${t("export.huggingface.statAvgOutputLength", undefined, { length: String(stats.avgOutputLength) })}`)
    lines.push(`- ${t("export.huggingface.statItemsWithMetadata", undefined, { count: String(stats.hasMetadataCount) })}`)
    lines.push("")
    lines.push(`## ${t("export.huggingface.usage")}`)
    lines.push("")
    lines.push("```python")
    lines.push("from datasets import load_dataset")
    lines.push("")
    lines.push(`dataset = load_dataset("${name}")`)
    lines.push("```")
    lines.push("")
    lines.push(`## ${t("export.huggingface.citation")}`)
    lines.push("")
    lines.push("```bibtex")
    lines.push("@misc{training_generator_dataset,")
    lines.push(`  title={${name}},`)
    lines.push(`  author={${t("export.huggingface.citationAuthor")}},`)
    lines.push(`  year={${new Date().getFullYear()}},`)
    lines.push("  howpublished={\\url{https://huggingface.co/datasets/}}")
    lines.push("}")
    lines.push("```")
    return lines.join("\n")
}
export async function writeParquet(items: TrainingItem[]): Promise<Buffer>{
    let mod: any
    try{
        mod=await import("parquetjs-lite")
    }
    catch{
        throw new Error(t("error.parquetNotInstalled"))
    }
    if(mod==null||mod.parquet==null){
        throw new Error(t("error.parquetNotInstalled"))
    }
    let ParquetSchema=mod.parquet.ParquetSchema
    let ParquetWriter=mod.parquet.ParquetWriter
    if(ParquetSchema==null||ParquetWriter==null){
        throw new Error(t("error.parquetNotInstalled"))
    }
    let schema=new ParquetSchema({
        format: { type: "UTF8" },
        content: { type: "UTF8" }
    })
    let chunks: Buffer[]=[]
    let writable={
        write(chunk: Buffer): void{
            chunks.push(chunk)
        },
        end(): void{}
    }
    let writer=new ParquetWriter(schema, writable)
    for(let item of items){
        let content=JSON.stringify(item)
        await writer.appendRow({ format: item.format||"unknown", content: content })
    }
    await writer.close()
    return Buffer.concat(chunks)
}
export interface PushToHubOptions{
    token: string
    repoId: string
    jsonl: string
    readme: string
    parquet?: Buffer
}
export async function pushToHub(options: PushToHubOptions): Promise<{repoUrl: string, success: boolean}>{
    let { token, repoId, jsonl, readme, parquet }=options
    let createResponse=await axios.post("https://huggingface.co/api/repos/create", {
        name: repoId,
        type: "dataset",
        private: false
    }, {
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    })
    if(createResponse.status<200||createResponse.status>=300){
        throw new Error(t("error.huggingfaceCreateRepoFailed", undefined, { status: String(createResponse.status) }))
    }
    let files: {name: string, content: string|Buffer}[]=[
        { name: "train.jsonl", content: jsonl },
        { name: "README.md", content: readme }
    ]
    if(parquet!=null){
        files.push({ name: "train.parquet", content: parquet })
    }
    for(let file of files){
        let response=await axios.post(`https://huggingface.co/api/datasets/${repoId}/upload/main/${file.name}`, file.content, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/octet-stream"
            }
        })
        if(response.status<200||response.status>=300){
            throw new Error(t("error.huggingfaceUploadFailed", undefined, { name: file.name, status: String(response.status) }))
        }
    }
    return {
        repoUrl: `https://huggingface.co/datasets/${repoId}`,
        success: true
    }
}
export class HuggingFaceExporter implements Exporter{
    name="huggingface"
    mimeType="application/json"
    extension=".jsonl"
    export(items: TrainingItem[], options?: ExportOptions): string{
        let jsonl=exportJSONL(items)
        let readme=generateDatasetCard(items, options as {name?: string, description?: string, license?: string, language?: string[], splits?: string[], stats?: Record<string, unknown>}|undefined)
        let result={
            jsonl: jsonl,
            readme: readme
        }
        return JSON.stringify(result)
    }
}