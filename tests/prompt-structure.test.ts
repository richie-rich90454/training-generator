// @vitest-environment node
import { describe, test, expect } from "vitest"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

let __dirname = path.dirname(fileURLToPath(import.meta.url))
let promptsDir: string = path.join(__dirname, "..", "src", "prompts")

// Acceptable terms for each strict-contract section. A prompt file passes if
// its content contains at least one term from the corresponding list (the
// English canonical term or a translated equivalent).
let outputContractTerms: string[] = [
    "OUTPUT CONTRACT",
    "输出契约",
    "輸出契約",
    "出力契約",
    "출력 계약",
    "OUTPUT-VERTRAG",
    "CONTRATO DE SALIDA",
    "CONTRAT DE SORTIE",
]
let forbiddenOutputTerms: string[] = [
    "FORBIDDEN OUTPUT",
    "禁止输出",
    "禁止輸出",
    "禁止出力",
    "금지된 출력",
    "VERBOTENE AUSGABE",
    "SALIDA PROHIBIDA",
    "SORTIE INTERDITE",
]
let strictFormatTerms: string[] = [
    "STRICT FORMAT",
    "严格格式",
    "嚴格格式",
    "厳格フォーマット",
    "엄격한 형식",
    "STRIKTES FORMAT",
    "FORMATO ESTRICTO",
    "FORMAT STRICT",
]
let selfCheckTerms: string[] = [
    "SELF-CHECK",
    "自检",
    "自檢",
    "セルフチェック",
    "셀프 체크",
    "SELBSTPRÜFUNG",
    "AUTOCOMPROBACIÓN",
    "AUTO-VÉRIFICATION",
]

function containsAny(content: string, terms: string[]): boolean {
    return terms.some((term) => content.includes(term))
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

    test.each(files)("file %s contains FORBIDDEN OUTPUT section", (file: string) => {
        let content: string = fs.readFileSync(path.join(promptsDir, file), "utf8")
        expect(containsAny(content, forbiddenOutputTerms)).toBe(true)
    })

    test.each(files)("file %s contains STRICT FORMAT section", (file: string) => {
        let content: string = fs.readFileSync(path.join(promptsDir, file), "utf8")
        expect(containsAny(content, strictFormatTerms)).toBe(true)
    })

    test.each(files)("file %s contains {{text}} placeholder", (file: string) => {
        let content: string = fs.readFileSync(path.join(promptsDir, file), "utf8")
        expect(content).toContain("{{text}}")
    })

    test.each(files)("file %s contains SELF-CHECK section", (file: string) => {
        let content: string = fs.readFileSync(path.join(promptsDir, file), "utf8")
        expect(containsAny(content, selfCheckTerms)).toBe(true)
    })

    test.each(files)("file %s contains LINE LAYOUT subsection", (file: string) => {
        let content: string = fs.readFileSync(path.join(promptsDir, file), "utf8")
        expect(content).toContain("LINE LAYOUT")
    })

    test.each(files)("file %s contains NO REPETITION subsection", (file: string) => {
        let content: string = fs.readFileSync(path.join(promptsDir, file), "utf8")
        expect(content).toContain("NO REPETITION")
    })

    test.each(files)("file %s contains ANSWER CONTENT RULES or CONTENT RULES subsection", (file: string) => {
        let content: string = fs.readFileSync(path.join(promptsDir, file), "utf8")
        // instruction/conversation files contain "ANSWER CONTENT RULES";
        // chunking/custom files contain "CONTENT RULES". Either is acceptable.
        let hasAnswerRules = content.includes("ANSWER CONTENT RULES")
        let hasContentRules = content.includes("CONTENT RULES")
        expect(hasAnswerRules || hasContentRules).toBe(true)
    })

    test.each(files)("file %s contains FIRST LINE RULE subsection", (file: string) => {
        let content: string = fs.readFileSync(path.join(promptsDir, file), "utf8")
        expect(content).toContain("FIRST LINE RULE")
    })

    test.each(files)("file %s contains COMPLIANCE RULE (NO REFUSAL) subsection", (file: string) => {
        let content: string = fs.readFileSync(path.join(promptsDir, file), "utf8")
        // English files contain "COMPLIANCE RULE"; other languages contain
        // translated equivalents (NO REFUSAL / SIN NEGATIVA / SANS REFUS / etc.)
        let hasComplianceRule = content.includes("COMPLIANCE RULE")
        let hasNoRefusal = content.includes("NO REFUSAL") || content.includes("SIN NEGATIVA") || content.includes("SANS REFUS") || content.includes("KEINE VERWEIGERUNG")
        let hasAsianRefusal = content.includes("禁止拒绝") || content.includes("禁止拒絕") || content.includes("拒否禁止") || content.includes("거부 금지")
        expect(hasComplianceRule || hasNoRefusal || hasAsianRefusal).toBe(true)
    })

    test("all prompt files contain every required contract section", () => {
        for (let file of files) {
            let content: string = fs.readFileSync(path.join(promptsDir, file), "utf8")
            expect(containsAny(content, outputContractTerms), `${file} missing OUTPUT CONTRACT`).toBe(true)
            expect(containsAny(content, forbiddenOutputTerms), `${file} missing FORBIDDEN OUTPUT`).toBe(true)
            expect(containsAny(content, strictFormatTerms), `${file} missing STRICT FORMAT`).toBe(true)
            expect(content, `${file} missing {{text}} placeholder`).toContain("{{text}}")
            expect(containsAny(content, selfCheckTerms), `${file} missing SELF-CHECK`).toBe(true)
            expect(content, `${file} missing LINE LAYOUT`).toContain("LINE LAYOUT")
            expect(content, `${file} missing NO REPETITION`).toContain("NO REPETITION")
            expect(content, `${file} missing FIRST LINE RULE`).toContain("FIRST LINE RULE")
            let hasComplianceRule = content.includes("COMPLIANCE RULE")
            let hasNoRefusal = content.includes("NO REFUSAL") || content.includes("SIN NEGATIVA") || content.includes("SANS REFUS") || content.includes("KEINE VERWEIGERUNG")
            let hasAsianRefusal = content.includes("禁止拒绝") || content.includes("禁止拒絕") || content.includes("拒否禁止") || content.includes("거부 금지")
            expect(hasComplianceRule || hasNoRefusal || hasAsianRefusal, `${file} missing COMPLIANCE RULE`).toBe(true)
            let hasAnswerRules = content.includes("ANSWER CONTENT RULES")
            let hasContentRules = content.includes("CONTENT RULES")
            expect(hasAnswerRules || hasContentRules, `${file} missing ANSWER CONTENT RULES or CONTENT RULES`).toBe(true)
        }
    })
})
