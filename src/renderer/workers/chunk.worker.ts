import { semanticChunk } from "../chunker.js"

interface ChunkWorkerMessage {
    id: number
    text: string
    chunkSize: number
    overlap: number
    smartSizing: boolean
}

self.onmessage = (e: MessageEvent<ChunkWorkerMessage>) => {
    const id = e.data.id
    try {
        const { text, chunkSize, overlap, smartSizing } = e.data
        const chunks = semanticChunk(text, chunkSize, overlap, smartSizing)
        self.postMessage({ id, chunks })
    }
    catch (error) {
        self.postMessage({ id, chunks: [], error: (error as Error).message })
    }
}
