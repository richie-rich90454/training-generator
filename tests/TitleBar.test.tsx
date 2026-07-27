// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@solidjs/testing-library"
import { createStore } from "solid-js/store"
import { TitleBar } from "../src/renderer/components/TitleBar.tsx"
import type { AppStore } from "../src/renderer/stores/appStore.js"

interface ElectronAPIStub {
    windowMinimize: ReturnType<typeof vi.fn>
    windowMaximizeToggle: ReturnType<typeof vi.fn>
    windowClose: ReturnType<typeof vi.fn>
    onWindowMaximizedChange: ReturnType<typeof vi.fn>
}

function makeElectronAPI(): ElectronAPIStub {
    return {
        windowMinimize: vi.fn(),
        windowMaximizeToggle: vi.fn(),
        windowClose: vi.fn(),
        onWindowMaximizedChange: vi.fn(() => vi.fn()) // returns unsubscribe
    }
}

function makeSettingsStore(initialTheme: string | undefined) {
    const [appSettings, setAppSettings] = createStore<{ theme: string | undefined }>({ theme: initialTheme })
    const setAppSetting = vi.fn((key: string, value: unknown) => {
        if (key === "theme") setAppSettings("theme", value as string)
    })
    return { appSettings, setAppSetting, saveAppSettings: vi.fn() }
}

function makeAppStore(settingsStore?: ReturnType<typeof makeSettingsStore>): AppStore {
    return {
        uiStore: {
            openModal: vi.fn()
        } as any,
        settingsStore: settingsStore ?? makeSettingsStore("light"),
        showSettings: vi.fn(),
        showHelp: vi.fn()
    } as unknown as AppStore
}

