import type { JSX } from "solid-js"
import type { AppStore } from "../stores/appStore.js"
import { Icon } from "./Icon.js"
import { renderIcon } from "../icons.js"
import { t } from "../i18n.js"
import footerStyles from "./styles/Footer.module.css"
const styles = { ...footerStyles }
export interface FooterProps {
    appStore: AppStore
}
const REPO_URL = "https://github.com/richie-rich90454/training-generator"
const DOCS_URL = "https://github.com/richie-rich90454/training-generator#readme"
const ISSUES_URL = "https://github.com/richie-rich90454/training-generator/issues"
export function Footer(props: FooterProps): JSX.Element {
    function openLink(url: string): void {
        if (window.electronAPI && (window.electronAPI as any).openExternal) {
            (window.electronAPI as any).openExternal(url)
        }
        else {
            window.open(url, "_blank")
        }
    }
    return (
        <footer class={styles["app-footer"]}>
            <div class={styles["footer-status"]}>
                <span class={`status-version`} data-i18n="status.version">{t("status.version")}</span>
                <div class={styles["footer-links"]}>
                    <a
                        class={styles["footer-link"]}
                        href={DOCS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => { e.preventDefault(); openLink(DOCS_URL) }}
                    >
                        <Icon html={renderIcon("fa-book")} />
                        <span data-i18n="footer.documentation">{t("footer.documentation")}</span>
                    </a>
                    <a
                        class={styles["footer-link"]}
                        href={ISSUES_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => { e.preventDefault(); openLink(ISSUES_URL) }}
                    >
                        <Icon html={renderIcon("fa-bug")} />
                        <span data-i18n="footer.reportIssue">{t("footer.reportIssue")}</span>
                    </a>
                    <a
                        class={styles["footer-link"]}
                        href={REPO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => { e.preventDefault(); openLink(REPO_URL) }}
                    >
                        <Icon html={renderIcon("fa-star")} />
                        <span data-i18n="footer.star">{t("footer.star")}</span>
                    </a>
                </div>
            </div>
        </footer>
    )
}
