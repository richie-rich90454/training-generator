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
    const { fileStore, clearAll, uiStore } = props.appStore
    const [dragOver, setDragOver] = createSignal(false)
    const [dragCounter, setDragCounter] = createSignal(0)
    let fileInputRef: HTMLInputElement | undefined
    function handleFiles(files: FileList | null): void {
        if (!files || files.length === 0) {
            return
        }
        const result = fileStore.addFiles(Array.from(files))
        if (result.rejectedCount > 0) {
            props.appStore.uiStore.showToast(t("toast.noValidFiles"), "error")
        }
        if (result.skippedCount > 0) {
            props.appStore.uiStore.showToast(t("toast.filesSkipped", undefined, { count: String(result.skippedCount) }), "warning")
        }
    }
    function handleDragEnter(e: DragEvent): void {
        e.preventDefault()
        setDragCounter(dragCounter() + 1)
        setDragOver(true)
    }
    function handleDragOver(e: DragEvent): void {
        e.preventDefault()
    }
    function handleDragLeave(e: DragEvent): void {
        e.preventDefault()
        const next = dragCounter() - 1
        setDragCounter(Math.max(0, next))
        if (next <= 0) {
            setDragOver(false)
        }
    }
    function handleDrop(e: DragEvent): void {
        e.preventDefault()
        setDragCounter(0)
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
                id="drop-zone"
                class={"file-upload-area" + (dragOver() ? " drag-over" : "")}
                aria-label={t("upload.dropzoneAria")}
                data-i18n-aria-label="upload.dropzoneAria"
                tabindex="0"
                onDragEnter={handleDragEnter}
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
                    onChange={(e) => {
                        handleFiles(e.currentTarget.files)
                        e.currentTarget.value = ""
                    }}
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
                        <div class={styles["file-list-header"]} role="row">
                            <button
                                type="button"
                                class={`${styles["file-list-header-button"]}${fileStore.sortBy() === "name" ? " " + styles["file-list-header-button--active"] : ""}`}
                                aria-sort={fileStore.sortBy() === "name" ? (fileStore.sortDir() === "asc" ? "ascending" : "descending") : "none"}
                                onClick={() => fileStore.setSortBy("name")}
                                data-column="name"
                            >
                                <span data-i18n="fileList.column.name">{t("fileList.column.name")}</span>
                                <Show when={fileStore.sortBy() === "name"}>
                                    <span class={styles["file-list-header-arrow"]} aria-hidden="true">{fileStore.sortDir() === "asc" ? "▲" : "▼"}</span>
                                </Show>
                            </button>
                            <button
                                type="button"
                                class={`${styles["file-list-header-button"]}${fileStore.sortBy() === "size" ? " " + styles["file-list-header-button--active"] : ""}`}
                                aria-sort={fileStore.sortBy() === "size" ? (fileStore.sortDir() === "asc" ? "ascending" : "descending") : "none"}
                                onClick={() => fileStore.setSortBy("size")}
                                data-column="size"
                            >
                                <span data-i18n="fileList.column.size">{t("fileList.column.size")}</span>
                                <Show when={fileStore.sortBy() === "size"}>
                                    <span class={styles["file-list-header-arrow"]} aria-hidden="true">{fileStore.sortDir() === "asc" ? "▲" : "▼"}</span>
                                </Show>
                            </button>
                            <button
                                type="button"
                                class={`${styles["file-list-header-button"]}${fileStore.sortBy() === "date" ? " " + styles["file-list-header-button--active"] : ""}`}
                                aria-sort={fileStore.sortBy() === "date" ? (fileStore.sortDir() === "asc" ? "ascending" : "descending") : "none"}
                                onClick={() => fileStore.setSortBy("date")}
                                data-column="date"
                            >
                                <span data-i18n="fileList.column.date">{t("fileList.column.date")}</span>
                                <Show when={fileStore.sortBy() === "date"}>
                                    <span class={styles["file-list-header-arrow"]} aria-hidden="true">{fileStore.sortDir() === "asc" ? "▲" : "▼"}</span>
                                </Show>
                            </button>
                        </div>
                        <For each={fileStore.sortedFiles()}>
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
                                            data-i18n-aria-label="file.removeAria"
                                            data-i18n-aria-label-vars={JSON.stringify({ name: file.name })}
                                            title={t("file.removeAria", undefined, { name: file.name })}
                                            onClick={() => {
                                                const removedFile = file
                                                fileStore.removeFile(file.name)
                                                uiStore.showToast(t("toast.fileRemoved"), "info", undefined, {
                                                    action: () => fileStore.restoreFile(removedFile),
                                                    label: t("toast.undo")
                                                })
                                            }}
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
