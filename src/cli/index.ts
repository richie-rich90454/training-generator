import fs from "fs"
import path from "path"
import { createCliProvider } from "./provider.js"
import Processor from "../renderer/processor.js"
import { semanticChunk, simpleChunk } from "../renderer/chunker.js"
import { deduplicate } from "../renderer/deduplicator.js"
import type { TrainingItem } from "../types/index.js"
import FileParser from "../core/fileParser.js"
import { exportJSONL, exportJSONArray, exportCSV } from "../renderer/exportFormats.js"

interface CliArgs {
    input: string
    output: string
    type: string
    model: string
    provider: string
    config: string | null
    chunkSize: number
    concurrency: number
}

function parseArgs(): CliArgs {
    let args = process.argv.slice(2)
    let result: CliArgs = {
        input: "",
        output: "",
        type: "instruction",
        model: "llama3",
        provider: "ollama",
        config: null,
        chunkSize: 8000,
        concurrency: 3
    }

    for (let i = 0; i < args.length; i++) {
        let arg = args[i]
        let next = args[i + 1]
        switch (arg) {
            case "--input":
                if (next) { result.input = next; i++ }
                break
            case "--output":
                if (next) { result.output = next; i++ }
                break
            case "--type":
                if (next) { result.type = next; i++ }
                break
            case "--model":
                if (next) { result.model = next; i++ }
                break
            case "--provider":
                if (next) { result.provider = next; i++ }
                break
            case "--config":
                if (next) { result.config = next; i++ }
                break
            case "--chunk-size":
                if (next) { result.chunkSize = parseInt(next, 10) || 8000; i++ }
                break
            case "--concurrency":
                if (next) { result.concurrency = parseInt(next, 10) || 3; i++ }
                break
        }
    }

    return result
}

function loadConfig(configPath: string): Partial<CliArgs> {
    try {
        let content = fs.readFileSync(configPath, "utf-8")
        return JSON.parse(content)
    }
    catch (error) {
        console.error(`Failed to load config file: ${(error as Error).message}`)
        process.exit(1)
    }
}

function getFileType(filePath: string): string {
    let ext = path.extname(filePath).toLowerCase().replace(".", "")
    let typeMap: Record<string, string> = {
        "pdf": "pdf",
        "docx": "docx",
        "doc": "doc",
        "rtf": "rtf",
        "txt": "txt",
        "md": "md",
        "html": "html",
        "htm": "html"
    }
    return typeMap[ext] || "txt"
}

function readPromptTemplate(language: string, processingType: string): string | null {
    let typeMap: Record<string, string> = {
        "instruction": "instruction",
        "conversation": "conversation",
        "chunking": "chunking",
        "custom": "custom"
    }
    let fileType = typeMap[processingType] || "instruction"
    let fileName = `${language}_${fileType}.txt`

    let possiblePaths = [
        path.join(process.cwd(), "src", "prompts", fileName),
        path.join(process.cwd(), "prompts", fileName),
        path.join(__dirname, "..", "prompts", fileName),
    ]

    for (let p of possiblePaths) {
        try {
            if (fs.existsSync(p)) {
                return fs.readFileSync(p, "utf-8")
            }
        }
        catch { }
    }
    return null
}

function getFallbackPrompt(text: string, processingType: string): string {
    let fallbacks: Record<string, string> = {
        instruction: `Extract EVERY fact, concept, relationship, example, statistic, definition, argument, and nuance from the text below. Leave nothing behind. Generate as many high-quality Q&A pairs as possible — there is no upper limit. Each item must contain complete, detailed answers. Prefer depth over breadth: if the text is thin, fewer but richer items are better than many shallow ones. Cover ALL information exhaustively.

TEXT:
${text}

RULES:
- Same language as source text.
- One Q&A per important point; for lists/procedures, one question per item.
- Answers based exclusively on the text.
- Each answer must be thorough and complete.
OUTPUT (blank line between pairs):
Question: [question]
Answer: [answer]`,
        conversation: `Generate a comprehensive User-Assistant conversation covering ALL information in the text below. Every fact, concept, statistic, relationship, and detail must appear in at least one exchange. Generate as many exchanges as the content warrants — no upper limit. Each exchange should be thorough and detailed.

TEXT:
${text}

RULES:
- Same language as source; answers based exclusively on the text.
- Cover every main topic and key detail in separate exchanges.
- Each response should be detailed and complete.
OUTPUT (blank line between exchanges):
User: [message]
Assistant: [response]`,
        chunking: `Comprehensively summarize the text below. Preserve ALL key points, arguments, data, examples, conclusions, and nuances. Do not omit any information. The summary should be as detailed as the content warrants — no arbitrary length limit. Maintain logical flow and all important relationships.

TEXT:
${text}

RULES:
- No information absent from the original text.
- Preserve logical flow and all important relationships.
OUTPUT: summary text only.`,
        custom: `Exhaustively extract ALL structured information from the text below. Extract: every key concept, theme, fact, data point, statistic, argument, evidence, example, definition, relationship, conclusion, and implication. For procedures: every step. For comparisons: every difference and similarity. For lists: every item with full description. Generate as many structured items as the content warrants — no upper limit.

TEXT:
${text}

RULES:
Extract: key concepts, themes, facts, data, statistics, arguments, evidence, examples,
definitions, relationships, conclusions, implications. For procedures: all steps.
For comparisons: key differences/similarities. For lists: all items with descriptions.
OUTPUT: structured analysis covering everything important.`
    }
    return fallbacks[processingType] || fallbacks.instruction
}

