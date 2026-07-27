// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createUIStore, type UIStore } from "../src/renderer/stores/uiStore.js"
import { createSettingsStore, type SettingsStore } from "../src/renderer/stores/settingsStore.js"
import { csvEscape } from "../src/renderer/exportFormats.js"
import { withRoot } from "./setup.js"
let disposes: Array<() => void> = []
function makeUIStore(): UIStore {
    return withRoot((dispose) => {
        disposes.push(dispose)
        return createUIStore()
    })
}
function makeSettingsStore(): SettingsStore {
    return withRoot((dispose) => {
        disposes.push(dispose)
        return createSettingsStore()
    })
}
afterEach(() => {
    disposes.forEach(d => d())
    disposes = []
    vi.restoreAllMocks()
})
describe("UIStore helpers", () => {
    it("sanitizeText removes control characters via addLog", () => {
        let ui: UIStore=makeUIStore()
        ui.addLog("hello\x00world")
        expect(ui.logs[0].message).not.toContain("\x00")
        ui.addLog("hello\x1bworld")
        expect(ui.logs[1].message).not.toContain("\x1b")
    })
    it("sanitizeText preserves whitespace", () => {
        let ui: UIStore=makeUIStore()
        ui.addLog("hello world")
        expect(ui.logs[0].message).toContain("hello")
        expect(ui.logs[0].message).toContain("world")
    })
    it("csvEscape escapes quotes", () => {
        expect(csvEscape('say "hello"')).toBe('"say ""hello"""')
    })
    it("csvEscape prefixes formula characters", () => {
        expect(csvEscape("=SUM(A1)")).toBe("'=SUM(A1)")
        expect(csvEscape("+123")).toBe("'+123")
        expect(csvEscape("-123")).toBe("'-123")
        expect(csvEscape("@user")).toBe("'@user")
    })
    it("getLogIcon returns correct icons", () => {
        let ui: UIStore=makeUIStore()
        expect(ui.getLogIcon("info")).toBe("fa-info-circle")
        expect(ui.getLogIcon("success")).toBe("fa-check-circle")
        expect(ui.getLogIcon("warning")).toBe("fa-exclamation-triangle")
        expect(ui.getLogIcon("error")).toBe("fa-times-circle")
        expect(ui.getLogIcon("unknown" as any)).toBe("fa-info-circle")
    })
    it("setProgress clamps values", () => {
        let ui: UIStore=makeUIStore()
        ui.setProgress(-10, "test")
        expect(ui.progressPercent()).toBe(0)
        ui.setProgress(110, "test")
        expect(ui.progressPercent()).toBe(100)
        ui.setProgress(NaN, "test")
        expect(ui.progressPercent()).toBe(0)
    })
    it("setProgress updates stored values", () => {
        let ui: UIStore=makeUIStore()
        ui.setProgress(50, "halfway")
        expect(ui.progressPercent()).toBe(50)
        expect(ui.progressText()).toBe("halfway")
    })
    it("addLog creates log entry", () => {
        let ui: UIStore=makeUIStore()
        ui.addLog("hello", "info")
        expect(ui.logs.length).toBe(1)
        expect(ui.logs[0].message).toBe("hello")
        expect(ui.logs[0].type).toBe("info")
    })
    it("addLog truncates old entries", () => {
        let ui: UIStore=makeUIStore()
        for(let i=0;i<55;i++){
            ui.addLog(`msg ${i}`, "info")
        }
        expect(ui.logs.length).toBeLessThanOrEqual(50)
    })
})
describe("SettingsStore appearance", () => {
    beforeEach(()=>{
        localStorage.clear()
    })
    afterEach(()=>{
        localStorage.clear()
        vi.restoreAllMocks()
    })
    it("applies theme classes", () => {
        let settings: SettingsStore=makeSettingsStore()
        settings.applyTheme("light")
        expect(document.body.classList.contains("theme-light")).toBe(true)
        settings.applyTheme("dark")
        expect(document.body.classList.contains("theme-dark")).toBe(true)
        settings.applyTheme("auto")
        expect(document.body.classList.contains("theme-light")||document.body.classList.contains("theme-dark")).toBe(true)
    })
    it("applies font size classes", () => {
        let settings: SettingsStore=makeSettingsStore()
        settings.applyFontSize("small")
        expect(document.body.classList.contains("font-small")).toBe(true)
        settings.applyFontSize("large")
        expect(document.body.classList.contains("font-large")).toBe(true)
        settings.applyFontSize("medium")
        expect(document.body.classList.contains("font-medium")).toBe(true)
    })
    it("resets settings to defaults", () => {
        let settings: SettingsStore=makeSettingsStore()
        settings.resetAppSettings()
        let saved=JSON.parse(localStorage.getItem("training-generator-app-settings")||"{}")
        expect(saved.theme).toBe("auto")
        expect(saved.fontSize).toBe("medium")
    })
})
describe("SettingsStore language", () => {
    beforeEach(()=>{
        document.body.innerHTML=`<span data-i18n="app.title"></span><input data-i18n-placeholder="config.apiKey.placeholder" />`
        document.documentElement.lang="en"
        localStorage.clear()
    })
    afterEach(()=>{
        vi.restoreAllMocks()
    })
    it("applies translations", () => {
        let settings: SettingsStore=makeSettingsStore()
        settings.applyLanguage("en")
        expect(document.documentElement.lang).toBe("en")
        let el=document.querySelector('[data-i18n="app.title"]') as HTMLElement
        expect(el.textContent).toBe("Training Generator")
    })
    it("updates temperature display", () => {
        let settings: SettingsStore=makeSettingsStore()
        let result=settings.updateTemperatureDisplay(0.5)
        expect(result.text).toBe("0.5")
        expect(result.rangeFill).toContain("50")
    })
})