describe("TitleBar", () => {
    let originalElectronAPI: unknown
    let electronAPI: ElectronAPIStub

    beforeEach(() => {
        originalElectronAPI = (window as any).electronAPI
        electronAPI = makeElectronAPI()
        ;(window as any).electronAPI = electronAPI
    })
    afterEach(() => {
        cleanup()
        ;(window as any).electronAPI = originalElectronAPI
        vi.restoreAllMocks()
    })

    describe("rendering", () => {
        test("renders without crashing", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            // CSS module generates scoped class names like _title-bar_hash; use [class*="..."]
            const titleBar = document.querySelector('[class*="title-bar"]')
            expect(titleBar).not.toBeNull()
        })
        test("renders app title 'Training Generator'", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(document.body.textContent).toContain("Training Generator")
        })
        test("renders title-bar-drag-region", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(document.querySelector('[class*="title-bar-drag-region"]')).not.toBeNull()
        })
        test("renders app icon image", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const img = document.querySelector('[class*="title-bar-icon"] img')
            expect(img).not.toBeNull()
            expect(img?.getAttribute("src")).toBe("./assets/icon.svg")
        })
        test("title-bar-icon has aria-hidden true", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const icon = document.querySelector('[class*="title-bar-icon"]')
            expect(icon?.getAttribute("aria-hidden")).toBe("true")
        })
        test("renders title-bar-actions container", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(document.querySelector('[class*="title-bar-actions"]')).not.toBeNull()
        })
        test("renders window-controls container", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(document.querySelector('[class*="window-controls"]')).not.toBeNull()
        })
        test("renders three action buttons", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const actions = document.querySelector('[class*="title-bar-actions"]')
            const buttons = actions?.querySelectorAll("button.btn-icon")
            expect(buttons?.length).toBe(3)
        })
        test("renders three window control buttons", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const controls = document.querySelector('[class*="window-controls"]')
            const buttons = controls?.querySelectorAll("button")
            expect(buttons?.length).toBe(3)
        })
    })

    describe("action buttons", () => {
        test("settings button has correct aria-label", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const btn = screen.getByLabelText("Settings")
            expect(btn).not.toBeNull()
        })
        test("help button has correct aria-label", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const btn = screen.getByLabelText("Help")
            expect(btn).not.toBeNull()
        })
        test("help button has id='help-btn' for tour targeting", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const btn = screen.getByLabelText("Help")
            expect(btn.id).toBe("help-btn")
        })
        test("settings button has id='settings-btn' for tour targeting", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const btn = screen.getByLabelText("Settings")
            expect(btn.id).toBe("settings-btn")
        })
        test("clicking settings button calls appStore.showSettings", () => {
            const store = makeAppStore()
            render(() => <TitleBar appStore={store} />)
            const btn = screen.getByLabelText("Settings")
            fireEvent.click(btn)
            expect(store.showSettings).toHaveBeenCalled()
        })
        test("clicking help button calls appStore.showHelp", () => {
            const store = makeAppStore()
            render(() => <TitleBar appStore={store} />)
            const btn = screen.getByLabelText("Help")
            fireEvent.click(btn)
            expect(store.showHelp).toHaveBeenCalled()
        })
        test("each action button has an SVG icon", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const actions = document.querySelector('[class*="title-bar-actions"]')
            const buttons = actions?.querySelectorAll("button.btn-icon")
            for (const btn of buttons ?? []) {
                const svg = btn.querySelector("svg")
                expect(svg).not.toBeNull()
            }
        })
        test("edit templates button is not rendered", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(screen.queryByLabelText("Edit Prompt Templates")).toBeNull()
        })
    })

    describe("theme toggle", () => {
        test("theme toggle button renders with correct aria-label", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(screen.getByLabelText("Toggle theme")).not.toBeNull()
        })
        test("theme toggle button has id='theme-toggle-btn'", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const btn = screen.getByLabelText("Toggle theme")
            expect(btn.id).toBe("theme-toggle-btn")
        })
        test("theme toggle button has data-i18n-aria-label='titleBar.themeToggle.aria'", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const btn = screen.getByLabelText("Toggle theme")
            expect(btn.getAttribute("data-i18n-aria-label")).toBe("titleBar.themeToggle.aria")
        })
        test("theme toggle button has class='btn-icon'", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const btn = screen.getByLabelText("Toggle theme")
            expect(btn.className).toContain("btn-icon")
        })
        test("aria-pressed is false when theme is light", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const btn = screen.getByLabelText("Toggle theme")
            expect(btn.getAttribute("aria-pressed")).toBe("false")
        })
        test("aria-pressed is true when theme is dark", () => {
            render(() => <TitleBar appStore={makeAppStore(makeSettingsStore("dark"))} />)
            const btn = screen.getByLabelText("Toggle theme")
            expect(btn.getAttribute("aria-pressed")).toBe("true")
        })
        test("data-icon is fa-moon when theme is light", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const btn = screen.getByLabelText("Toggle theme")
            expect(btn.getAttribute("data-icon")).toBe("fa-moon")
        })
        test("data-icon is fa-sun when theme is dark", () => {
            render(() => <TitleBar appStore={makeAppStore(makeSettingsStore("dark"))} />)
            const btn = screen.getByLabelText("Toggle theme")
            expect(btn.getAttribute("data-icon")).toBe("fa-sun")
        })
        test("icon SVG is rendered inside theme toggle button", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const btn = screen.getByLabelText("Toggle theme")
            const svg = btn.querySelector("svg")
            expect(svg).not.toBeNull()
        })
        test("clicking theme toggle calls setAppSetting with 'dark' when current is 'light'", () => {
            const settingsStore = makeSettingsStore("light")
            render(() => <TitleBar appStore={makeAppStore(settingsStore)} />)
            fireEvent.click(screen.getByLabelText("Toggle theme"))
            expect(settingsStore.setAppSetting).toHaveBeenCalledWith("theme", "dark")
        })
        test("clicking theme toggle calls setAppSetting with 'light' when current is 'dark'", () => {
            const settingsStore = makeSettingsStore("dark")
            render(() => <TitleBar appStore={makeAppStore(settingsStore)} />)
            fireEvent.click(screen.getByLabelText("Toggle theme"))
            expect(settingsStore.setAppSetting).toHaveBeenCalledWith("theme", "light")
        })
        test("clicking theme toggle calls saveAppSettings for persistence", () => {
            const settingsStore = makeSettingsStore("light")
            render(() => <TitleBar appStore={makeAppStore(settingsStore)} />)
            fireEvent.click(screen.getByLabelText("Toggle theme"))
            expect(settingsStore.saveAppSettings).toHaveBeenCalledTimes(1)
        })
        test("clicking theme toggle swaps icon from fa-moon to fa-sun", () => {
            const settingsStore = makeSettingsStore("light")
            render(() => <TitleBar appStore={makeAppStore(settingsStore)} />)
            const btn = screen.getByLabelText("Toggle theme")
            expect(btn.getAttribute("data-icon")).toBe("fa-moon")
            fireEvent.click(btn)
            expect(btn.getAttribute("data-icon")).toBe("fa-sun")
        })
        test("clicking theme toggle swaps aria-pressed from false to true", () => {
            const settingsStore = makeSettingsStore("light")
            render(() => <TitleBar appStore={makeAppStore(settingsStore)} />)
            const btn = screen.getByLabelText("Toggle theme")
            expect(btn.getAttribute("aria-pressed")).toBe("false")
            fireEvent.click(btn)
            expect(btn.getAttribute("aria-pressed")).toBe("true")
        })
        test("rapid clicks: two clicks return to original light state", () => {
            const settingsStore = makeSettingsStore("light")
            render(() => <TitleBar appStore={makeAppStore(settingsStore)} />)
            const btn = screen.getByLabelText("Toggle theme")
            fireEvent.click(btn) // light -> dark
            expect(btn.getAttribute("data-icon")).toBe("fa-sun")
            fireEvent.click(btn) // dark -> light
            expect(btn.getAttribute("data-icon")).toBe("fa-moon")
            expect(btn.getAttribute("aria-pressed")).toBe("false")
            expect(settingsStore.setAppSetting).toHaveBeenCalledTimes(2)
            expect(settingsStore.saveAppSettings).toHaveBeenCalledTimes(2)
        })
        test("rapid clicks: three clicks end in dark state", () => {
            const settingsStore = makeSettingsStore("light")
            render(() => <TitleBar appStore={makeAppStore(settingsStore)} />)
            const btn = screen.getByLabelText("Toggle theme")
            fireEvent.click(btn) // light -> dark
            fireEvent.click(btn) // dark -> light
            fireEvent.click(btn) // light -> dark
            expect(btn.getAttribute("data-icon")).toBe("fa-sun")
            expect(btn.getAttribute("aria-pressed")).toBe("true")
            expect(settingsStore.setAppSetting).toHaveBeenCalledTimes(3)
        })
        test("undefined theme defaults to light display (icon is fa-moon, aria-pressed is false)", () => {
            const settingsStore = makeSettingsStore(undefined)
            render(() => <TitleBar appStore={makeAppStore(settingsStore)} />)
            const btn = screen.getByLabelText("Toggle theme")
            expect(btn.getAttribute("data-icon")).toBe("fa-moon")
            expect(btn.getAttribute("aria-pressed")).toBe("false")
        })
        test("clicking with undefined theme transitions to dark", () => {
            const settingsStore = makeSettingsStore(undefined)
            render(() => <TitleBar appStore={makeAppStore(settingsStore)} />)
            const btn = screen.getByLabelText("Toggle theme")
            fireEvent.click(btn)
            expect(settingsStore.setAppSetting).toHaveBeenCalledWith("theme", "dark")
            expect(btn.getAttribute("data-icon")).toBe("fa-sun")
            expect(btn.getAttribute("aria-pressed")).toBe("true")
        })
        test("theme toggle button is positioned between settings-btn and help-btn", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const actions = document.querySelector('[class*="title-bar-actions"]')
            const buttons = Array.from(actions?.querySelectorAll("button.btn-icon") ?? [])
            const ids = buttons.map(b => b.id)
            expect(ids).toEqual(["settings-btn", "theme-toggle-btn", "help-btn"])
        })
    })

    describe("window controls", () => {
        test("minimize button has correct aria-label", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(screen.getByLabelText("Minimize")).not.toBeNull()
        })
        test("maximize button has correct aria-label", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(screen.getByLabelText("Maximize")).not.toBeNull()
        })
        test("close button has correct aria-label", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(screen.getByLabelText("Close")).not.toBeNull()
        })
        test("clicking minimize button calls electronAPI.windowMinimize", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            fireEvent.click(screen.getByLabelText("Minimize"))
            expect(electronAPI.windowMinimize).toHaveBeenCalledTimes(1)
        })
        test("clicking maximize button calls electronAPI.windowMaximizeToggle", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            fireEvent.click(screen.getByLabelText("Maximize"))
            expect(electronAPI.windowMaximizeToggle).toHaveBeenCalledTimes(1)
        })
        test("clicking close button calls electronAPI.windowClose", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            fireEvent.click(screen.getByLabelText("Close"))
            expect(electronAPI.windowClose).toHaveBeenCalledTimes(1)
        })
        test("minimize button has window-btn-min class", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const btn = screen.getByLabelText("Minimize")
            expect(btn.className).toContain("window-btn-min")
        })
        test("maximize button has window-btn-max class", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const btn = screen.getByLabelText("Maximize")
            expect(btn.className).toContain("window-btn-max")
        })
        test("close button has window-btn-close class", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const btn = screen.getByLabelText("Close")
            expect(btn.className).toContain("window-btn-close")
        })
        test("each window button has an SVG icon", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const controls = document.querySelector('[class*="window-controls"]')
            const buttons = controls?.querySelectorAll("button")
            for (const btn of buttons ?? []) {
                const svg = btn.querySelector("svg")
                expect(svg).not.toBeNull()
            }
        })
        test("maximize button has icon-maximize and icon-restore SVGs", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const maxBtn = screen.getByLabelText("Maximize")
            // CSS module scoped class names; use [class*="..."] selector
            expect(maxBtn.querySelector('[class*="icon-maximize"]')).not.toBeNull()
            expect(maxBtn.querySelector('[class*="icon-restore"]')).not.toBeNull()
        })
        test("double-clicking the drag region toggles maximize", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const dragRegion = document.querySelector('[class*="title-bar-drag-region"]') as HTMLElement
            expect(dragRegion).not.toBeNull()
            fireEvent.dblClick(dragRegion)
            expect(electronAPI.windowMaximizeToggle).toHaveBeenCalledTimes(1)
        })
    })

    describe("maximize subscription", () => {
        test("onMount subscribes to onWindowMaximizedChange", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(electronAPI.onWindowMaximizedChange).toHaveBeenCalledTimes(1)
            expect(electronAPI.onWindowMaximizedChange).toHaveBeenCalledWith(expect.any(Function))
        })
        test("maximize button does not have is-maximized class initially", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const maxBtn = screen.getByLabelText("Maximize")
            // CSS module scoped class name contains "is-maximized" as substring
            expect(maxBtn.className).not.toContain("is-maximized")
        })
        test("maximized=true callback adds is-maximized class to max button", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const callback = electronAPI.onWindowMaximizedChange.mock.calls[0][0] as (m: boolean) => void
            callback(true)
            const maxBtn = screen.getByLabelText("Restore")
            expect(maxBtn.className).toContain("is-maximized")
        })
        test("maximized=false callback removes is-maximized class from max button", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const callback = electronAPI.onWindowMaximizedChange.mock.calls[0][0] as (m: boolean) => void
            callback(true)
            callback(false)
            const maxBtn = screen.getByLabelText("Maximize")
            expect(maxBtn.className).not.toContain("is-maximized")
        })
        test("aria-label toggles to Restore when maximized", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const callback = electronAPI.onWindowMaximizedChange.mock.calls[0][0] as (m: boolean) => void
            expect(screen.getByLabelText("Maximize")).not.toBeNull()
            callback(true)
            expect(screen.getByLabelText("Restore")).not.toBeNull()
            expect(screen.queryByLabelText("Maximize")).toBeNull()
            callback(false)
            expect(screen.getByLabelText("Maximize")).not.toBeNull()
            expect(screen.queryByLabelText("Restore")).toBeNull()
        })
        test("data-i18n-aria-label toggles between window.maximize and window.restore", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            const callback = electronAPI.onWindowMaximizedChange.mock.calls[0][0] as (m: boolean) => void
            const maxBtn = screen.getByLabelText("Maximize")
            expect(maxBtn.getAttribute("data-i18n-aria-label")).toBe("window.maximize")
            callback(true)
            const restoreBtn = screen.getByLabelText("Restore")
            expect(restoreBtn.getAttribute("data-i18n-aria-label")).toBe("window.restore")
        })
        test("onCleanup calls the unsubscribe function returned by onWindowMaximizedChange", () => {
            const unsubscribe = vi.fn()
            electronAPI.onWindowMaximizedChange.mockReturnValue(unsubscribe)
            const { unmount } = render(() => <TitleBar appStore={makeAppStore()} />)
            unmount()
            expect(unsubscribe).toHaveBeenCalledTimes(1)
        })
    })

    describe("missing electronAPI", () => {
        test("renders without crashing when electronAPI is undefined", () => {
            ;(window as any).electronAPI = undefined
            expect(() => render(() => <TitleBar appStore={makeAppStore()} />)).not.toThrow()
        })
        test("clicking minimize does not throw when electronAPI is undefined", () => {
            ;(window as any).electronAPI = undefined
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(() => fireEvent.click(screen.getByLabelText("Minimize"))).not.toThrow()
        })
        test("clicking maximize does not throw when electronAPI is undefined", () => {
            ;(window as any).electronAPI = undefined
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(() => fireEvent.click(screen.getByLabelText("Maximize"))).not.toThrow()
        })
        test("clicking close does not throw when electronAPI is undefined", () => {
            ;(window as any).electronAPI = undefined
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(() => fireEvent.click(screen.getByLabelText("Close"))).not.toThrow()
        })
        test("does not subscribe when electronAPI is undefined", () => {
            ;(window as any).electronAPI = undefined
            expect(() => render(() => <TitleBar appStore={makeAppStore()} />)).not.toThrow()
        })
        test("unmounts without errors when electronAPI is undefined", () => {
            ;(window as any).electronAPI = undefined
            const { unmount } = render(() => <TitleBar appStore={makeAppStore()} />)
            expect(() => unmount()).not.toThrow()
        })
    })

    describe("partial electronAPI", () => {
        test("does not subscribe when onWindowMaximizedChange is missing", () => {
            ;(window as any).electronAPI = {
                windowMinimize: vi.fn(),
                windowMaximizeToggle: vi.fn(),
                windowClose: vi.fn()
            }
            expect(() => render(() => <TitleBar appStore={makeAppStore()} />)).not.toThrow()
        })
        test("clicking minimize works when only windowMinimize is defined", () => {
            const minimizeFn = vi.fn()
            ;(window as any).electronAPI = {
                windowMinimize: minimizeFn
            }
            render(() => <TitleBar appStore={makeAppStore()} />)
            fireEvent.click(screen.getByLabelText("Minimize"))
            expect(minimizeFn).toHaveBeenCalledTimes(1)
        })
        test("unmounts without errors when onWindowMaximizedChange is missing", () => {
            ;(window as any).electronAPI = {
                windowMinimize: vi.fn(),
                windowMaximizeToggle: vi.fn(),
                windowClose: vi.fn()
            }
            const { unmount } = render(() => <TitleBar appStore={makeAppStore()} />)
            expect(() => unmount()).not.toThrow()
        })
    })

    describe("unmount", () => {
        test("unmounts without errors", () => {
            const { unmount } = render(() => <TitleBar appStore={makeAppStore()} />)
            expect(() => unmount()).not.toThrow()
        })
    })

    describe("data-i18n attributes", () => {
        test("title span has data-i18n='app.title'", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(document.querySelector('[data-i18n="app.title"]')).not.toBeNull()
        })
        test("settings button has data-i18n-title='header.settings'", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(document.querySelector('[data-i18n-title="header.settings"]')).not.toBeNull()
        })
        test("help button has data-i18n-title='header.help'", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(document.querySelector('[data-i18n-title="header.help"]')).not.toBeNull()
        })
        test("minimize button has data-i18n-aria-label='window.minimize'", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(document.querySelector('[data-i18n-aria-label="window.minimize"]')).not.toBeNull()
        })
        test("maximize button has data-i18n-aria-label='window.maximize'", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(document.querySelector('[data-i18n-aria-label="window.maximize"]')).not.toBeNull()
        })
        test("close button has data-i18n-aria-label='window.close'", () => {
            render(() => <TitleBar appStore={makeAppStore()} />)
            expect(document.querySelector('[data-i18n-aria-label="window.close"]')).not.toBeNull()
        })
    })
})
