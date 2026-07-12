import { semanticChunk } from "../chunker.js"

interface ChunkWorkerMessage {
    id: number
    text: string
    chunkSize: number
    overlap: number
    smartSizing: boolean
}

self.onmessage = (e: MessageEvent<ChunkWorkerMessage>) => {
    // Validate the input shape up front. Throwing here would surface as an
    // unhandled 'error' event on the worker and leave the main thread waiting
    // forever for a response that never arrives, so we always post a message
    // back (using a sentinel id when one is not supplied).
    const data = e.data
    if (!data || typeof data !== "object") {
        self.postMessage({ id: -1, chunks: [], error: "Invalid worker message: missing data payload" })
        return
    }
    const id = typeof data.id === "number" ? data.id : -1
    try {
        if (typeof data.text !== "string") {
            throw new Error("Invalid worker message: 'text' must be a string")
        }
        if (typeof data.chunkSize !== "number" || !Number.isFinite(data.chunkSize) || data.chunkSize <= 0) {
            throw new Error("Invalid worker message: 'chunkSize' must be a positive finite number")
        }
        if (typeof data.overlap !== "number" || !Number.isFinite(data.overlap) || data.overlap < 0) {
            throw new Error("Invalid worker message: 'overlap' must be a non-negative finite number")
        }
        if (typeof data.smartSizing !== "boolean") {
            throw new Error("Invalid worker message: 'smartSizing' must be a boolean")
        }
        const { text, chunkSize, overlap, smartSizing } = data
        const chunks = semanticChunk(text, chunkSize, overlap, smartSizing)
        self.postMessage({ id, chunks })
    }
    catch (error) {
        self.postMessage({ id, chunks: [], error: (error as Error).message })
    }
}
