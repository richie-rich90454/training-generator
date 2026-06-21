import { semanticChunk } from "../chunker.js"

interface ChunkWorkerMessage {
  text: string
  chunkSize: number
  overlap: number
}

self.onmessage = (e: MessageEvent<ChunkWorkerMessage>) => {
  const { text, chunkSize, overlap } = e.data
  try {
    const chunks = semanticChunk(text, chunkSize, overlap)
    self.postMessage({ chunks })
  } catch (error) {
    self.postMessage({ chunks: [], error: (error as Error).message })
  }
}