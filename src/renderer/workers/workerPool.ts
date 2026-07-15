import type { TrainingItem } from "../../types/index.js"
import { logger } from "../logger.js"

let chunkWorker: Worker | null = null
let dedupWorker: Worker | null = null
let requestCounter: number = 0

interface ChunkPending {
  resolve: (chunks: string[]) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

interface DedupPending {
  resolve: (result: { items: TrainingItem[]; removed: number }) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const chunkPending: Map<number, ChunkPending> = new Map()
const dedupPending: Map<number, DedupPending> = new Map()

const TIMEOUT_MS: number = 60000
const MAX_WORKER_RESTARTS: number = 3
const MAX_PENDING: number = 100
const MAX_WORKER_PAYLOAD_CHARS: number = 10 * 1024 * 1024
const RESTART_BACKOFF_MS: number = 1000

let chunkRestarts: number = 0
let dedupRestarts: number = 0
let chunkBackoffUntil: number = 0
let dedupBackoffUntil: number = 0

function supportsWorkers(): boolean {
  return typeof Worker !== "undefined"
}

function rejectAllChunkPending(error: Error): void {
  for (const pending of chunkPending.values()) {
    clearTimeout(pending.timer)
    pending.reject(error)
  }
  chunkPending.clear()
}

function rejectAllDedupPending(error: Error): void {
  for (const pending of dedupPending.values()) {
    clearTimeout(pending.timer)
    pending.reject(error)
  }
  dedupPending.clear()
}

function recreateChunkWorker(worker: Worker | null): void {
  if (chunkWorker !== worker || !worker) return
  worker.terminate()
  chunkWorker = null
  if (chunkRestarts < MAX_WORKER_RESTARTS) {
    chunkRestarts++
    chunkBackoffUntil = Date.now() + RESTART_BACKOFF_MS * chunkRestarts
  } else {
    chunkBackoffUntil = 0
    rejectAllChunkPending(new Error("Chunk worker failed permanently after maximum restart attempts"))
  }
}

function recreateDedupWorker(worker: Worker | null): void {
  if (dedupWorker !== worker || !worker) return
  worker.terminate()
  dedupWorker = null
  if (dedupRestarts < MAX_WORKER_RESTARTS) {
    dedupRestarts++
    dedupBackoffUntil = Date.now() + RESTART_BACKOFF_MS * dedupRestarts
  } else {
    dedupBackoffUntil = 0
    rejectAllDedupPending(new Error("Dedup worker failed permanently after maximum restart attempts"))
  }
}

function createChunkWorker(): Worker | null {
  try {
    const worker = new Worker(new URL("./chunk.worker.js", import.meta.url), { type: "module" })
    worker.addEventListener("message", (e: MessageEvent) => {
      const pending = chunkPending.get(e.data.id)
      if (!pending) return
      chunkPending.delete(e.data.id)
      clearTimeout(pending.timer)
      if (e.data.error) {
        pending.reject(new Error(e.data.error))
      } else {
        chunkRestarts = 0
        chunkBackoffUntil = 0
        pending.resolve(e.data.chunks)
      }
    })
    worker.addEventListener("error", (e: ErrorEvent) => {
      recreateChunkWorker(worker)
      rejectAllChunkPending(new Error(e.message || "Worker error"))
    })
    worker.addEventListener("messageerror", () => {
      recreateChunkWorker(worker)
      rejectAllChunkPending(new Error("Failed to deserialize message"))
    })
    return worker
  } catch {
    return null
  }
}

function createDedupWorker(): Worker | null {
  try {
    const worker = new Worker(new URL("./dedup.worker.js", import.meta.url), { type: "module" })
    worker.addEventListener("message", (e: MessageEvent) => {
      const pending = dedupPending.get(e.data.id)
      if (!pending) return
      dedupPending.delete(e.data.id)
      clearTimeout(pending.timer)
      if (e.data.error) {
        pending.reject(new Error(e.data.error))
      } else {
        dedupRestarts = 0
        dedupBackoffUntil = 0
        pending.resolve(e.data)
      }
    })
    worker.addEventListener("error", (e: ErrorEvent) => {
      recreateDedupWorker(worker)
      rejectAllDedupPending(new Error(e.message || "Worker error"))
    })
    worker.addEventListener("messageerror", () => {
      recreateDedupWorker(worker)
      rejectAllDedupPending(new Error("Failed to deserialize message"))
    })
    return worker
  } catch {
    return null
  }
}

function getChunkWorker(): Worker | null {
  if (!supportsWorkers()) return null
  if (chunkRestarts >= MAX_WORKER_RESTARTS) return null
  if (Date.now() < chunkBackoffUntil) return null
  if (!chunkWorker) {
    chunkWorker = createChunkWorker()
  }
  return chunkWorker
}

function getDedupWorker(): Worker | null {
  if (!supportsWorkers()) return null
  if (dedupRestarts >= MAX_WORKER_RESTARTS) return null
  if (Date.now() < dedupBackoffUntil) return null
  if (!dedupWorker) {
    dedupWorker = createDedupWorker()
  }
  return dedupWorker
}

export async function chunkInWorker(
  text: string,
  chunkSize: number,
  overlap: number,
  smartSizing: boolean = false
): Promise<string[]> {
  if (chunkPending.size >= MAX_PENDING) {
    return Promise.reject(new Error("Too many pending worker requests"))
  }
  if (text.length > MAX_WORKER_PAYLOAD_CHARS) {
    logger.warn(`chunkInWorker: payload too large (${text.length} chars); truncating to ${MAX_WORKER_PAYLOAD_CHARS}`)
    text = text.slice(0, MAX_WORKER_PAYLOAD_CHARS)
  }

  const worker = getChunkWorker()
  if (!worker) {
    // Fallback: import and run on main thread
    const { semanticChunk } = await import("../chunker.js")
    return semanticChunk(text, chunkSize, overlap, smartSizing)
  }

  return new Promise((resolve, reject) => {
    const id = ++requestCounter
    const timer = setTimeout(() => {
      chunkPending.delete(id)
      reject(new Error("Worker timeout"))
      recreateChunkWorker(worker)
    }, TIMEOUT_MS)

    chunkPending.set(id, { resolve, reject, timer })
    // Transferable objects not applicable here: all data is text (strings/objects),
    // not ArrayBuffer, so structured clone is the correct transfer mechanism.
    worker.postMessage({ id, text, chunkSize, overlap, smartSizing })
  })
}

export function dedupInWorker(
  items: TrainingItem[],
  threshold: number = 0.9
): Promise<{ items: TrainingItem[]; removed: number }> {
  return new Promise((resolve, reject) => {
    if (dedupPending.size >= MAX_PENDING) {
      reject(new Error("Too many pending worker requests"))
      return
    }

    const worker = getDedupWorker()
    if (!worker) {
      // Fallback: import and run on main thread
      import("../deduplicator.js").then(({ deduplicate }) => {
        resolve(deduplicate(items, threshold))
      }).catch(reject)
      return
    }

    const id = ++requestCounter
    const timer = setTimeout(() => {
      dedupPending.delete(id)
      reject(new Error("Worker timeout"))
      recreateDedupWorker(worker)
    }, TIMEOUT_MS)

    dedupPending.set(id, { resolve, reject, timer })
    // Transferable objects not applicable here: data is JSON-serializable objects (items array),
    // not ArrayBuffer, so structured clone is the correct transfer mechanism.
    worker.postMessage({ id, items, threshold })
  })
}

export function terminateWorkers(): void {
  chunkRestarts = 0
  dedupRestarts = 0
  chunkBackoffUntil = 0
  dedupBackoffUntil = 0
  rejectAllChunkPending(new Error("Workers terminated"))
  rejectAllDedupPending(new Error("Workers terminated"))
  if (chunkWorker) {
    chunkWorker.terminate()
    chunkWorker = null
  }
  if (dedupWorker) {
    dedupWorker.terminate()
    dedupWorker = null
  }
}
