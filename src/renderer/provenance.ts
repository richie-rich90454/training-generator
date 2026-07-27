import type { TrainingItem } from "../types/index.js"
export interface ProvenanceData {
    sourceFile: string
    chunkIndex: number
    model: string
    promptType: string
    timestamp: string
    _mergedFrom?: string[]
}
export function tagItem(item: TrainingItem, provenance: ProvenanceData): TrainingItem {
    if (item._provenance) return item
    return {
        ...item,
        _provenance: provenance
    }
}
function cloneItem(item: TrainingItem): TrainingItem {
    return { ...item }
}
export function mergeProvenance(surviving: TrainingItem, removed: TrainingItem, survivingSource?: string): TrainingItem {
    let existing = surviving._provenance as ProvenanceData | undefined
    let removedProv = removed._provenance as ProvenanceData | undefined
    if (!removedProv) return cloneItem(surviving)
    if (!existing) {
        return {
            ...cloneItem(surviving),
            _provenance: {
                ...removedProv,
                sourceFile: survivingSource || removedProv.sourceFile,
                _mergedFrom: Array.from(new Set([removedProv.sourceFile, ...(removedProv._mergedFrom || [])]))
            }
        }
    }
    let merged = [...(existing._mergedFrom || []), removedProv.sourceFile, ...(removedProv._mergedFrom || [])]
    let deduped = Array.from(new Set(merged))
    return {
        ...cloneItem(surviving),
        _provenance: {
            ...existing,
            _mergedFrom: deduped
        }
    }
}
