// SolidJS root component.
// Bootstraps the renderer process, wires global keyboard shortcuts,
// mounts shared UI chrome (title bar, toasts, modals, dashboards),
// and renders the fine-grained reactive component tree.
import { render } from "solid-js/web"
import type { JSX } from "solid-js"
import { onMount, onCleanup, ErrorBoundary } from "solid-js"
import { createAppStore } from "./stores/appStore.js"
import { TitleBar } from "./components/TitleBar.js"
import { ToastContainer } from "./components/ToastContainer.js"
import { ContentGrid } from "./components/ContentGrid.js"
import { Footer } from "./components/Footer.js"
import { SettingsModal } from "./components/SettingsModal.js"
import { CommandPalette, type Command } from "./components/CommandPalette.js"
import { Dashboard } from "./components/Dashboard.js"
import { Devtools } from "./components/Devtools.js"
import { TemplateEditor } from "./components/TemplateEditor.js"
import { AnalyticsDashboard } from "./components/AnalyticsDashboard.js"
import { PromptEditor } from "./components/PromptEditor.js"
import { applyLanguage, t } from "./i18n.js"
import "../styles/main.css"
export function AppErrorFallback(props: { error: Error; reset: () => void }): JSX.Element {
    // Best-effort error log to the main-process crash log channel. Swallow
    // failures so a broken IPC surface never blocks the recovery UI.
    try {
        window.electronAPI?.writeLog?.({
            timestamp: new Date().toISOString(),
            level: "error",
            module: "renderer/App",
            message: props.error?.message ?? "Unknown render error",
            context: { stack: props.error?.stack ?? "" }
        })
    }
    catch {
        // ignore — recovery UI must not depend on IPC availability
    }
    function handleReload(): void {
        // Hard reload is the most reliable recovery when reactive state is corrupted.
        window.location.reload()
    }
    return (
        <div
            role="alert"
            aria-live="assertive"
            style={{
                display: "flex",
                "flex-direction": "column",
                "align-items": "center",
                "justify-content": "center",
                padding: "32px",
                "text-align": "center",
                "min-height": "60vh",
                gap: "16px"
            }}
        >
            <h2 style={{ margin: 0 }} data-i18n="app.errorTitle">{t("app.errorTitle")}</h2>
            <p style={{ margin: 0, color: "#666", "max-width": "480px", "word-break": "break-word" }}>
                {props.error?.message ?? String(props.error)}
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
                <button
                    type="button"
                    onClick={() => props.reset()}
                    data-i18n="app.errorRetry"
                    style={{
                        padding: "8px 16px",
                        "font-size": "14px",
                        cursor: "pointer",
                        border: "1px solid #ccc",
                        "border-radius": "4px",
                        background: "#f5f5f5"
                    }}
                >
                    {t("app.errorRetry")}
                </button>
                <button
                    type="button"
                    onClick={handleReload}
                    data-i18n="app.errorReload"
                    style={{
                        padding: "8px 16px",
                        "font-size": "14px",
                        cursor: "pointer",
                        border: "1px solid #ccc",
                        "border-radius": "4px",
                        background: "#fff"
                    }}
                >
                    {t("app.errorReload")}
                </button>
            </div>
        </div>
    )
}
export function App(): JSX.Element {
    const appStore = createAppStore()
    const commands: Command[] = [
        { id: "process", label: t("commandPalette.process"), icon: "▶", action: () => appStore.processFiles() },
        { id: "stop", label: t("commandPalette.stop"), icon: "⏹", action: () => appStore.stopProcessing() },
        { id: "clear", label: t("commandPalette.clear"), icon: "🗑", action: () => appStore.clearAll() },
        { id: "settings", label: t("commandPalette.settings"), icon: "⚙", action: () => appStore.showSettings() },
        { id: "help", label: t("commandPalette.help"), icon: "?", action: () => appStore.showHelp() },
        { id: "shortcuts", label: t("commandPalette.shortcuts"), icon: "⌨", action: () => appStore.showShortcutsHelp() },
        { id: "dashboard", label: t("commandPalette.dashboard"), icon: "📊", action: () => appStore.uiStore.toggleDashboard() },
        { id: "devtools", label: t("commandPalette.devtools"), icon: "🐛", action: () => appStore.uiStore.toggleDevtools() },
        { id: "export", label: t("commandPalette.export"), icon: "💾", action: () => appStore.exportOutput(appStore.outputStore.exportFormat()) },
        { id: "copy", label: t("commandPalette.copy"), icon: "📋", action: () => appStore.copyOutput() }
    ]
    function handleBeforeUnload(e: BeforeUnloadEvent): void {
        if (appStore.isProcessing()) {
            e.preventDefault();
            (e as BeforeUnloadEvent).returnValue = ""
        }
    }
    function handleKeydown(e: KeyboardEvent): void {
        const tag = (e.target as HTMLElement).tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
            if (e.key === "Escape") {
                return
            }
        }
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case "o":
                    e.preventDefault()
                    document.getElementById("file-input")?.click()
                    break
                case "enter":
                    e.preventDefault()
                    if (appStore.isProcessing()) {
                        appStore.stopProcessing()
                    }
                    else if (appStore.fileStore.hasFiles()) {
                        appStore.processFiles()
                    }
                    break
                case "e":
                    e.preventDefault()
                    appStore.exportOutput(appStore.outputStore.exportFormat())
                    break
                case "k":
                    e.preventDefault()
                    appStore.uiStore.openCommandPalette()
                    break
            }
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") {
                e.preventDefault()
                appStore.copyOutput()
            }
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
                e.preventDefault()
                appStore.uiStore.toggleDevtools()
            }
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "p") {
                e.preventDefault()
                appStore.uiStore.openCommandPalette()
            }
        }
        if (e.key === "Escape") {
            if (appStore.isProcessing()) {
                appStore.stopProcessing()
            }
            else {
                appStore.uiStore.closeModal()
            }
        }
    }
    onMount(() => {
        applyLanguage()
        appStore.init()
        document.addEventListener("keydown", handleKeydown)
        window.addEventListener("beforeunload", handleBeforeUnload)
    })
    onCleanup(() => {
        document.removeEventListener("keydown", handleKeydown)
        window.removeEventListener("beforeunload", handleBeforeUnload)
        appStore.dispose()
    })
    return (
        <div class="app-container fade-in">
            <a href="#main-content" class="skip-link" data-i18n="app.skipToContent" aria-label={t("app.skipToContentAria")} data-i18n-aria-label="app.skipToContentAria">
                {t("app.skipToContent")}
            </a>
            <ErrorBoundary fallback={(error, reset) => <AppErrorFallback error={error as Error} reset={reset} />}>
                <TitleBar appStore={appStore} />
                <div class="main-scroll" id="main-content">
                    <ToastContainer appStore={appStore} />
                    <ContentGrid appStore={appStore} />
                    <Footer appStore={appStore} />
                </div>
                <SettingsModal appStore={appStore} />
                <CommandPalette commands={commands} visible={appStore.uiStore.commandPaletteOpen} onClose={appStore.uiStore.closeCommandPalette} />
                <Dashboard appStore={appStore} />
                <Devtools appStore={appStore} />
                <TemplateEditor appStore={appStore} />
                <AnalyticsDashboard items={appStore.outputStore.outputData} appStore={appStore} />
                <PromptEditor modelValue={appStore.settingsStore.settings.customPrompt || ""} onChange={(value)=>appStore.settingsStore.setCustomPrompt(value)} appStore={appStore} />
            </ErrorBoundary>
        </div>
    )
}
const root = document.getElementById("app")
if (root) {
    render(() => <App />, root)
}
else {
    // Intentional: bootstrap diagnostic runs before the renderer logger
    // facade is reliably available in the SolidJS test harness; this is
    // the equivalent of the CLI/main.ts console.* exemption.
    console.error(t("error.missingRequiredParameters"))
}
