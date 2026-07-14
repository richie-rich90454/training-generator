// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import Processor from "../src/renderer/processor.js"
import type { TrainingItem } from "../src/types/index.js"
import { t } from "../src/renderer/i18n.js"
import { clearCache } from "../src/renderer/cache.js"

async function generatePrompt(chunk: string, _processingType: string): Promise<string> {
    return `prompt for: ${chunk}`
}
function createTrainingItem(input: string, output: string, _processingType: string): TrainingItem[] {
    return [{ format: "instruction", instruction: "test", input, output }]
}

describe("Processor demo mode - getDemoResponse lockdown", () => {
    beforeEach(async () => {
        vi.stubGlobal("window", { electronAPI: {} })
        await clearCache()
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("returns one of the instruction demo strings for processingType='instruction'", () => {
        let processor = new Processor()
        processor.enableDemoMode()
        let allowed = [t("demoResponse.instruction.1"), t("demoResponse.instruction.2")]
        // Sample many times because the response is randomly chosen — exercise both
        // the selection logic and confirm the result always stays within the allowed set.
        for (let i = 0; i < 20; i++) {
            let response = (processor as any).getDemoResponse("any chunk", "instruction")
            expect(allowed).toContain(response)
        }
    })

    it("returns the conversation demo string for processingType='conversation'", () => {
        let processor = new Processor()
        processor.enableDemoMode()
        let expected = t("demoResponse.conversation.1")
        for (let i = 0; i < 20; i++) {
            let response = (processor as any).getDemoResponse("any chunk", "conversation")
            expect(response).toBe(expected)
        }
    })

    it("falls back to the instruction demo list for an unknown processingType", () => {
        let processor = new Processor()
        processor.enableDemoMode()
        let allowed = [t("demoResponse.instruction.1"), t("demoResponse.instruction.2")]
        let unknownTypes = ["unknown", "", "summary", "qa", "translation"]
        for (let type of unknownTypes) {
            for (let i = 0; i < 10; i++) {
                let response = (processor as any).getDemoResponse("any chunk", type)
                expect(allowed).toContain(response)
            }
        }
    })

    it("demoMode flag toggles via enable/disable", () => {
        let processor = new Processor()
        expect(processor.demoMode).toBe(false)
        processor.enableDemoMode()
        expect(processor.demoMode).toBe(true)
        processor.disableDemoMode()
        expect(processor.demoMode).toBe(false)
    })
})