async function generatePrompt(text: string, processingType: string): Promise<string> {
    let language = "en"
    let template = readPromptTemplate(language, processingType)
    if (!template && language !== "en") {
        template = readPromptTemplate("en", processingType)
    }
    if (template) {
        return template.replace("{{text}}", text)
    }
    return getFallbackPrompt(text, processingType)
}

function createTrainingItem(input: string, output: string, processingType: string): TrainingItem[] {
    let items: TrainingItem[] = []

    if (processingType === "instruction") {
        let qaPairs = parseQAPairs(output)
        if (qaPairs.length > 0) {
            for (let pair of qaPairs) {
                items.push({
                    instruction: "Answer the question based on the text",
                    input: pair.question,
                    output: pair.answer
                })
            }
            return items
        }
    }
    else if (processingType === "conversation") {
        let turns = parseConversationTurns(output)
        if (turns.length > 0) {
            for (let turn of turns) {
                items.push({
                    instruction: "Respond to the user's message",
                    input: turn.user,
                    output: turn.assistant
                })
            }
            return items
        }
    }

    items.push({
        instruction: processingType === "instruction" ? "Answer the question based on the text" : "Process the following text",
        input: input,
        output: output
    })
    return items
}

function parseQAPairs(text: string): { question: string; answer: string }[] {
    if (!text || typeof text !== "string") return []
    let pairs: { question: string; answer: string }[] = []
    let lines = text.split("\n")
    let currentQuestion = ""
    let currentAnswer = ""
    let inAnswer = false

    for (let line of lines) {
        let trimmed = line.trim()
        if (trimmed.match(/^question:?\s*/i)) {
            if (currentQuestion && currentAnswer) {
                pairs.push({ question: currentQuestion.trim(), answer: currentAnswer.trim() })
            }
            currentQuestion = trimmed.replace(/^question:?\s*/i, "")
            currentAnswer = ""
            inAnswer = false
        }
        else if (trimmed.match(/^answer:?\s*/i)) {
            inAnswer = true
            currentAnswer = trimmed.replace(/^answer:?\s*/i, "")
        }
        else if (trimmed) {
            if (inAnswer && currentAnswer) {
                currentAnswer += " " + trimmed
            }
            else if (currentQuestion && !inAnswer) {
                currentQuestion += " " + trimmed
            }
        }
    }
    if (currentQuestion && currentAnswer) {
        pairs.push({ question: currentQuestion.trim(), answer: currentAnswer.trim() })
    }
    return pairs
}

function parseConversationTurns(text: string): { user: string; assistant: string }[] {
    if (!text || typeof text !== "string") return []
    let turns: { user: string; assistant: string }[] = []
    let lines = text.split("\n")
    let currentUser = ""
    let currentAssistant = ""
    let inUser = false
    let inAssistant = false

    for (let line of lines) {
        let trimmed = line.trim()
        if (trimmed.match(/^user:?\s*/i)) {
            if (currentUser && currentAssistant) {
                turns.push({ user: currentUser.trim(), assistant: currentAssistant.trim() })
            }
            currentUser = trimmed.replace(/^user:?\s*/i, "")
            currentAssistant = ""
            inUser = true
            inAssistant = false
        }
        else if (trimmed.match(/^assistant:?\s*/i)) {
            inUser = false
            inAssistant = true
            currentAssistant = trimmed.replace(/^assistant:?\s*/i, "")
        }
        else if (trimmed) {
            if (inAssistant && currentAssistant) {
                currentAssistant += " " + trimmed
            }
            else if (inUser && currentUser) {
                currentUser += " " + trimmed
            }
        }
    }
    if (currentUser && currentAssistant) {
        turns.push({ user: currentUser.trim(), assistant: currentAssistant.trim() })
    }
    return turns
}

function writeOutput(outputPath: string, items: TrainingItem[]): void {
    let ext = path.extname(outputPath).toLowerCase()
    let content: string
    if (ext === ".jsonl") {
        content = exportJSONL(items)
    }
    else if (ext === ".json") {
        content = exportJSONArray(items)
    }
    else if (ext === ".csv") {
        content = exportCSV(items)
    }
    else {
        content = exportJSONL(items)
    }
    fs.writeFileSync(outputPath, content, "utf-8")
}

