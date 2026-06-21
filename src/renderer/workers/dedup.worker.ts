import { deduplicate } from "../deduplicator.js"
import type { TrainingItem } from "../../types/index.js"

interface DedupWorkerMessage {
  items: TrainingItem[]
  threshold: number
}

self.onmessage = (e: MessageEvent<DedupWorkerMessage>) => {
  const { items, threshold } = e.data
  try {
    const result = deduplicate(items, threshold)
    self.postMessage(result)
  } catch (error) {
    self.postMessage({ items, removed: 0, error: (error as Error).message })
  }
}