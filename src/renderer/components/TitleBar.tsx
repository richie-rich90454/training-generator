import { createSignal, onMount, onCleanup } from "solid-js"
import type { JSX } from "solid-js"
import type { AppStore } from "../stores/appStore.js"
import { t } from "../i18n.js"
import { renderIcon } from "../icons.js"
import { Icon } from "./Icon.js"
import styles from "./styles/TitleBar.module.css"
export interface TitleBarProps {
    appStore: AppStore
}
export function TitleBar(props: TitleBarProps): JSX.Element {
    const [isMaximized, setIsMaximized] = createSignal(false)
    let unsubscribe: (() => void) | null = null
    onMount(() => {
        const api = window.electronAPI
        if (api?.onWindowMaximizedChange) {
            unsubscribe = api.onWindowMaximizedChange((maximized: boolean) => {
                setIsMaximized(maximized)
            })
        }
    })
    onCleanup(() => {
        if (unsubscribe) {
            unsubscribe()
            unsubscribe = null
        }
    })
    function handleMinimize(): void {
        window.electronAPI?.windowMinimize?.()
    }
    function handleMaximize(): void {
        window.electronAPI?.windowMaximizeToggle?.()
    }
    function handleClose(): void {
        window.electronAPI?.windowClose?.()
    }
    return (
        <div class={styles["title-bar"]}>
            <div class={styles["title-bar-drag-region"]} onDblClick={handleMaximize}>
                <div class={styles["title-bar-icon"]} aria-hidden="true">
                    <img src="./assets/icon.svg" alt="" aria-hidden="true" />
                </div>
                <span class={styles["title-bar-title"]} data-i18n="app.title">{t("app.title")}</span>
            </div>
            <div class={styles["title-bar-actions"]}>
                <button
                    id="settings-btn"
                    class="btn-icon"
                    title={t("header.settings")}
                    aria-label={t("header.settings")}
                    data-i18n-title="header.settings"
                    data-i18n-aria-label="header.settings"
                    onClick={() => props.appStore.showSettings()}
                >
                    <Icon html={renderIcon("fa-cog")} />
                </button>
                <button
                    id="theme-toggle-btn"
                    class="btn-icon"
                    aria-label={t("titleBar.themeToggle.aria")}
                    aria-pressed={props.appStore.settingsStore.appSettings.theme === "dark"}
                    data-i18n-aria-label="titleBar.themeToggle.aria"
                    data-icon={props.appStore.settingsStore.appSettings.theme === "dark" ? "fa-sun" : "fa-moon"}
                    onClick={() => {
                        const current = props.appStore.settingsStore.appSettings.theme
                        const next = current === "dark" ? "light" : "dark"
                        props.appStore.settingsStore.setAppSetting("theme", next)
                        props.appStore.settingsStore.saveAppSettings()
                    }}
                >
                    <Icon html={props.appStore.settingsStore.appSettings.theme === "dark" ? renderIcon("fa-sun") : renderIcon("fa-moon")} />
                </button>
                <button
                    id="help-btn"
                    class="btn-icon"
                    title={t("header.help")}
                    aria-label={t("header.help")}
                    data-i18n-title="header.help"
                    data-i18n-aria-label="header.help"
                    onClick={() => props.appStore.showHelp()}
                >
                    <Icon html={renderIcon("fa-question-circle")} />
                </button>
            </div>
            <div class={styles["window-controls"]}>
                <button
                    class={`${styles["window-btn"]} ${styles["window-btn-min"]}`}
                    aria-label={t("window.minimize")}
                    data-i18n-aria-label="window.minimize"
                    onClick={handleMinimize}
                >
                    <svg viewBox="0 0 10 10" width="10" height="10"><line x1="2" y1="5" x2="8" y2="5" stroke="currentColor" stroke-width="1" /></svg>
                </button>
                <button
                    class={`${styles["window-btn"]} ${styles["window-btn-max"]}`}
                    classList={{ [styles["is-maximized"]]: isMaximized() }}
                    aria-label={isMaximized() ? t("window.restore") : t("window.maximize")}
                    data-i18n-aria-label={isMaximized() ? "window.restore" : "window.maximize"}
                    onClick={handleMaximize}
                >
                    <svg class={styles["icon-maximize"]} viewBox="0 0 10 10" width="10" height="10"><rect x="2" y="2" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1" /></svg>
                    <svg class={styles["icon-restore"]} viewBox="0 0 10 10" width="10" height="10"><rect x="2" y="3" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1" /><rect x="3" y="2" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1" /></svg>
                </button>
                <button
                    class={`${styles["window-btn"]} ${styles["window-btn-close"]}`}
                    aria-label={t("window.close")}
                    data-i18n-aria-label="window.close"
                    onClick={handleClose}
                >
                    <svg viewBox="0 0 10 10" width="10" height="10"><line x1="2" y1="2" x2="8" y2="8" stroke="currentColor" stroke-width="1" /><line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" stroke-width="1" /></svg>
                </button>
            </div>
        </div>
    )
}
