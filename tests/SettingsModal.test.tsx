import { describe, test, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@solidjs/testing-library"
import { SettingsModal } from "../src/renderer/components/SettingsModal.tsx"
import type { AppStore } from "../src/renderer/stores/appStore.js"
import { t } from "../src/renderer/i18n.js"

function makeStub(open = true) {
    const settingsStore = {
        settings: { language: "en" },
        appSettings: {
            theme: "auto",
            fontSize: "medium",
            autoSave: true,
            autoCheckOllama: true,
            enableThinking: false,
            maxFileSize: 100,
            maxOutputItems: 100000,
            maxChunks: 500,
            maxParallelFiles: 1,
            startMaximized: false,
            rememberWindowSize: true,
            smartSizing: true
        },
        profiles: [],
        selectedProfile: () => "",
        apiKeyPlain: () => "",
        isCloudProvider: () => false,
        setTheme: vi.fn(),
        setFontSize: vi.fn(),
        applyLanguage: vi.fn(),
        setAutoSave: vi.fn(),
        setAutoCheckOllama: vi.fn(),
        setEnableThinking: vi.fn(),
        setMaxFileSize: vi.fn(),
        setMaxOutputItems: vi.fn(),
        setMaxChunks: vi.fn(),
        setMaxParallelFiles: vi.fn(),
        setStartMaximized: vi.fn(),
        setRememberWindowSize: vi.fn(),
        setSmartSizing: vi.fn(),
        refreshProfiles: vi.fn(async () => {}),
        saveAppSettings: vi.fn(),
        resetAppSettings: vi.fn(),
        applyProfile: vi.fn(async () => {}),
        saveCurrentProfile: vi.fn(async () => {}),
        deleteCurrentProfile: vi.fn(async () => {}),
        updateTemperatureDisplay: vi.fn(() => ({ rangeFill: "", temperatureColor: "", temperatureColorHover: "", temperatureShadow: "", text: "0.7" }))
    }
    const hideSettings = vi.fn()
    const savePreset = vi.fn(async () => {})
    const uiStore = { settingsOpen: () => open, showToast: vi.fn() }
    const appStore = { settingsStore, hideSettings, savePreset, uiStore } as unknown as AppStore
    return { appStore, settingsStore, hideSettings, savePreset }
}
function renderComponent(open = true) {
    const stub = makeStub(open)
    const result = render(() => <SettingsModal appStore={stub.appStore} />)
    return { ...result, ...stub }
}

describe("SettingsModal", () => {
    test("renders dialog when open", () => {
        renderComponent(true)
        expect(screen.getByRole("dialog")).not.toBeNull()
        expect(screen.getByText(t("settings.title"))).not.toBeNull()
    })
    test("does not render when closed", () => {
        renderComponent(false)
        expect(screen.queryByRole("dialog")).toBeNull()
    })
    test("clicking close button calls hideSettings", () => {
        const { hideSettings } = renderComponent(true)
        fireEvent.click(screen.getByLabelText(t("settings.closeAria")))
        expect(hideSettings).toHaveBeenCalledTimes(1)
    })
    test("escape key calls hideSettings", () => {
        const { hideSettings } = renderComponent(true)
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
        expect(hideSettings).toHaveBeenCalledTimes(1)
    })
    test("changing theme dropdown calls settingsStore.setTheme", () => {
        const { settingsStore, container } = renderComponent(true)
        const select = container.querySelector("#settings-theme") as HTMLSelectElement
        fireEvent.change(select, { target: { value: "dark" } })
        expect(settingsStore.setTheme).toHaveBeenCalledWith("dark")
    })
    test("toggling auto-save checkbox calls settingsStore.setAutoSave", () => {
        const { settingsStore, container } = renderComponent(true)
        const checkbox = container.querySelector("#settings-auto-save") as HTMLInputElement
        fireEvent.click(checkbox)
        expect(settingsStore.setAutoSave).toHaveBeenCalledWith(false)
    })
    test("clicking save calls saveAppSettings, savePreset and hideSettings", () => {
        const { settingsStore, hideSettings, savePreset } = renderComponent(true)
        fireEvent.click(screen.getByText(t("settings.save")))
        expect(settingsStore.saveAppSettings).toHaveBeenCalledTimes(1)
        expect(savePreset).toHaveBeenCalledTimes(1)
        expect(hideSettings).toHaveBeenCalledTimes(1)
    })
    test("clicking reset calls resetAppSettings", async () => {
        const { settingsStore } = renderComponent(true)
        fireEvent.click(screen.getByText(t("settings.resetAll")))
        // handleResetAll shows a confirm dialog; click OK to confirm.
        const okBtn = document.getElementById("confirm-ok-btn") as HTMLButtonElement
        expect(okBtn).not.toBeNull()
        fireEvent.click(okBtn)
        // Wait for the showConfirm promise to resolve and the reset path to run.
        await Promise.resolve()
        await Promise.resolve()
        expect(settingsStore.resetAppSettings).toHaveBeenCalledTimes(1)
    })
    test("typing profile name and saving calls saveCurrentProfile", () => {
        const { settingsStore, container } = renderComponent(true)
        const input = container.querySelector("#settings-profile-name") as HTMLInputElement
        fireEvent.input(input, { target: { value: "MyProfile" } })
        // The save-profile button has a unique aria-label (text also appears in a <label>)
        fireEvent.click(screen.getByLabelText(t("settings.saveProfileAria")))
        expect(settingsStore.saveCurrentProfile).toHaveBeenCalledWith("MyProfile")
    })
    test("delete profile button disabled when no profile selected", () => {
        const { container } = renderComponent(true)
        const deleteBtn = container.querySelector('button[aria-label="' + t("settings.deleteProfileAria") + '"]') as HTMLButtonElement
        expect(deleteBtn.disabled).toBe(true)
    })
    test("unmounts without throwing", () => {
        const utils = renderComponent(true)
        expect(() => utils.unmount()).not.toThrow()
    })
    test("locks body scroll while open", () => {
        document.body.style.overflow = ""
        renderComponent(true)
        expect(document.body.style.overflow).toBe("hidden")
    })
    test("restores body scroll on unmount via onCleanup", () => {
        document.body.style.overflow = "auto"
        const utils = renderComponent(true)
        expect(document.body.style.overflow).toBe("hidden")
        utils.unmount()
        expect(document.body.style.overflow).toBe("auto")
    })
    test("saves and restores previously focused element", () => {
        // Create a focusable button outside the modal that we'll focus first
        const trigger = document.createElement("button")
        trigger.textContent = "Open settings"
        document.body.appendChild(trigger)
        trigger.focus()
        expect(document.activeElement).toBe(trigger)
        const utils = renderComponent(true)
        // Modal is open — focus should have moved inside the modal
        expect(document.activeElement).not.toBe(trigger)
        utils.unmount()
        // After unmount, focus should be restored to the trigger
        expect(document.activeElement).toBe(trigger)
        document.body.removeChild(trigger)
    })
    test("aria-labelledby points to visible modal title", () => {
        const { container } = renderComponent(true)
        const dialog = screen.getByRole("dialog")
        const labelledBy = dialog.getAttribute("aria-labelledby")
        expect(labelledBy).toBe("settings-modal-title")
        const title = container.querySelector("#settings-modal-title")
        expect(title).not.toBeNull()
        // The title element should contain visible text (settings.title)
        expect(title?.textContent ?? "").toContain(t("settings.title"))
    })
    test("active section persists across modal reopen via localStorage", () => {
        // Clear any prior value
        window.localStorage.removeItem("settings.activeSection")
        // First open: default to "appearance"
        const first = renderComponent(true)
        const firstTab = screen.getByRole("tab", { name: t("settings.sections.appearance") })
        // The active section's tab should have aria-selected="true"
        expect(firstTab.getAttribute("aria-selected")).toBe("true")
        // Click the "export" section tab
        const exportTab = screen.getByRole("tab", { name: t("settings.sections.export") })
        fireEvent.click(exportTab)
        expect(exportTab.getAttribute("aria-selected")).toBe("true")
        expect(window.localStorage.getItem("settings.activeSection")).toBe("export")
        // Close (unmount) and reopen — should restore to "export"
        first.unmount()
        renderComponent(true)
        const restoredExportTab = screen.getByRole("tab", { name: t("settings.sections.export") })
        expect(restoredExportTab.getAttribute("aria-selected")).toBe("true")
        // Cleanup
        window.localStorage.removeItem("settings.activeSection")
    })
    test("invalid stored section falls back to appearance", () => {
        window.localStorage.setItem("settings.activeSection", "nonexistent-section")
        renderComponent(true)
        const appearanceTab = screen.getByRole("tab", { name: t("settings.sections.appearance") })
        expect(appearanceTab.getAttribute("aria-selected")).toBe("true")
        window.localStorage.removeItem("settings.activeSection")
    })
})
