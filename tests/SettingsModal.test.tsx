import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@solidjs/testing-library"
import { createComponent } from "solid-js"
import { SettingsModal } from "../src/renderer/components/SettingsModal.tsx"
import { createSettingsStore, type SettingsStore } from "../src/renderer/stores/settingsStore.js"
import { withRoot } from "./setup.js"
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
    test("search results count and no-results messages have data-i18n", () => {
        const { container } = renderComponent(true)
        // Type a query that won't match anything to trigger no-results
        const searchInput = container.querySelector("#settings-search-input") as HTMLInputElement
        fireEvent.input(searchInput, { target: { value: "zzzznonexistent" } })
        // The results-count span (always rendered when searching) should have data-i18n
        const countSpan = container.querySelector('[data-i18n="settings.search.resultsCount"]')
        expect(countSpan).not.toBeNull()
        // The no-results paragraph should also have data-i18n
        const noResults = container.querySelector('[data-i18n="settings.search.noResults"]')
        expect(noResults).not.toBeNull()
    })
    test("all reset-section buttons have data-i18n-aria-label", () => {
        const { container } = renderComponent(true)
        // Use the data-i18n-aria-label attribute to find reset-section buttons
        const resetButtons = container.querySelectorAll('[data-i18n-aria-label="settings.resetSection.ariaLabel"]')
        // At least the appearance section's reset button should be rendered
        expect(resetButtons.length).toBeGreaterThanOrEqual(1)
    })
})

/**
 * Build an AppStore stub around a REAL SettingsStore so setAppSetting actually
 * mutates reactive state and <Show> re-evaluates. The stub fills in the
 * minimum surface area SettingsModal.tsx reads at render time.
 */
function makeReactiveAppStore(settingsStore: SettingsStore, open = true): AppStore {
    return {
        settingsStore,
        uiStore: {
            settingsOpen: () => open,
            showToast: vi.fn(),
            availableOllamaModels: () => [],
            openPromptEditor: () => {}
        },
        hideSettings: vi.fn(),
        savePreset: vi.fn(async () => {}),
        initProvider: () => {},
        refreshOllamaModels: vi.fn(async () => {})
    } as unknown as AppStore
}

/**
 * Flush Solid's microtask queue so <Show>/<For> reactivity settles before
 * assertions. Solid store updates are synchronous at the signal level, but
 * <Show>'s internal createMemo schedules the DOM patch via a microtask in
 * dev mode.
 */
function flushMicrotasks(): Promise<void> {
    return Promise.resolve()
}

