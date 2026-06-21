import type { TrainingItem } from "../../types/index.js"

let chunkWorker: Worker | null = null
let dedupWorker: Worker | null = null

function supportsWorkers(): boolean {
  return typeof Worker !== "undefined"
}

function getChunkWorker(): Worker | null {
  if (!supportsWorkers()) return null
  if (!chunkWorker) {
    try {
      chunkWorker = new Worker(new URL("./chunk.worker.js", import.meta.url), { type: "module" })
    } catch {
      return null
    }
  }
  return chunkWorker
}

function getDedupWorker(): Worker | null {
  if (!supportsWorkers()) return null
  if (!dedupWorker) {
    try {
      dedupWorker = new Worker(new URL("./dedup.worker.js", import.meta.url), { type: "module" })
    } catch {
      return null
    }
  }
  return dedupWorker
}

export function chunkInWorker(
  text: string,
  chunkSize: number,
  overlap: number
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const worker = getChunkWorker()
    if (!worker) {
      // Fallback: import and run on main thread
      import("../chunker.js").then(({ semanticChunk }) => {
        resolve(semanticChunk(text, chunkSize, overlap))
      }).catch(reject)
      return
    }

    const handler = (e: MessageEvent) => {
      worker.removeEventListener("message", handler)
      if (e.data.error) {
        reject(new Error(e.data.error))
      } else {
        resolve(e.data.chunks)
      }
    }

    worker.addEventListener("message", handler)
    worker.postMessage({ text, chunkSize, overlap })
  })
}

export function dedupInWorker(
  items: TrainingItem[],
  threshold: number = 0.9
): Promise<{ items: TrainingItem[]; removed: number }> {
  return new Promise((resolve, reject) => {
    const worker = getDedupWorker()
    if (!worker) {
      // Fallback: import and run on main thread
      import("../deduplicator.js").then(({ deduplicate }) => {
        resolve(deduplicate(items, threshold))
      }).catch(reject)
      return
    }

    const handler = (e: MessageEvent) => {
      worker.removeEventListener("message", handler)
      if (e.data.error) {
        reject(new Error(e.data.error))
      } else {
        resolve(e.data)
      }
    }

    worker.addEventListener("message", handler)
    worker.postMessage({ items, threshold })
  })
}

export function terminateWorkers(): void {
  if (chunkWorker) {
    chunkWorker.terminate()
    chunkWorker = null
  }
  if (dedupWorker) {
    dedupWorker.terminate()
    dedupWorker = null
  }
}