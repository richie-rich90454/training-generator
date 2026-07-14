// @vitest-environment node
import { describe, test, expect } from "vitest"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

let __dirname = path.dirname(fileURLToPath(import.meta.url))
let promptsDir: string = path.join(__dirname, "..", "src", "prompts")

// Acceptable terms for each section. A prompt file passes if its content
// contains at least one term from the corresponding list.
let outputContractTerms: string[] = [
    "OUTPUT CONTRACT",
    "输出合同",
    "輸出合約",
    "出力契約",
    "출력 계약",
    "OUTPUT-VERTRAG",
    "CONTRATO DE SALIDA",
    "CONTRAT DE SORTIE",
]
let strictFormatTerms: string[] = [
    "STRICT FORMAT",
    "严格格式",
    "嚴格格式",
    "厳密なフォーマット",
    "엄격한 형식",
    "STRIKTES FORMAT",
    "FORMATO ESTRICTO",
    "FORMAT STRICT",
]
let noRepetitionTerms: string[] = [
    "NO REPETITION",
    "禁止重复",
    "禁止重複",
    "繰り返し禁止",
    "반복 금지",
    "KEINE WIEDERHOLUNG",
    "SIN REPETICIÓN",
    "SANS RÉPÉTITION",
]
let answerRulesTerms: string[] = [
    "ANSWER RULES",
    "答案规则",
    "答案規則",
    "回答ルール",
    "답변 규칙",
    "ANTWORT-REGELN",
    "REGLAS DE RESPUESTA",
    "RÈGLES DE RÉPONSE",
]
let contentRulesTerms: string[] = [
    "CONTENT RULES",
    "内容规则",
    "內容規則",
    "コンテンツルール",
    "要約ルール",
    "テキストルール",
    "내용 규칙",
    "INHALTSREGELN",
    "INHALTS-REGELN",
    "REGLAS DE CONTENIDO",
    "RÈGLES DE CONTENU",
]

function containsAny(content: string, terms: string[]): boolean {
    return terms.some((term) => content.toLowerCase().includes(term.toLowerCase()))
}

describe("Prompt structure validation", () => {
    test("prompts directory exists", () => {
        expect(fs.existsSync(promptsDir)).toBe(true)
    })

    test("at least one prompt file is present", () => {
        let files: string[] = fs.readdirSync(promptsDir).filter((f) => f.endsWith(".txt"))
        expect(files.length).toBeGreaterThan(0)
    })

    let files: string[] = fs.existsSync(promptsDir)
        ? fs.readdirSync(promptsDir).filter((f) => f.endsWith(".txt"))
        : []

    test.each(files)("file %s contains OUTPUT CONTRACT section", (file: string) => {
        let content: string = fs.readFileSync(path.join(promptsDir, file), "utf8")
        expect(containsAny(content, outputContractTerms)).toBe(true)
    })

    test.each(files)("file %s contains STRICT FORMAT section", (file: string) => {
        let content: string = fs.readFileSync(path.join(promptsDir, file), "utf8")
        expect(containsAny(content, strictFormatTerms)).toBe(true)
    })

    test.each(files)("file %s contains {{text}} placeholder", (file: string) => {
        let content: string = fs.readFileSync(path.join(promptsDir, file), "utf8")
        expect(content).toContain("{{text}}")
    })

    test.each(files)("file %s contains NO REPETITION section", (file: string) => {
        let content: string = fs.readFileSync(path.join(promptsDir, file), "utf8")
        expect(containsAny(content, noRepetitionTerms)).toBe(true)
    })

    test.each(files)("file %s contains ANSWER RULES or CONTENT RULES section", (file: string) => {
        let content: string = fs.readFileSync(path.join(promptsDir, file), "utf8")
        let hasAnswerRules = containsAny(content, answerRulesTerms)
        let hasContentRules = containsAny(content, contentRulesTerms)
        expect(hasAnswerRules || hasContentRules).toBe(true)
    })

    test.each(files)("file %s is under 50 lines", (file: string) => {
        let content: string = fs.readFileSync(path.join(promptsDir, file), "utf8")
        let lineCount = content.split("\n").length
        expect(lineCount, `${file} has ${lineCount} lines, expected < 50`).toBeLessThan(50)
    })

    test("all prompt files contain every required contract section", () => {
        for (let file of files) {
            let content: string = fs.readFileSync(path.join(promptsDir, file), "utf8")
            expect(containsAny(content, outputContractTerms), `${file} missing OUTPUT CONTRACT`).toBe(true)
            expect(containsAny(content, strictFormatTerms), `${file} missing STRICT FORMAT`).toBe(true)
            expect(content, `${file} missing {{text}} placeholder`).toContain("{{text}}")
            expect(containsAny(content, noRepetitionTerms), `${file} missing NO REPETITION`).toBe(true)
            let hasAnswerRules = containsAny(content, answerRulesTerms)
            let hasContentRules = containsAny(content, contentRulesTerms)
            expect(hasAnswerRules || hasContentRules, `${file} missing ANSWER RULES or CONTENT RULES`).toBe(true)
        }
    })
})
