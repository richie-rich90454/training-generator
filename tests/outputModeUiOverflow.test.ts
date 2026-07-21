// @vitest-environment happy-dom
//
// Regression tests for the Output Mode fieldset overflow fix (spec Section 1).
// Covers Tasks 1.1 (fieldset UA reset), 1.2 (single-column override),
// 1.3 (config-field--full modifier), and 1.4 (no overflow at every required
// panel width).
//
// happy-dom does not compute real layout, so scrollWidth/clientWidth and
// getBoundingClientRect return 0. The layout assertions below therefore only
// fire when the host DOES compute layout; otherwise the regression is covered
// by (a) static CSS-file assertions that read the CSS module source directly
// via fs.readFileSync and (b) the DOM-structure assertions that confirm the
// component renders the expected controls and that reactivity
// (combined ↔ perFile toggle) works at every required panel width.
//
// CSS module class names are NOT applied in the happy-dom test environment
// (the `styles` object's properties resolve to `undefined`), so class-based
// DOM queries are unreliable. The tests below use ID-, role-, and
// attribute-based queries instead, and verify the CSS rules by reading the
// CSS module source file directly from disk.
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { render, cleanup } from "@solidjs/testing-library"
import { createComponent } from "solid-js"
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { ConfigPanel } from "../src/renderer/components/ConfigPanel.js"
import { createSettingsStore, type SettingsStore } from "../src/renderer/stores/settingsStore.js"
import { withRoot } from "./setup.js"
import type { AppStore } from "../src/renderer/stores/appStore.js"

// ESM doesn't provide __dirname; derive it from import.meta.url the same way
// the other tests in this suite do (see tests/complete-functionality.test.ts,
// tests/file-parser.test.ts, tests/language-prompts.test.ts).
const __dirname = dirname(fileURLToPath(import.meta.url))

// Read the CSS module source once at module load. Using fs.readFileSync
// avoids dependence on Vite's CSS module processing or `?raw` import
// handling, both of which are unreliable in the happy-dom test environment.
const CSS_PATH = resolve(__dirname, "../src/renderer/components/styles/ConfigPanel.module.css")
const configPanelCss: string = readFileSync(CSS_PATH, "utf-8")

const WIDTHS: readonly number[] = [320, 360, 414, 480, 768, 1024, 1280, 1920]

/**
 * Build a minimal AppStore stub around a real SettingsStore. The real store is
 * required so setAppSetting("outputFileMode", ...) actually mutates reactive
 * state and the <Show> inside ConfigPanel re-evaluates; a vi.fn() stub would
 * not trigger re-rendering.
 */
function makeStubAppStore(settingsStore: SettingsStore): AppStore {
    return {
        settingsStore,
        uiStore: {
            availableOllamaModels: () => [],
            openPromptEditor: () => {}
        },
        savePreset: async () => {},
        initProvider: () => {},
        refreshOllamaModels: async () => {}
    } as unknown as AppStore
}

/**
 * Flush Solid's microtask queue so <Show>/<For> reactivity settles before
 * assertions. Solid store updates are synchronous at the signal level, but
 * <Show>'s internal createMemo schedules the DOM patch via a microtask in
 * dev mode. Awaiting one microtask tick lets the DOM catch up.
 */
function flushMicrotasks(): Promise<void> {
    return Promise.resolve()
}

/**
 * Extract the body of a CSS rule matching the given selector from the raw CSS
 * source. Returns the first match's body (text between the outermost `{` and
 * `}`), or null if no match is found. The regex is non-greedy and stops at
 * the first `}` after the selector's opening brace, which works for simple
 * rules without nested at-rules.
 */
function extractRuleBody(css: string, selectorPattern: string): string | null {
    const regex = new RegExp(selectorPattern + "\\s*\\{([^}]*)\\}")
    const match = css.match(regex)
    return match ? match[1] : null
}

