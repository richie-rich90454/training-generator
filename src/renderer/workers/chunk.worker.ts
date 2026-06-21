import { semanticChunk } from "../chunker.js"

interface ChunkWorkerMessage {
  text: string
  chunkSize: number
  overlap: number
  smartSizing: boolean
}

self.onmessage = (e: MessageEvent<ChunkWorkerMessage>) => {
  const { text, chunkSize, overlap, smartSizing } = e.data
  try {
    const chunks = semanticChunk(text, chunkSize, overlap, smartSizing)
    self.postMessage({ chunks })
  } catch (error) {
    self.postMessage({ chunks: [], error: (error as Error).message })
  }
}