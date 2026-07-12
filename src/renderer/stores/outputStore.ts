import { createStore } from "solid-js/store"
import { createSignal, createMemo } from "solid-js"
import type { TrainingItem, QAPair, ConversationTurn, ChatMessage } from "../../types/index.js"
import { exportJSONL, exportJSONArray, exportCSV } from "../exportFormats.js"
import { t } from "../i18n.js"
const SPLIT_THRESHOLD = 100000
const MAX_CLIPBOARD_SIZE = 5 * 1024 * 1024
function trimBlockFiller(block: string, answerLabel: string): string {
    const lines = block.split("\n")
    const result: string[] = []
    let inAnswer = false
    const answerRe = new RegExp("^" + answerLabel + ":?\\s*", "i")
    for (const line of lines) {
        const trimmed = line.trim()
        if (answerRe.test(trimmed)) {
            inAnswer = true
            result.push(line)
        }
        else if (inAnswer) {
            // Keep ALL lines after the answer label (including blank lines) —
            // the block boundary is already delimited by stripFillerBetweenPairs.
            result.push(line)
        }
        else {
            result.push(line)
        }
    }
    return result.join("\n").trim()
}
function stripFillerBetweenPairs(text: string): string {
    if (!text || typeof text !== "string") return text
    const qaRegex = /Question:[\s\S]*?Answer:[\s\S]*?(?=Question:|$)/gi
    const qaMatches = text.match(qaRegex)
    if (qaMatches && qaMatches.length > 0) {
        return qaMatches.map(b => trimBlockFiller(b, "Answer")).filter(Boolean).join("\n\n")
    }
    const convRegex = /(?:User|Human):[\s\S]*?Assistant:[\s\S]*?(?=(?:User|Human):|$)/gi
    const convMatches = text.match(convRegex)
    if (convMatches && convMatches.length > 0) {
        return convMatches.map(b => trimBlockFiller(b, "Assistant")).filter(Boolean).join("\n\n")
    }
    return text
}
function normalizePairSeparators(text: string): string {
    if (!text || typeof text !== "string") return text
    // Split "Question: <q> Answer: <a>" on a single line into two lines
    let normalized = text.replace(/^(Question:.*?)([ \t]+Answer:[ \t]*)(.*)$/gm, "$1\nAnswer: $3")
    // Split "User: <u> Assistant: <a>" on a single line into two lines
    normalized = normalized.replace(/^(User:.*?)([ \t]+Assistant:[ \t]*)(.*)$/gm, "$1\nAssistant: $3")
    // Also handle "Human:" variant
    normalized = normalized.replace(/^(Human:.*?)([ \t]+Assistant:[ \t]*)(.*)$/gm, "$1\nAssistant: $3")
    return normalized
}
function deduplicatePairs(pairs: QAPair[]): QAPair[] {
    const seen = new Set<string>()
    const result: QAPair[] = []
    for (const pair of pairs) {
        const key = pair.question.trim().toLowerCase()
        if (!seen.has(key)) {
            seen.add(key)
            result.push(pair)
        }
    }
    return result
}
function deduplicateTurns(turns: ConversationTurn[]): ConversationTurn[] {
    const seen = new Set<string>()
    const result: ConversationTurn[] = []
    for (const turn of turns) {
        const key = turn.user.trim().toLowerCase()
        if (!seen.has(key)) {
            seen.add(key)
            result.push(turn)
        }
    }
    return result
}
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
        const stagingTotal = stagingData.length
        // Prefer staging data during processing to avoid duplicates
        // (items are staged per-chunk, then appended to output on file complete)
        const data = stagingTotal > 0 ? stagingData : outputData
        const total = data.length
        if (total === 0) return t("output.empty")
        const header = t("output.totalItems", undefined, { totalCount: String(total) }) + "\n"
        const items = data.map((item, i) => {
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
        text = normalizePairSeparators(text)
        const pairs: QAPair[] = []
        const lines = text.split("\n")
        let currentQuestion = ""
        let currentAnswer = ""
        let inAnswer = false
        let answerComplete = false
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
            answerComplete = false
        }
        for (const line of lines) {
            const trimmedLine = line.trim()
            if (trimmedLine.match(/^question:\s*/i)) {
                flushPair()
                currentQuestion = trimmedLine.replace(/^question:\s*/i, "")
            }
            else if (trimmedLine.match(/^answer:\s*/i)) {
                inAnswer = true
                answerComplete = false
                currentAnswer = trimmedLine.replace(/^answer:\s*/i, "")
            }
            else if (trimmedLine) {
                if (inAnswer && !answerComplete && currentAnswer) {
                    currentAnswer += " " + trimmedLine
                }
                else if (currentQuestion && !inAnswer) {
                    currentQuestion += " " + trimmedLine
                }
                // Once the answer is complete, non-Question: lines are filler and discarded
            }
            else {
                // Blank line: once we have answer content, mark the answer as complete
                if (inAnswer && currentAnswer) {
                    answerComplete = true
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
        return deduplicatePairs(pairs)
    }
    function parseConversationTurns(text: string): ConversationTurn[] {
        if (!text || typeof text !== "string") {
            console.warn("parseConversationTurns: text is not a string", text)
            return []
        }
        text = normalizePairSeparators(text)
        const turns: ConversationTurn[] = []
        const lines = text.split("\n")
        let currentUser = ""
        let currentAssistant = ""
        let inUser = false
        let inAssistant = false
        let assistantComplete = false
        for (const line of lines) {
            const trimmedLine = line.trim()
            if (trimmedLine.match(/^user:?\s*/i)) {
                if (currentUser) {
                    turns.push({
                        user: currentUser.trim(),
                        assistant: currentAssistant.trim()
                    })
                }
                currentUser = trimmedLine.replace(/^user:?\s*/i, "")
                currentAssistant = ""
                inUser = true
                inAssistant = false
                assistantComplete = false
            }
            else if (trimmedLine.match(/^assistant:?\s*/i)) {
                inUser = false
                inAssistant = true
                assistantComplete = false
                currentAssistant = trimmedLine.replace(/^assistant:?\s*/i, "")
            }
            else if (trimmedLine) {
                if (inAssistant && !assistantComplete && currentAssistant) {
                    currentAssistant += " " + trimmedLine
                }
                else if (inUser && currentUser) {
                    currentUser += " " + trimmedLine
                }
                // Once the assistant turn is complete, non-User: lines are filler and discarded
            }
            else {
                // Blank line: once we have assistant content, mark the turn as complete
                if (inAssistant && currentAssistant) {
                    assistantComplete = true
                }
            }
        }
        if (currentUser) {
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
        return deduplicateTurns(turns)
    }
    function createTrainingItem(input: string, output: string, processingType: string, outputFormat: string): TrainingItem[] {
        const format = outputFormat
        const items: TrainingItem[] = []
        if (processingType === "instruction") {
            const qaPairs = parseQuestionAnswerPairs(stripFillerBetweenPairs(output))
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
            const conversationTurns = parseConversationTurns(stripFillerBetweenPairs(output))
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
        setStagingData([])
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
        if (sepIdx < 0) return ""
        if (sepIdx === 0) return filePath.slice(0, 1)
        return filePath.slice(0, sepIdx)
    }
    async function exportOutput(exportFormatParam?: string): Promise<void> {
        if (!window.electronAPI) return
        const allData = [...outputData, ...stagingData]
        if (allData.length === 0) return
        const format = exportFormatParam || exportFormat()
        if (allData.length > SPLIT_THRESHOLD) {
            const partCount = Math.ceil(allData.length / SPLIT_THRESHOLD)
            const firstPath = await window.electronAPI.saveFileDialog(`${t("output.defaultFilename")}-1${extensionForFormat(format)}`)
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
                await window.electronAPI.saveFile(savePath, content)
            }
            return
        }
        const content = formatData(allData, format)
        const defaultFilename = `${t("output.defaultFilename")}${extensionForFormat(format)}`
        const savePath = await window.electronAPI.saveFileDialog(defaultFilename)
        if (!savePath) return
        await window.electronAPI.saveFile(savePath, content)
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