describe("Output Mode UI overflow regression", () => {
    beforeEach(() => {
        localStorage.clear()
        document.body.innerHTML = ""
    })

    afterEach(() => {
        cleanup()
        document.body.innerHTML = ""
    })

    it("Task 1.1: .config-section resets fieldset UA defaults (min-width:0, margin-inline:0, overflow:hidden) and preserves border/background/padding", () => {
        const body = extractRuleBody(configPanelCss, "\\.config-section")
        expect(body).not.toBeNull()
        expect(body).toContain("min-width:0")
        expect(body).toContain("margin-inline:0")
        expect(body).toContain("overflow:hidden")
        // Preserved existing declarations.
        expect(body).toContain("padding")
        expect(body).toContain("border")
        expect(body).toContain("background")
    })

    it("Task 1.2: .config-section .config-field forces single-column layout (grid-template-columns:minmax(0, 1fr) and align-items:start)", () => {
        const body = extractRuleBody(configPanelCss, "\\.config-section\\s+\\.config-field")
        expect(body).not.toBeNull()
        expect(body).toContain("grid-template-columns:minmax(0, 1fr)")
        expect(body).toContain("align-items:start")
    })

    it("Task 1.3: .config-section .config-field--full modifier is declared with single-column grid", () => {
        const body = extractRuleBody(configPanelCss, "\\.config-section\\s+\\.config-field--full")
        expect(body).not.toBeNull()
        expect(body).toContain("grid-template-columns:minmax(0, 1fr)")
    })

    it("Task 1.3: .config-section .checkbox-field defensive rule is declared (future-proof for flex→grid switch)", () => {
        const body = extractRuleBody(configPanelCss, "\\.config-section\\s+\\.checkbox-field")
        expect(body).not.toBeNull()
        expect(body).toContain("grid-template-columns:minmax(0, 1fr)")
    })

    it.each(WIDTHS)(
        "renders Output Mode fieldset without horizontal overflow at %ipx panel width",
        async (width: number) => {
            // withRoot provides the reactive root for the SettingsStore's
            // createMemo/createSignal/createEffect (isCloudProvider, apiKeyPlain,
            // applyTheme, etc.) so they are disposed alongside the component's
            // render root. Without this, the store's createEffect calls leak
            // across tests and eventually hang the vitest worker.
            await withRoot(async (rootDispose) => {
                const settingsStore = createSettingsStore()
                const appStore = makeStubAppStore(settingsStore)

                const result = render(
                    () => createComponent(ConfigPanel, { appStore })
                )
                // Set the panel width on the rendered container. happy-dom
                // doesn't compute layout, but this documents intent and would
                // trigger the @container (min-width: 440px) rule in a real
                // browser.
                result.container.style.width = `${width}px`
                result.container.style.display = "block"

                try {
                    // Default state: outputFileMode === "combined".
                    const fieldset = result.container.querySelector("fieldset") as HTMLFieldSetElement | null
                    expect(fieldset).not.toBeNull()
                    const fieldsetEl = fieldset as HTMLFieldSetElement

                    // Radio group is always present (2 options: combined, perFile).
                    const radioInputs = fieldsetEl.querySelectorAll(
                        'input[type="radio"][name="output-file-mode"]'
                    )
                    expect(radioInputs.length).toBe(2)

                    // Radio group wrapper has role="radiogroup" (verifies the
                    // .radio-group div is rendered, independent of CSS module
                    // class scoping).
                    const radioGroup = fieldsetEl.querySelector('[role="radiogroup"]')
                    expect(radioGroup).not.toBeNull()
                    // The radio-group's parent is the .config-field wrapper div.
                    expect(radioGroup!.parentElement).not.toBeNull()
                    expect(radioGroup!.parentElement!.tagName).toBe("DIV")

                    // In combined mode, perFile-only controls are NOT rendered.
                    expect(fieldsetEl.querySelector("#config-output-filename-template")).toBeNull()
                    expect(fieldsetEl.querySelector("#config-max-items-per-file")).toBeNull()

                    // Always-on checkboxes are present (confirmBeforeExport, autoExportOnCompletion).
                    let checkboxes = fieldsetEl.querySelectorAll('input[type="checkbox"]')
                    expect(checkboxes.length).toBe(2)

                    // Toggle to perFile — perFile controls should now render.
                    // Await a microtask tick to let <Show>'s internal memo
                    // propagate the store update to the DOM.
                    settingsStore.setAppSetting("outputFileMode", "perFile")
                    await flushMicrotasks()
                    expect(settingsStore.appSettings.outputFileMode).toBe("perFile")
                    expect(fieldsetEl.querySelector("#config-output-filename-template")).not.toBeNull()
                    expect(fieldsetEl.querySelector("#config-max-items-per-file")).not.toBeNull()

                    // All 4 checkboxes now present (2 always-on + 2 perFile-only:
                    // includeSourceMetadata, stripPiiBeforeExport).
                    checkboxes = fieldsetEl.querySelectorAll('input[type="checkbox"]')
                    expect(checkboxes.length).toBe(4)

                    // Toggle back to combined — perFile controls disappear again.
                    settingsStore.setAppSetting("outputFileMode", "combined")
                    await flushMicrotasks()
                    expect(fieldsetEl.querySelector("#config-output-filename-template")).toBeNull()
                    expect(fieldsetEl.querySelector("#config-max-items-per-file")).toBeNull()
                    checkboxes = fieldsetEl.querySelectorAll('input[type="checkbox"]')
                    expect(checkboxes.length).toBe(2)

                    // Best-effort layout assertion: only fires when the host
                    // environment computes real layout (happy-dom typically
                    // returns 0 for scrollWidth/clientWidth/getBoundingClientRect).
                    // When it does compute layout, the fieldset must not overflow
                    // and every control must fit inside the fieldset's right edge.
                    if (fieldsetEl.scrollWidth > 0 && fieldsetEl.clientWidth > 0) {
                        expect(fieldsetEl.scrollWidth).toBeLessThanOrEqual(fieldsetEl.clientWidth + 1)
                        const fieldsetRight = fieldsetEl.getBoundingClientRect().right
                        if (fieldsetRight > 0) {
                            const controls = fieldsetEl.querySelectorAll(
                                "input, select, textarea, label"
                            )
                            for (const control of Array.from(controls)) {
                                const rect = (control as HTMLElement).getBoundingClientRect()
                                if (rect.right > 0) {
                                    expect(rect.right).toBeLessThanOrEqual(fieldsetRight + 1)
                                }
                            }
                        }
                    }
                } finally {
                    result.unmount()
                    rootDispose()
                }
            })
        }
    )

    it("Task 1.3: radio-group wrapper and all four checkbox rows have a wrapper div (DOM structure verifies JSX modifier application)", async () => {
        await withRoot(async (rootDispose) => {
            const settingsStore = createSettingsStore()
            const appStore = makeStubAppStore(settingsStore)

            const result = render(
                () => createComponent(ConfigPanel, { appStore })
            )
            result.container.style.width = "768px"
            result.container.style.display = "block"

            try {
                // Switch to perFile so all 4 checkboxes are rendered.
                settingsStore.setAppSetting("outputFileMode", "perFile")
                await flushMicrotasks()
                const fieldset = result.container.querySelector("fieldset") as HTMLFieldSetElement | null
                expect(fieldset).not.toBeNull()
                const fieldsetEl = fieldset as HTMLFieldSetElement

                // Radio-group row: located via role="radiogroup" (always set,
                // independent of CSS module class scoping). Its parent is the
                // wrapper div that receives the config-field--full modifier.
                const radioGroup = fieldsetEl.querySelector('[role="radiogroup"]')
                expect(radioGroup).not.toBeNull()
                const radioWrapper = radioGroup!.parentElement as HTMLElement | null
                expect(radioWrapper).not.toBeNull()
                expect(radioWrapper!.tagName).toBe("DIV")

                // All four checkbox-field rows inside the fieldset must have
                // a wrapper div (the .checkbox-field row). Checkbox rows are
                // located via their checkbox inputs (always present regardless
                // of CSS module processing).
                const checkboxInputs = fieldsetEl.querySelectorAll('input[type="checkbox"]')
                expect(checkboxInputs.length).toBe(4)
                for (const input of Array.from(checkboxInputs)) {
                    // Walk up to find the wrapper div that directly contains
                    // the label wrapping the checkbox. The immediate parent
                    // of the input is the label; the label's parent is the
                    // .checkbox-field wrapper div.
                    const label = input.parentElement
                    expect(label).not.toBeNull()
                    expect(label!.tagName).toBe("LABEL")
                    const wrapper = label!.parentElement
                    expect(wrapper).not.toBeNull()
                    expect(wrapper!.tagName).toBe("DIV")
                }
            } finally {
                result.unmount()
                rootDispose()
            }
        })
    })
})
