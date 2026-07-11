import { createStore } from "solid-js/store"
import { createSignal, createMemo } from "solid-js"
import type { TrainingItem, QAPair, ConversationTurn, ChatMessage } from "../../types/index.js"
import { exportJSONL, exportJSONArray, exportCSV } from "../exportFormats.js"
import { t } from "../i18n.js"
const SPLIT_THRESHOLD = 100000
const MAX_CLIPBOARD_SIZE = 5 * 1024 * 1024
export type ExportFormat = "jsonl" | "json" | "chatml" | "csv" | "text"
export interface OutputStore {
    outputData: TrainingItem[]
    stagingData: TrainingItem[]
    exportFormat: () => ExportFormat
    setExportFormat: (format: ExportFormat) => void
    hasOutput: () => boolean
    itemCount: () => number
    previewText: () => string
    createTrainingItem: (input: string, output: string, processingType: string, outputFormat: string) => TrainingItem[]
    parseQuestionAnswerPairs: (text: string) => QAPair[]
    parseConversationTurns: (text: string) => ConversationTurn[]
    appendOutput: (items: TrainingItem[]) => void
    clearOutput: () => void
    stageItems: (items: TrainingItem[]) => void
    clearStaging: () => void
    exportOutput: (exportFormat?: string) => Promise<void>
    copyOutput: () => Promise<boolean>
    formatData: (data: TrainingItem[], format: string) => string
    getItemText: (item: TrainingItem) => string
}
export function createOutputStore(): OutputStore {
    const [outputData, setOutputData] = createStore<TrainingItem[]>([])
    const [stagingData, setStagingData] = createStore<TrainingItem[]>([])
    const [exportFormat, setExportFormat] = createSignal<ExportFormat>("jsonl")
    const hasOutput = createMemo(() => outputData.length + stagingData.length > 0)
    const itemCount = createMemo(() => outputData.length + stagingData.length)
    const previewText = createMemo(() => {
        const total = outputData.length + stagingData.length
        if (total === 0) return t("output.empty")
        const combined = [...outputData, ...stagingData]
        const header = t("output.totalItems", undefined, { totalCount: String(total) }) + "\n"
        const items = combined.map((item, i) => {
            const text = getItemText(item)
            return `[${i + 1}] ${text.slice(0, 200)}${text.length > 200 ? "..." : ""}`
        })
        return header + items.join("\n")
    })
    function getItemText(item: TrainingItem): string {
        if (item.output) return item.output
        if (item.instruction) return item.instruction
        if (item.input) return item.input
        if (item.messages) return item.messages.map(m => m.content).join(" ")
        if (item.text) return item.text
        return ""
    }
    function parseQuestionAnswerPairs(text: string): QAPair[] {
        if (!text || typeof text !== "string") {
            console.warn("parseQuestionAnswerPairs: text is not a string", text)
            return []
        }
        const pairs: QAPair[] = []
        const lines = text.split("\n")
        let currentQuestion = ""
        let currentAnswer = ""
        let inAnswer = false
        function flushPair(): void {
            if (currentQuestion || currentAnswer) {
                pairs.push({
                    question: currentQuestion.trim(),
                    answer: currentAnswer.trim()
                })
            }
            currentQuestion = ""
            currentAnswer = ""
            inAnswer = false
        }
        for (const line of lines) {
            const trimmedLine = line.trim()
            if (trimmedLine.match(/^question:\s*/i)) {
                flushPair()
                currentQuestion = trimmedLine.replace(/^question:\s*/i, "")
            }
            else if (trimmedLine.match(/^answer:\s*/i)) {
                inAnswer = true
                currentAnswer = trimmedLine.replace(/^answer:\s*/i, "")
            }
            else if (trimmedLine) {
                if (inAnswer && currentAnswer) {
                    currentAnswer += " " + trimmedLine
                }
                else if (currentQuestion && !inAnswer) {
                    currentQuestion += " " + trimmedLine
                }
            }
        }
        flushPair()
        if (pairs.length === 0 && text.length < 100000) {
            const qaRegex = /Q:\s*([\s\S]*?)\s*A:\s*([\s\S]*?)(?=Q:|$)/gi
            let qaMatch: RegExpExecArray | null
            while ((qaMatch = qaRegex.exec(text)) !== null) {
                if (qaMatch[1] || qaMatch[2]) {
                    pairs.push({
                        question: qaMatch[1].trim(),
                        answer: qaMatch[2].trim()
                    })
                }
            }
        }
        return pairs
    }
    function parseConversationTurns(text: string): ConversationTurn[] {
        if (!text || typeof text !== "string") {
            console.warn("parseConversationTurns: text is not a string", text)
            return []
        }
        const turns: ConversationTurn[] = []
        const lines = text.split("\n")
        let currentUser = ""
        let currentAssistant = ""
        let inUser = false
        let inAssistant = false
        for (const line of lines) {
            const trimmedLine = line.trim()
            if (trimmedLine.match(/^user:?\s*/i)) {
                if (currentUser && currentAssistant) {
                    turns.push({
                        user: currentUser.trim(),
                        assistant: currentAssistant.trim()
                    })
                }
                currentUser = trimmedLine.replace(/^user:?\s*/i, "")
                currentAssistant = ""
                inUser = true
                inAssistant = false
            }
            else if (trimmedLine.match(/^assistant:?\s*/i)) {
                inUser = false
                inAssistant = true
                currentAssistant = trimmedLine.replace(/^assistant:?\s*/i, "")
            }
            else if (trimmedLine) {
                if (inAssistant && currentAssistant) {
                    currentAssistant += " " + trimmedLine
                }
                else if (inUser && currentUser) {
                    currentUser += " " + trimmedLine
                }
            }
        }
        if (currentUser && currentAssistant) {
            turns.push({
                user: currentUser.trim(),
                assistant: currentAssistant.trim()
            })
        }
        if (turns.length === 0 && text.length < 100000) {
            const convRegex = /(Human|User):\s*([\s\S]*?)\s*(Assistant|AI):\s*([\s\S]*?)(?=(?:Human|User):|$)/gi
            let convMatch: RegExpExecArray | null
            while ((convMatch = convRegex.exec(text)) !== null) {
                if (convMatch[2] && convMatch[4]) {
                    turns.push({
                        user: convMatch[2].trim(),
                        assistant: convMatch[4].trim()
                    })
                }
            }
        }
        return turns
    }
    function createTrainingItem(input: string, output: string, processingType: string, outputFormat: string): TrainingItem[] {
        const format = outputFormat
        const items: TrainingItem[] = []
        if (processingType === "instruction") {
            const qaPairs = parseQuestionAnswerPairs(output)
            if (qaPairs.length > 0) {
                for (const pair of qaPairs) {
                    if (format === "chatml") {
                        items.push({
                            format: "chatml",
                            messages: [
                                { role: "user", content: pair.question },
                                { role: "assistant", content: pair.answer }
                            ]
                        })
                    }
                    else if (format === "text") {
                        items.push({ format: "text", text: pair.answer })
                    }
                    else if (format === "csv") {
                        items.push({ format: "instruction", input: pair.question, output: pair.answer })
                    }
                    else {
                        items.push({
                            format: "instruction",
                            instruction: t("training.instruction.question"),
                            input: pair.question,
                            output: pair.answer
                        })
                    }
                }
                return items
            }
        }
        else if (processingType === "conversation") {
            const conversationTurns = parseConversationTurns(output)
            if (conversationTurns.length > 0) {
                if (format === "chatml") {
                    const messages: ChatMessage[] = []
                    for (const turn of conversationTurns) {
                        messages.push({ role: "user", content: turn.user })
                        messages.push({ role: "assistant", content: turn.assistant })
                    }
                    items.push({ format: "chatml", messages })
                }
                else {
                    for (const turn of conversationTurns) {
                        if (format === "text") {
                            items.push({ format: "text", text: turn.assistant })
                        }
                        else if (format === "csv") {
                            items.push({ format: "instruction", input: turn.user, output: turn.assistant })
                        }
                        else {
                            items.push({
                                format: "instruction",
                                instruction: t("training.instruction.conversation"),
                                input: turn.user,
                                output: turn.assistant
                            })
                        }
                    }
                }
                return items
            }
        }
        if (format === "chatml") {
            items.push({
                format: "chatml",
                messages: [
                    { role: "user", content: input },
                    { role: "assistant", content: output }
                ]
            })
        }
        else if (format === "text") {
            items.push({ format: "text", text: output })
        }
        else if (format === "csv") {
            items.push({ format: "instruction", input, output })
        }
        else {
            items.push({
                format: "instruction",
                instruction: processingType === "instruction" ? t("training.instruction.question") : t("training.instruction.default"),
                input,
                output
            })
        }
        return items
    }
    function appendOutput(items: TrainingItem[]): void {
        if (items.length === 0) return
        setOutputData(outputData => [...outputData, ...items])
    }
    function stageItems(items: TrainingItem[]): void {
        if (items.length === 0) return
        setStagingData(stagingData => [...stagingData, ...items])
    }
    function clearStaging(): void {
        setStagingData([])
    }
    function clearOutput(): void {
        setOutputData([])
        setStagingData([])
    }
    function formatData(data: TrainingItem[], format: string): string {
        if (format === "jsonl") return exportJSONL(data)
        else if (format === "json") return exportJSONArray(data)
        else if (format === "chatml") {
            const chatmlItems = data.filter(item => item.format === "chatml")
            return exportJSONArray(chatmlItems.length > 0 ? chatmlItems : data)
        }
        else if (format === "csv") return exportCSV(data)
        else if (format === "text") return data.map(item => getItemText(item)).join("\n\n")
        return data.map(item => JSON.stringify(item)).join("\n")
    }
    function extensionForFormat(format: string): string {
        if (format === "jsonl") return ".jsonl"
        if (format === "json") return ".json"
        if (format === "chatml") return ".json"
        if (format === "csv") return ".csv"
        if (format === "text") return ".txt"
        return ".jsonl"
    }
    function dirname(filePath: string): string {
        const idx = filePath.lastIndexOf("/")
        const idx2 = filePath.lastIndexOf("\\")
        const sepIdx = Math.max(idx, idx2)
        if (sepIdx <= 0) return ""
        return filePath.slice(0, sepIdx)
    }
    async function exportOutput(exportFormatParam?: string): Promise<void> {
        const allData = [...outputData, ...stagingData]
        if (allData.length === 0) return
        const format = exportFormatParam || exportFormat()
        if (allData.length > SPLIT_THRESHOLD) {
            const partCount = Math.ceil(allData.length / SPLIT_THRESHOLD)
            const firstPath = await window.electronAPI!.saveFileDialog(`${t("output.defaultFilename")}-1${extensionForFormat(format)}`)
            if (!firstPath) return
            const baseDir = dirname(firstPath)
            for (let i = 0; i < partCount; i++) {
                const start = i * SPLIT_THRESHOLD
                const end = Math.min((i + 1) * SPLIT_THRESHOLD, allData.length)
                const partData = allData.slice(start, end)
                const content = formatData(partData, format)
                const partFilename = `${t("output.defaultFilename")}-${i + 1}${extensionForFormat(format)}`
                const sep = firstPath.includes("\\") ? "\\" : "/"
                const savePath = baseDir ? `${baseDir}${sep}${partFilename}` : partFilename
                await window.electronAPI!.saveFile(savePath, content)
            }
            return
        }
        const content = formatData(allData, format)
        const defaultFilename = `${t("output.defaultFilename")}${extensionForFormat(format)}`
        const savePath = await window.electronAPI!.saveFileDialog(defaultFilename)
        if (!savePath) return
        await window.electronAPI!.saveFile(savePath, content)
    }
    async function copyOutput(): Promise<boolean> {
        const allData = [...outputData, ...stagingData]
        if (allData.length === 0) return false
        const format = exportFormat()
        let content = formatData(allData, format)
        if (content.length > MAX_CLIPBOARD_SIZE) return false
        await navigator.clipboard.writeText(content)
        return true
    }
    return {
        get outputData() { return outputData },
        get stagingData() { return stagingData },
        exportFormat,
        setExportFormat,
        hasOutput,
        itemCount,
        previewText,
        createTrainingItem,
        parseQuestionAnswerPairs,
        parseConversationTurns,
        appendOutput,
        clearOutput,
        stageItems,
        clearStaging,
        exportOutput,
        copyOutput,
        formatData,
        getItemText
    }
}
