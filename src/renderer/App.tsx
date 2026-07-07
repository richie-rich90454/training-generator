// SolidJS root component.
// Bootstraps the renderer process, wires global keyboard shortcuts,
// mounts shared UI chrome (title bar, toasts, modals, dashboards),
// and renders the fine-grained reactive component tree.
import { render } from "solid-js/web"
import type { JSX } from "solid-js"
import { onMount, onCleanup } from "solid-js"
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
                    appStore.showShortcutsHelp()
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
        window.addEventListener("beforeunload", (e) => {
            if (appStore.isProcessing()) {
                e.preventDefault();
                (e as BeforeUnloadEvent).returnValue = ""
            }
        })
    })
    onCleanup(() => {
        document.removeEventListener("keydown", handleKeydown)
        appStore.dispose()
    })
    return (
        <div class="app-container fade-in">
            <TitleBar appStore={appStore} />
            <ToastContainer appStore={appStore} />
            <ContentGrid appStore={appStore} />
            <Footer appStore={appStore} />
            <SettingsModal appStore={appStore} />
            <CommandPalette commands={commands} visible={appStore.uiStore.commandPaletteOpen()} onClose={appStore.uiStore.closeCommandPalette} />
            <Dashboard appStore={appStore} />
            <Devtools appStore={appStore} />
            <TemplateEditor appStore={appStore} />
            <AnalyticsDashboard items={appStore.outputStore.outputData} />
            <PromptEditor modelValue="" />
        </div>
    )
}
const root = document.getElementById("app")
if (root) {
    render(() => <App />, root)
}
else {
    console.error(t("error.missingRequiredParameters"))
}
