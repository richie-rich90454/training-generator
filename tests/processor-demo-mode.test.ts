// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import Processor from "../src/renderer/processor.js"
import type { Provider, ProviderResult } from "../src/renderer/provider.js"
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

describe("Processor demo mode - bypasses provider.generate", () => {
    beforeEach(async () => {
        vi.stubGlobal("window", { electronAPI: {} })
        await clearCache()
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("does not call provider.generate and produces items from demo strings", async () => {
        let processor = new Processor()
        // Provider whose generate throws if ever invoked — demo mode must bypass it.
        let generateSpy = vi.fn(async (): Promise<ProviderResult> => {
            throw new Error("provider.generate must NOT be called in demo mode")
        })
        let provider: Provider = {
            name: "mock",
            generate: generateSpy
        }
        processor.provider = provider
        processor.enableDemoMode()
        processor.concurrency = 1

        let onChunkComplete = vi.fn()
        let onChunkError = vi.fn()

        let items = await processor.processChunks(
            ["chunk1", "chunk2", "chunk3"],
            "model",
            "instruction",
            generatePrompt,
            createTrainingItem,
            onChunkComplete,
            onChunkError
        )

        // Demo mode must never reach the provider.
        expect(generateSpy).not.toHaveBeenCalled()
        // Each chunk yields one training item built from a demo string.
        expect(items.length).toBe(3)
        expect(onChunkComplete).toHaveBeenCalledTimes(3)
        expect(onChunkError).not.toHaveBeenCalled()

        // The produced outputs must be drawn from the instruction demo strings.
        let allowed = [t("demoResponse.instruction.1"), t("demoResponse.instruction.2")]
        for (let item of items) {
            expect(allowed).toContain(item.output)
        }
    })

    it("produces conversation demo strings when processingType='conversation'", async () => {
        let processor = new Processor()
        let generateSpy = vi.fn(async (): Promise<ProviderResult> => {
            throw new Error("provider.generate must NOT be called in demo mode")
        })
        processor.provider = { name: "mock", generate: generateSpy }
        processor.enableDemoMode()
        processor.concurrency = 1

        let onChunkComplete = vi.fn()
        let items = await processor.processChunks(
            ["a", "b"],
            "model",
            "conversation",
            generatePrompt,
            createTrainingItem,
            onChunkComplete,
            () => {}
        )

        expect(generateSpy).not.toHaveBeenCalled()
        expect(items.length).toBe(2)
        expect(onChunkComplete).toHaveBeenCalledTimes(2)
        let expected = t("demoResponse.conversation.1")
        for (let item of items) {
            expect(item.output).toBe(expected)
        }
    })
})