describe("SettingsModal — Advanced section auto-collapse (Task 6.4)", () => {
    beforeEach(() => {
        localStorage.clear()
        document.body.innerHTML = ""
    })
    afterEach(() => {
        cleanup()
        document.body.innerHTML = ""
    })

    function clickAdvancedTab(): void {
        const advancedTab = screen.getByRole("tab", { name: t("settings.sections.advanced") })
        fireEvent.click(advancedTab)
    }

    function getDisclosure(container: HTMLElement): HTMLButtonElement {
        const btn = container.querySelector('button[aria-controls="settings-panel-advanced-content"]') as HTMLButtonElement | null
        if (!btn) throw new Error("Disclosure button not found in DOM")
        return btn
    }

    test("Advanced section starts collapsed by default (advancedExpanded defaults to false)", async () => {
        await withRoot(async (dispose) => {
            const settingsStore = createSettingsStore()
            const appStore = makeReactiveAppStore(settingsStore)
            const result = render(() => createComponent(SettingsModal, { appStore }))
            try {
                clickAdvancedTab()
                await flushMicrotasks()

                const disclosure = getDisclosure(result.container)
                expect(disclosure.getAttribute("aria-expanded")).toBe("false")
                // Content region is removed from the DOM when collapsed.
                expect(result.container.querySelector("#settings-panel-advanced-content")).toBeNull()
                expect(result.container.querySelector("#settings-gpu-acceleration")).toBeNull()
                // Default state in the store.
                expect(settingsStore.appSettings.advancedExpanded).toBe(false)
            } finally {
                result.unmount()
                dispose()
            }
        })
    })

    test("clicking disclosure expands fields, updates aria-expanded, and persists state", async () => {
        await withRoot(async (dispose) => {
            const settingsStore = createSettingsStore()
            const appStore = makeReactiveAppStore(settingsStore)
            const result = render(() => createComponent(SettingsModal, { appStore }))
            try {
                clickAdvancedTab()
                await flushMicrotasks()

                const disclosure = getDisclosure(result.container)
                fireEvent.click(disclosure)
                await flushMicrotasks()

                expect(disclosure.getAttribute("aria-expanded")).toBe("true")
                const content = result.container.querySelector("#settings-panel-advanced-content")
                expect(content).not.toBeNull()
                expect(result.container.querySelector("#settings-gpu-acceleration")).not.toBeNull()
                // Setting is persisted in the store.
                expect(settingsStore.appSettings.advancedExpanded).toBe(true)
            } finally {
                result.unmount()
                dispose()
            }
        })
    })

    test("clicking disclosure again collapses fields back to hidden", async () => {
        await withRoot(async (dispose) => {
            const settingsStore = createSettingsStore()
            // Pre-expand so the first click is a collapse action.
            settingsStore.setAppSetting("advancedExpanded", true)
            const appStore = makeReactiveAppStore(settingsStore)
            const result = render(() => createComponent(SettingsModal, { appStore }))
            try {
                clickAdvancedTab()
                await flushMicrotasks()

                const disclosure = getDisclosure(result.container)
                expect(disclosure.getAttribute("aria-expanded")).toBe("true")
                expect(result.container.querySelector("#settings-gpu-acceleration")).not.toBeNull()

                fireEvent.click(disclosure)
                await flushMicrotasks()

                expect(disclosure.getAttribute("aria-expanded")).toBe("false")
                expect(result.container.querySelector("#settings-gpu-acceleration")).toBeNull()
                expect(result.container.querySelector("#settings-panel-advanced-content")).toBeNull()
                expect(settingsStore.appSettings.advancedExpanded).toBe(false)
            } finally {
                result.unmount()
                dispose()
            }
        })
    })

    test("undefined advancedExpanded falls back to collapsed (graceful default)", async () => {
        await withRoot(async (dispose) => {
            const settingsStore = createSettingsStore()
            // Force undefined to simulate corrupted/missing persisted state.
            // The component code uses `?? false` so an undefined value must
            // resolve to the collapsed state.
            ;(settingsStore.appSettings as { advancedExpanded?: boolean }).advancedExpanded = undefined
            const appStore = makeReactiveAppStore(settingsStore)
            const result = render(() => createComponent(SettingsModal, { appStore }))
            try {
                clickAdvancedTab()
                await flushMicrotasks()

                const disclosure = getDisclosure(result.container)
                expect(disclosure.getAttribute("aria-expanded")).toBe("false")
                expect(result.container.querySelector("#settings-gpu-acceleration")).toBeNull()
                // Clicking still works and sets a concrete boolean.
                fireEvent.click(disclosure)
                await flushMicrotasks()
                expect(disclosure.getAttribute("aria-expanded")).toBe("true")
                expect(settingsStore.appSettings.advancedExpanded).toBe(true)
            } finally {
                result.unmount()
                dispose()
            }
        })
    })

    test("disclosure is keyboard accessible (Enter activates, then Space toggles back)", async () => {
        await withRoot(async (dispose) => {
            const settingsStore = createSettingsStore()
            const appStore = makeReactiveAppStore(settingsStore)
            const result = render(() => createComponent(SettingsModal, { appStore }))
            try {
                clickAdvancedTab()
                await flushMicrotasks()

                const disclosure = getDisclosure(result.container)
                // Native <button> elements activate on Enter and Space; the
                // regression here is that the button must be focusable and
                // reachable via keyboard, and that activating it via keyboard
                // event dispatch flips the state.
                disclosure.focus()
                expect(document.activeElement).toBe(disclosure)
                // Enter activates (browser-emulated click).
                fireEvent.keyDown(disclosure, { key: "Enter" })
                fireEvent.click(disclosure)
                await flushMicrotasks()
                expect(disclosure.getAttribute("aria-expanded")).toBe("true")
                expect(result.container.querySelector("#settings-gpu-acceleration")).not.toBeNull()

                // Space collapses.
                fireEvent.keyDown(disclosure, { key: " " })
                fireEvent.click(disclosure)
                await flushMicrotasks()
                expect(disclosure.getAttribute("aria-expanded")).toBe("false")
                expect(result.container.querySelector("#settings-gpu-acceleration")).toBeNull()
            } finally {
                result.unmount()
                dispose()
            }
        })
    })

    test("rapid toggles converge to the correct final state (no race)", async () => {
        await withRoot(async (dispose) => {
            const settingsStore = createSettingsStore()
            const appStore = makeReactiveAppStore(settingsStore)
            const result = render(() => createComponent(SettingsModal, { appStore }))
            try {
                clickAdvancedTab()
                await flushMicrotasks()

                const disclosure = getDisclosure(result.container)
                // Five rapid clicks: false → true → false → true → false → true
                for (let i = 0; i < 5; i++) {
                    fireEvent.click(disclosure)
                }
                await flushMicrotasks()

                expect(settingsStore.appSettings.advancedExpanded).toBe(true)
                expect(disclosure.getAttribute("aria-expanded")).toBe("true")
                expect(result.container.querySelector("#settings-gpu-acceleration")).not.toBeNull()
            } finally {
                result.unmount()
                dispose()
            }
        })
    })

    test("expanded state survives unmount/remount because it lives on the store", async () => {
        await withRoot(async (dispose) => {
            const settingsStore = createSettingsStore()
            const appStore1 = makeReactiveAppStore(settingsStore)
            const result1 = render(() => createComponent(SettingsModal, { appStore: appStore1 }))
            try {
                clickAdvancedTab()
                await flushMicrotasks()
                const disclosure1 = getDisclosure(result1.container)
                fireEvent.click(disclosure1)
                await flushMicrotasks()
                expect(settingsStore.appSettings.advancedExpanded).toBe(true)
            } finally {
                result1.unmount()
            }

            // Second render reuses the SAME store — expanded state must persist.
            const appStore2 = makeReactiveAppStore(settingsStore)
            const result2 = render(() => createComponent(SettingsModal, { appStore: appStore2 }))
            try {
                clickAdvancedTab()
                await flushMicrotasks()
                const disclosure2 = getDisclosure(result2.container)
                expect(disclosure2.getAttribute("aria-expanded")).toBe("true")
                expect(result2.container.querySelector("#settings-gpu-acceleration")).not.toBeNull()
            } finally {
                result2.unmount()
                dispose()
            }
        })
    })

    test("dispose does not leak (unmount + post-unmount store mutation do not throw)", async () => {
        await withRoot(async (dispose) => {
            const settingsStore = createSettingsStore()
            const appStore = makeReactiveAppStore(settingsStore)
            const result = render(() => createComponent(SettingsModal, { appStore }))

            clickAdvancedTab()
            await flushMicrotasks()
            const disclosure = getDisclosure(result.container)
            fireEvent.click(disclosure)
            await flushMicrotasks()

            expect(() => result.unmount()).not.toThrow()
            // Mutating the store after unmount should not throw (no leaked effects).
            expect(() => settingsStore.setAppSetting("advancedExpanded", false)).not.toThrow()
            dispose()
        })
    })

    test("aria-controls points to the controlled content element id", async () => {
        await withRoot(async (dispose) => {
            const settingsStore = createSettingsStore()
            const appStore = makeReactiveAppStore(settingsStore)
            const result = render(() => createComponent(SettingsModal, { appStore }))
            try {
                clickAdvancedTab()
                await flushMicrotasks()

                const disclosure = getDisclosure(result.container)
                expect(disclosure.getAttribute("aria-controls")).toBe("settings-panel-advanced-content")

                // Expand and verify the controlled element exists with the matching id.
                fireEvent.click(disclosure)
                await flushMicrotasks()
                const content = result.container.querySelector("#settings-panel-advanced-content")
                expect(content).not.toBeNull()
                expect(content?.getAttribute("id")).toBe("settings-panel-advanced-content")
            } finally {
                result.unmount()
                dispose()
            }
        })
    })

    test("disclosure label flips between Show and Hide based on state", async () => {
        await withRoot(async (dispose) => {
            const settingsStore = createSettingsStore()
            const appStore = makeReactiveAppStore(settingsStore)
            const result = render(() => createComponent(SettingsModal, { appStore }))
            try {
                clickAdvancedTab()
                await flushMicrotasks()

                const disclosure = getDisclosure(result.container)
                // Collapsed → "Show advanced settings"
                expect(disclosure.textContent ?? "").toContain(t("settings.advanced.show"))

                // Expand → "Hide advanced settings"
                fireEvent.click(disclosure)
                await flushMicrotasks()
                expect(disclosure.textContent ?? "").toContain(t("settings.advanced.hide"))

                // Collapse again → "Show advanced settings"
                fireEvent.click(disclosure)
                await flushMicrotasks()
                expect(disclosure.textContent ?? "").toContain(t("settings.advanced.show"))
            } finally {
                result.unmount()
                dispose()
            }
        })
    })

    test("saveAppSettings is invoked on every toggle (persistence side-effect)", async () => {
        await withRoot(async (dispose) => {
            const settingsStore = createSettingsStore()
            const saveSpy = vi.spyOn(settingsStore, "saveAppSettings")
            const appStore = makeReactiveAppStore(settingsStore)
            const result = render(() => createComponent(SettingsModal, { appStore }))
            try {
                clickAdvancedTab()
                await flushMicrotasks()

                const disclosure = getDisclosure(result.container)
                saveSpy.mockClear()
                fireEvent.click(disclosure)
                await flushMicrotasks()
                expect(saveSpy).toHaveBeenCalledTimes(1)

                fireEvent.click(disclosure)
                await flushMicrotasks()
                expect(saveSpy).toHaveBeenCalledTimes(2)
            } finally {
                saveSpy.mockRestore()
                result.unmount()
                dispose()
            }
        })
    })
})
