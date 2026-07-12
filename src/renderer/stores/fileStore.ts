import { createStore, reconcile } from "solid-js/store"
import { createSignal, createMemo } from "solid-js"
import type { SelectedFile } from "../../types/index.js"
import { renderIcon } from "../icons.js"
import { t } from "../i18n.js"
const MAX_FILES = 100
const MAX_FILE_SIZE = 100 * 1024 * 1024
const VALID_EXTENSIONS = ["pdf", "docx", "doc", "rtf", "txt", "md", "html"]
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
}
export function createFileStore(): FileStore {
    const [selectedFiles, setSelectedFiles] = createStore<SelectedFile[]>([])
    const [fileStatuses, setFileStatuses] = createStore<Record<string, string>>({})
    const [ollamaReady, setOllamaReady] = createSignal(false)
    const [demoActive, setDemoActive] = createSignal(false)
    const hasFiles = createMemo(() => selectedFiles.length > 0)
    const fileCount = createMemo(() => selectedFiles.length)
    const canProcess = createMemo(() => hasFiles() && (ollamaReady() || demoActive()))
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
            path: (file as File & { path?: string }).path || null
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
            waiting: "#A19F9D",
            processing: "#0078D4",
            completed: "#107C10",
            failed: "#D13438"
        }
        return colorMap[status] || "#A19F9D"
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
        getStatusColor
    }
}
