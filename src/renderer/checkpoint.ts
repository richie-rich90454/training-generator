import type { SelectedFile, TrainingItem } from "../types/index.js"

export interface CheckpointData {
  files: SelectedFile[]
  completedChunks: Record<string, number>  // fileName -> chunks completed
  outputData: TrainingItem[]
  config: {
    model: string
    processingType: string
    chunkSize: string
    concurrency: string
    provider: string
  }
  timestamp: number
}

export async function saveCheckpoint(data: CheckpointData): Promise<void> {
  try {
    if (window.electronAPI?.saveCheckpoint) {
      await window.electronAPI.saveCheckpoint(data)
    }
  } catch (e) {
    console.error("Failed to save checkpoint:", e)
  }
}

export async function loadCheckpoint(): Promise<CheckpointData | null> {
  try {
    if (window.electronAPI?.loadCheckpoint) {
      let result = await window.electronAPI.loadCheckpoint()
      if (result.success && result.data) return result.data as CheckpointData
    }
  } catch (e) {
    console.error("Failed to load checkpoint:", e)
  }
  return null
}

export async function clearCheckpoint(): Promise<void> {
  try {
    if (window.electronAPI?.clearCheckpoint) {
      await window.electronAPI.clearCheckpoint()
    }
  } catch (e) {
    console.error("Failed to clear checkpoint:", e)
  }
}