import type { JSX } from "solid-js"
import { createSignal, For, Show } from "solid-js"
import type { AppStore } from "../stores/appStore.js"
import { Icon } from "./Icon.js"
import { renderIcon } from "../icons.js"
import { t } from "../i18n.js"
import cardsStyles from "./styles/Cards.module.css"
import buttonsStyles from "./styles/Buttons.module.css"
import uploadCardStyles from "./styles/UploadCard.module.css"
const styles = { ...cardsStyles, ...buttonsStyles, ...uploadCardStyles }
export interface UploadCardProps {
    appStore: AppStore
}
const ACCEPT_TYPES = ".pdf,.docx,.doc,.rtf,.txt,.md,.markdown,.html"
export function UploadCard(props: UploadCardProps): JSX.Element {
    const { fileStore, clearAll } = props.appStore
    const [dragOver, setDragOver] = createSignal(false)
    let fileInputRef: HTMLInputElement | undefined
    function handleFiles(files: FileList | null): void {
        if (!files || files.length === 0) {
            return
        }
        const result = fileStore.addFiles(Array.from(files))
        if (result.rejectedCount > 0) {
            props.appStore.uiStore.showToast(t("toast.noValidFiles"), "error")
        }
    }
    function handleDragOver(e: DragEvent): void {
        e.preventDefault()
        setDragOver(true)
    }
    function handleDragLeave(e: DragEvent): void {
        e.preventDefault()
        setDragOver(false)
    }
    function handleDrop(e: DragEvent): void {
        e.preventDefault()
        setDragOver(false)
        handleFiles(e.dataTransfer?.files ?? null)
    }
    function handleKeydown(e: KeyboardEvent): void {
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault()
            fileInputRef?.click()
        }
    }
    return (
        <div class={styles["card"]}>
            <div class={styles["card-header"]}>
                <div class={styles["card-title"]}>
                    <Icon html={renderIcon("fa-cloud-upload-alt")} />
                    <span data-i18n="upload.title">{t("upload.title")}</span>
                </div>
                <button
                    class={`${styles["btn"]} ${styles["btn-secondary"]} ${styles["btn--clear"]}`}
                    aria-label={t("upload.clearAria")}
                    data-i18n-aria-label="upload.clearAria"
                    onClick={clearAll}
                    disabled={!fileStore.hasFiles()}
                >
                    <Icon html={renderIcon("fa-trash")} />
                    <span data-i18n="upload.clear">{t("upload.clear")}</span>
                </button>
            </div>
            <div
                class={"file-upload-area" + (dragOver() ? " drag-over" : "")}
                role="button"
                aria-label={t("upload.dropzoneAria")}
                data-i18n-aria-label="upload.dropzoneAria"
                tabindex="0"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef?.click()}
                onKeyDown={handleKeydown}
            >
                <div class={styles["upload-icon"]}>
                    <Icon html={renderIcon("fa-file-upload")} class={`tg-icon-lg`} />
                </div>
                <div class={styles["upload-text"]}>
                    <h3 data-i18n="upload.dropzone">{t("upload.dropzone")}</h3>
                    <p data-i18n="upload.formats">{t("upload.formats")}</p>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    id="file-input"
                    multiple
                    accept={ACCEPT_TYPES}
                    class={`file-input`}
                    onChange={(e) => handleFiles(e.currentTarget.files)}
                />
                <button
                    id="browse-btn"
                    class={`${styles["btn"]} ${styles["btn-primary"]} ${styles["btn--upload"]}`}
                    title={t("upload.browseTitle")}
                    aria-label={t("upload.browseAria")}
                    data-i18n-title="upload.browseTitle"
                    data-i18n-aria-label="upload.browseAria"
                    onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef?.click()
                    }}
                >
                    <Icon html={renderIcon("fa-folder-open")} />
                    <span data-i18n="upload.browse">{t("upload.browse")}</span>
                </button>
            </div>
            <div class={styles["file-list-section"]}>
                <h3>
                    <Icon html={renderIcon("fa-file-alt")} />
                    <span data-i18n="files.selected">{t("files.selected")}</span>
                </h3>
                <div class={styles["file-list"]} role="list" aria-label={t("files.selectedAria")} data-i18n-aria-label="files.selectedAria">
                    <Show
                        when={fileStore.hasFiles()}
                        fallback={<p class={styles["empty-state"]} data-i18n="files.empty">{t("files.empty")}</p>}
                    >
                        <For each={fileStore.selectedFiles}>
                            {(file) => {
                                const status = () => fileStore.fileStatuses[file.name] || "waiting"
                                return (
                                    <div class={styles["file-item"]} role="listitem">
                                        <div class={styles["file-info"]}>
                                            <span class={styles["file-icon"]}>
                                                <Icon html={renderIcon("fa-file-" + fileStore.getFileIcon(file.type))} />
                                            </span>
                                            <div class={styles["file-details"]}>
                                                <span class={styles["file-name"]} title={file.name}>{file.name}</span>
                                                <span class={styles["file-size"]}>{fileStore.formatFileSize(file.size)}</span>
                                            </div>
                                        </div>
                                        <span class={styles["file-status"]} style={{ color: fileStore.getStatusColor(status()) }}>
                                            <span class={styles["file-status-label"]}>{fileStore.getStatusLabel(status())}</span>
                                            <Icon html={fileStore.getStatusIcon(status())} />
                                        </span>
                                        <button
                                            class={styles["file-remove"]}
                                            aria-label={t("file.removeAria", undefined, { name: file.name })}
                                            onClick={() => fileStore.removeFile(file.name)}
                                        >
                                            <Icon html={renderIcon("fa-times")} />
                                        </button>
                                    </div>
                                )
                            }}
                        </For>
                    </Show>
                </div>
            </div>
        </div>
    )
}
