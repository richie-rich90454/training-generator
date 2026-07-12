import { deduplicate } from "../deduplicator.js"
import type { TrainingItem } from "../../types/index.js"

interface DedupWorkerMessage {
    id: number
    items: TrainingItem[]
    threshold: number
}

self.onmessage = (e: MessageEvent<DedupWorkerMessage>) => {
    // Validate the input shape up front. Throwing here would surface as an
    // unhandled 'error' event on the worker and leave the main thread waiting
    // forever for a response that never arrives, so we always post a message
    // back (using a sentinel id when one is not supplied). Note: the catch
    // block must not reference e.data.items, which may itself be the cause of
    // the failure (undefined / wrong shape).
    const data = e.data
    if (!data || typeof data !== "object") {
        self.postMessage({ id: -1, items: [], removed: 0, error: "Invalid worker message: missing data payload" })
        return
    }
    const id = typeof data.id === "number" ? data.id : -1
    try {
        if (!Array.isArray(data.items)) {
            throw new Error("Invalid worker message: 'items' must be an array")
        }
        if (typeof data.threshold !== "number" || !Number.isFinite(data.threshold)) {
            throw new Error("Invalid worker message: 'threshold' must be a finite number")
        }
        const { items, threshold } = data
        const result = deduplicate(items, threshold)
        self.postMessage({ id, ...result })
    }
    catch (error) {
        self.postMessage({ id, items: [], removed: 0, error: (error as Error).message })
    }
}
