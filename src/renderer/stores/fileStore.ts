import { createStore, reconcile } from "solid-js/store"
import { createSignal, createMemo } from "solid-js"
import type { SelectedFile, FileListSortBy, FileListSortDir } from "../../types/index.js"
import { renderIcon } from "../icons.js"
import { t } from "../i18n.js"
const MAX_FILES = 100
const MAX_FILE_SIZE = 100 * 1024 * 1024
const VALID_EXTENSIONS = ["pdf", "docx", "doc", "rtf", "txt", "md", "markdown", "html"]
export type { FileListSortBy, FileListSortDir }
export interface FileStoreConfig {
    initialSortBy?: FileListSortBy
    initialSortDir?: FileListSortDir
    onSortChange?: (by: FileListSortBy, dir: FileListSortDir) => void
}
export interface FileAddResult {
    addedCount: number
    skippedCount: number
    rejectedCount: number
}
export interface FileStore {
    selectedFiles: SelectedFile[]
    fileStatuses: Record<string, string>
    addFiles: (files: File[]) => FileAddResult
    removeFile: (fileName: string) => void
    clearFiles: () => void
    setFileStatus: (fileName: string, status: string) => void
    setOllamaReady: (ready: boolean) => void
    setDemoActive: (active: boolean) => void
    demoActive: () => boolean
    hasFiles: () => boolean
    fileCount: () => number
    canProcess: () => boolean
    getFileIcon: (fileType: string) => string
    formatFileSize: (bytes: number) => string
    getStatusIcon: (status: string) => string
    getStatusLabel: (status: string) => string
    getStatusColor: (status: string) => string
    sortBy: () => FileListSortBy
    sortDir: () => FileListSortDir
    sortedFiles: () => SelectedFile[]
    setSortBy: (by: FileListSortBy) => void
    setSortDir: (dir: FileListSortDir) => void
}
function normalizeSortBy(value: unknown): FileListSortBy {
    return value === "name" || value === "size" ? value : "date"
}
function normalizeSortDir(value: unknown): FileListSortDir {
    return value === "desc" ? "desc" : "asc"
}
export function createFileStore(config: FileStoreConfig = {}): FileStore {
    const [selectedFiles, setSelectedFiles] = createStore<SelectedFile[]>([])
    const [fileStatuses, setFileStatuses] = createStore<Record<string, string>>({})
    const [ollamaReady, setOllamaReady] = createSignal(false)
    const [demoActive, setDemoActive] = createSignal(false)
    const [sortByValue, setSortByValue] = createSignal<FileListSortBy>(normalizeSortBy(config.initialSortBy))
    const [sortDirValue, setSortDirValue] = createSignal<FileListSortDir>(normalizeSortDir(config.initialSortDir))
    const hasFiles = createMemo(() => selectedFiles.length > 0)
    const fileCount = createMemo(() => selectedFiles.length)
    const canProcess = createMemo(() => hasFiles() && (ollamaReady() || demoActive()))
    const sortBy = () => sortByValue()
    const sortDir = () => sortDirValue()
    const sortedFiles = createMemo(() => {
        const files = selectedFiles
        const by = sortByValue()
        const dir = sortDirValue()
        if (files.length <= 1) return files
        const sorted = [...files].sort((a, b) => {
            let cmp = 0
            if (by === "name") {
                cmp = (a.name || "").localeCompare(b.name || "")
            } else if (by === "size") {
                cmp = (a.size ?? 0) - (b.size ?? 0)
            } else {
                const aTime = a.addedAt ?? 0
                const bTime = b.addedAt ?? 0
                cmp = aTime - bTime
            }
            if (cmp === 0) {
                cmp = (a.name || "").localeCompare(b.name || "")
            }
            return dir === "asc" ? cmp : -cmp
        })
        return sorted
    })
    function persistSort(): void {
        const cb = config.onSortChange
        if (cb) {
            cb(sortByValue(), sortDirValue())
        }
    }
    function setSortBy(by: FileListSortBy): void {
        if (sortByValue() === by) {
            setSortDirValue(sortDirValue() === "asc" ? "desc" : "asc")
        } else {
            setSortByValue(by)
            setSortDirValue("asc")
        }
        persistSort()
    }
    function setSortDir(dir: FileListSortDir): void {
        setSortDirValue(dir)
        persistSort()
    }
    function getFileExtension(file: File): string {
        const parts = file.name.split(".")
        const ext = parts.pop()
        return ext ? ext.toLowerCase() : ""
    }
    function isValidFile(file: File): boolean {
        const ext = getFileExtension(file)
        if (!ext || ext === file.name.toLowerCase()) return false
        return VALID_EXTENSIONS.includes(ext)
    }
    function buildSelectedFile(file: File): SelectedFile {
        const ext = getFileExtension(file)
        return {
            file,
            name: file.name,
            size: file.size,
            type: ext,
            path: (file as File & { path?: string }).path || null,
            addedAt: Date.now()
        }
    }
    function addFiles(files: File[]): FileAddResult {
        let addedCount = 0
        let skippedCount = 0
        let rejectedCount = 0
        const remainingSlots = MAX_FILES - selectedFiles.length
        if (remainingSlots <= 0) {
            return { addedCount: 0, skippedCount: 0, rejectedCount: files.length }
        }
        const existingNames = new Set(selectedFiles.map(f => f.name))
        let toAdd = files
        if (files.length > remainingSlots) {
            toAdd = files.slice(0, remainingSlots)
            rejectedCount += files.length - remainingSlots
        }
        const seenInBatch = new Set<string>()
        for (const file of toAdd) {
            if (!isValidFile(file)) {
                rejectedCount++
                continue
            }
            if (file.size > MAX_FILE_SIZE) {
                skippedCount++
                continue
            }
            if (existingNames.has(file.name) || seenInBatch.has(file.name)) {
                skippedCount++
                continue
            }
            const selected = buildSelectedFile(file)
            setSelectedFiles(selectedFiles.length, selected)
            setFileStatuses(selected.name, "waiting")
            seenInBatch.add(file.name)
            addedCount++
        }
        return { addedCount, skippedCount, rejectedCount }
    }
    function removeFile(fileName: string): void {
        setSelectedFiles(selectedFiles.filter(f => f.name !== fileName))
        setFileStatuses(reconcile(Object.fromEntries(Object.entries(fileStatuses).filter(([k])=>k!==fileName))))
    }
    function clearFiles(): void {
        setSelectedFiles([])
        setFileStatuses(reconcile({}))
    }
    function setFileStatus(fileName: string, status: string): void {
        if (selectedFiles.some(f => f.name === fileName)) {
            setFileStatuses(fileName, status)
        }
    }
    function getFileIcon(fileType: string): string {
        const icons: Record<string, string> = {
            pdf: "pdf",
            docx: "word",
            doc: "word",
            rtf: "file-alt",
            txt: "file-alt",
            md: "markdown",
            markdown: "markdown",
            html: "code"
        }
        return icons[fileType] || "file"
    }
    function formatFileSize(bytes: number): string {
        if (bytes === 0) return "0 " + t("fileSize.bytes")
        const k = 1024
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2))
        let label = t("fileSize.bytes")
        if (i === 0) label = value === 1 ? t("fileSize.byte") : t("fileSize.bytes")
        else if (i === 1) label = t("fileSize.kb")
        else if (i === 2) label = t("fileSize.mb")
        else if (i >= 3) label = t("fileSize.gb")
        return value + " " + label
    }
    function getStatusIcon(status: string): string {
        const iconMap: Record<string, string> = {
            waiting: renderIcon("fa-clock"),
            processing: '<span class="tg-spinner">' + renderIcon("fa-spinner") + "</span>",
            completed: renderIcon("fa-check-circle"),
            failed: renderIcon("fa-times-circle")
        }
        return iconMap[status] || renderIcon("fa-clock")
    }
    function getStatusLabel(status: string): string {
        const labelMap: Record<string, string> = {
            waiting: t("file.status.waiting"),
            processing: t("file.status.processing"),
            completed: t("file.status.completed"),
            failed: t("file.status.failed")
        }
        return labelMap[status] || t("file.status.waiting")
    }
    function getStatusColor(status: string): string {
        const colorMap: Record<string, string> = {
            waiting: "var(--text-secondary)",
            processing: "var(--primary-color)",
            completed: "var(--secondary-color)",
            failed: "var(--accent-color)"
        }
        return colorMap[status] || "var(--text-secondary)"
    }
    return {
        get selectedFiles() { return selectedFiles },
        get fileStatuses() { return fileStatuses },
        addFiles,
        removeFile,
        clearFiles,
        setFileStatus,
        setOllamaReady,
        setDemoActive,
        demoActive,
        hasFiles,
        fileCount,
        canProcess,
        getFileIcon,
        formatFileSize,
        getStatusIcon,
        getStatusLabel,
        getStatusColor,
        sortBy,
        sortDir,
        sortedFiles,
        setSortBy,
        setSortDir
    }
}
