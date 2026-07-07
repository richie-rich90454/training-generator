// Framework-agnostic processing orchestrator.
// Reads files (browser File objects or Electron paths), chunks text, delegates LLM
// generation to the processor, and formats/deduplicates results without any UI coupling.
import type { SelectedFile, TrainingItem, ProcessFileResult } from "../../types/index.js"
import type Processor from "../processor.js"
import type PromptManager from "../promptManager.js"
import { simpleChunk } from "../chunker.js"
import { chunkInWorker, dedupInWorker } from "../workers/workerPool.js"
import { t } from "../i18n.js"
export interface OrchestratorSettings {
    model: string
    processingType: string
    outputFormat: string
    language: string
    chunkSize: number
    smartSizing: boolean
}
export interface OrchestratorDeps {
    processor: Processor
    promptManager: PromptManager
    createTrainingItem: (input: string, output: string, processingType: string, outputFormat: string) => TrainingItem[]
    onChunkProcessed?: (index: number, total: number, items: TrainingItem[]) => void
    onChunkFailed?: (index: number, error: string) => void
    onOutputUpdated?: () => void
}
export interface ProcessFileCallbacks {
    onChunkProcessed?: (index: number, total: number, items: TrainingItem[]) => void
    onChunkFailed?: (index: number, error: string) => void
    onOutputUpdated?: () => void
}
export function createOrchestrator(deps: OrchestratorDeps) {
    const { processor, promptManager, createTrainingItem } = deps
    async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => resolve(e.target!.result as ArrayBuffer)
            reader.onerror = () => reject(new Error(t("error.failedToReadFileAsArrayBuffer")))
            reader.readAsArrayBuffer(file)
        })
    }
    async function extractTextFromPDFBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
        const uint8Array = new Uint8Array(arrayBuffer)
        let pdfString = ""
        try {
            pdfString = new TextDecoder("latin1").decode(uint8Array)
        }
        catch {
            pdfString = new TextDecoder("utf-8").decode(uint8Array)
        }
        let extractedText = ""
        const btMatches = pdfString.match(/BT[\s\S]*?ET/g)
        if (btMatches && btMatches.length > 0) {
            for (const match of btMatches) {
                const textMatches = match.match(/T[mdjJ]?\s*\(([^)]+)\)/g)
                if (textMatches) {
                    for (const textMatch of textMatches) {
                        const textContent = textMatch.match(/\(([^)]+)\)/)
                        if (textContent && textContent[1]) {
                            extractedText += textContent[1] + " "
                        }
                    }
                }
            }
        }
        if (extractedText.length < 100) {
            const readableText = new TextDecoder("utf-8").decode(uint8Array.slice(0, Math.min(uint8Array.length, 50000)))
            const textSequences = readableText.match(/[A-Za-z0-9\s.,;:!?()""-]{10,}/g)
            if (textSequences) {
                extractedText = textSequences.join(" ")
            }
        }
        if (extractedText.length < 50) {
            const allText = new TextDecoder("utf-8").decode(uint8Array.slice(0, Math.min(uint8Array.length, 100000)))
            const cleanedText = allText.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim()
            if (cleanedText.length > 100) {
                extractedText = cleanedText
            }
        }
        extractedText = extractedText.replace(/\s+/g, " ").trim()
        if (extractedText.length === 0) {
            throw new Error(t("error.pdfNoText"))
        }
        return extractedText
    }
    async function readFileContent(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onerror = () => reject(new Error(t("error.failedToReadFile")))
            if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
                reader.onload = async (e) => {
                    try {
                        const text = await extractTextFromPDFBuffer(e.target!.result as ArrayBuffer)
                        resolve(text)
                    }
                    catch (error) {
                        reject(error)
                    }
                }
                reader.readAsArrayBuffer(file)
            }
            else {
                reader.onload = (e) => resolve(e.target!.result as string)
                reader.readAsText(file)
            }
        })
    }
    async function generatePrompt(text: string, processingType: string, language: string): Promise<string> {
        const loadedPrompt = await promptManager.getPromptWithFallback(language, processingType)
        if (loadedPrompt) {
            return loadedPrompt.replace("{{text}}", text)
        }
        const key: `prompt.system.${string}` = `prompt.system.${processingType}` as `prompt.system.${string}`
        let prompt = t(key, language)
        if (prompt === key) {
            prompt = t("prompt.system.instruction", language)
        }
        return prompt.replace("{{text}}", text)
    }
    async function processFile(fileObj: SelectedFile, settings: OrchestratorSettings, callbacks?: ProcessFileCallbacks): Promise<ProcessFileResult> {
        try {
            let textContent = ""
            if (fileObj.file && fileObj.file instanceof File) {
                textContent = await readFileContent(fileObj.file)
            }
            else if (fileObj.path) {
                const result = await window.electronAPI!.parseFile(fileObj.path, fileObj.type)
                if (!result.success) {
                    throw new Error(result.error || "")
                }
                textContent = result.content!
            }
            else {
                throw new Error(t("error.noFileOrPath"))
            }
            if (!textContent || textContent.trim().length === 0) {
                throw new Error(t("error.noTextContent"))
            }
            const chunkSize = Math.min(10000, Math.max(500, settings.chunkSize || 8000))
            let chunks = await chunkInWorker(textContent, chunkSize, 100, settings.smartSizing)
            if (chunks.length === 0) {
                chunks = simpleChunk(textContent, chunkSize)
            }
            if (chunks.length === 0) {
                throw new Error(t("error.noChunksCreated"))
            }
            const model = settings.model || ""
            const processingType = settings.processingType || "instruction"
            const processedChunks = await processor.processChunks(
                chunks,
                model,
                processingType,
                (text: string, type: string) => generatePrompt(text, type, settings.language || "en"),
                (input: string, output: string, type: string) => createTrainingItem(input, output, type, settings.outputFormat || "jsonl"),
                (index: number, total: number, items: TrainingItem[]) => {
                    callbacks?.onChunkProcessed?.(index, total, items)
                },
                (index: number, error: string) => {
                    callbacks?.onChunkFailed?.(index, error)
                }
            )
            const { items, removed } = await dedupInWorker(processedChunks)
            if (removed > 0) {
                callbacks?.onOutputUpdated?.()
            }
            return { success: true, data: items }
        }
        catch (error) {
            return { success: false, error: (error as Error).message || t("error.failedToProcessFile") }
        }
    }
    return {
        readFileAsArrayBuffer,
        extractTextFromPDFBuffer,
        readFileContent,
        generatePrompt,
        processFile
    }
}