async function main() {
    let args = parseArgs()

    if (args.config) {
        let configData = loadConfig(args.config)
        if (configData.input) args.input = configData.input
        if (configData.output) args.output = configData.output
        if (configData.type) args.type = configData.type
        if (configData.model) args.model = configData.model
        if (configData.provider) args.provider = configData.provider
        if (configData.chunkSize) args.chunkSize = configData.chunkSize
        if (configData.concurrency) args.concurrency = configData.concurrency
    }

    if (!args.input) {
        console.error("Error: --input <dir> is required")
        process.exit(1)
    }
    if (!args.output) {
        console.error("Error: --output <file> is required")
        process.exit(1)
    }

    let inputDir = path.resolve(args.input)
    if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
        console.error(`Error: input directory does not exist: ${inputDir}`)
        process.exit(1)
    }

    let outputPath = path.resolve(args.output)
    let outputDir = path.dirname(outputPath)
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
    }

    console.log(`Input directory: ${inputDir}`)
    console.log(`Output file: ${outputPath}`)
    console.log(`Processing type: ${args.type}`)
    console.log(`Model: ${args.model}`)
    console.log(`Provider: ${args.provider}`)
    console.log(`Chunk size: ${args.chunkSize}`)
    console.log(`Concurrency: ${args.concurrency}`)

    // Read all files from input directory
    let entries = fs.readdirSync(inputDir, { withFileTypes: true })
    let filePaths = entries
        .filter(e => e.isFile())
        .map(e => path.join(inputDir, e.name))
        .filter(fp => {
            let ext = path.extname(fp).toLowerCase()
            return [".pdf", ".docx", ".doc", ".rtf", ".txt", ".md", ".html", ".htm"].includes(ext)
        })

    if (filePaths.length === 0) {
        console.error("Error: no supported files found in input directory")
        process.exit(1)
    }

    console.log(`Found ${filePaths.length} file(s) to process`)

    // Initialize provider
    let provider = createCliProvider(args.provider)

    // Initialize processor
    let processor = new Processor()
    processor.provider = provider
    processor.concurrency = args.concurrency

    // Initialize file parser
    let fileParser = new FileParser()

    let allItems: TrainingItem[] = []
    let totalFiles = filePaths.length
    let startTime = Date.now()

    for (let i = 0; i < filePaths.length; i++) {
        let filePath = filePaths[i]
        let fileName = path.basename(filePath)
        let fileType = getFileType(filePath)

        console.log(`[${i + 1}/${totalFiles}] Processing: ${fileName}`)

        try {
            // Parse file
            let textContent = await fileParser.parseFile(filePath, fileType)
            if (!textContent || textContent.trim().length === 0) {
                console.error(`  Warning: no text content extracted from ${fileName}`)
                continue
            }

            // Chunk
            let chunks = semanticChunk(textContent, args.chunkSize, 100, false)
            if (chunks.length === 0) {
                chunks = simpleChunk(textContent, args.chunkSize)
            }
            console.log(`  Chunked into ${chunks.length} chunks`)

            // Process chunks
            let processedItems = await processor.processChunks(
                chunks,
                args.model,
                args.type,
                generatePrompt,
                createTrainingItem,
                (index: number, total: number, items: TrainingItem[]) => {
                    process.stdout.write(`\r  Processing chunk ${index}/${total}...`)
                },
                (index: number, error: string) => {
                    console.error(`\n  Error processing chunk ${index}: ${error}`)
                }
            )

            // Deduplicate
            let { items: dedupedItems, removed } = deduplicate(processedItems)
            if (removed > 0) {
                console.log(`\n  Removed ${removed} duplicate items`)
            }

            allItems.push(...dedupedItems)
            console.log(`  Generated ${dedupedItems.length} training items`)
        }
        catch (error) {
            console.error(`  Failed to process ${fileName}: ${(error as Error).message}`)
        }
    }

    // Write output
    writeOutput(outputPath, allItems)

    let elapsed = Date.now() - startTime
    let elapsedSec = (elapsed / 1000).toFixed(1)
    let stats = processor.stats.report

    // Write final stats to stderr
    console.error(`\n=== Processing Complete ===`)
    console.error(`Total items generated: ${allItems.length}`)
    console.error(`Total chunks: ${stats.totalChunks}`)
    console.error(`Successful: ${stats.successfulChunks}`)
    console.error(`Failed: ${stats.failedChunks}`)
    console.error(`Success rate: ${stats.successRate}%`)
    console.error(`Prompt tokens: ${stats.promptTokens.toLocaleString()}`)
    console.error(`Response tokens: ${stats.totalTokens.toLocaleString()}`)
    console.error(`Time elapsed: ${elapsedSec}s`)
    console.error(`Output written to: ${outputPath}`)
}

main().catch(error => {
    console.error("Fatal error:", (error as Error).message)
    process.exit(1)
})