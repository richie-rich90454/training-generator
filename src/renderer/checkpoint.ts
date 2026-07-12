import type{SelectedFile,TrainingItem}from "../types/index.js"
export const CHECKPOINT_VERSION=1
export interface CheckpointData{
    version?: number
    files: SelectedFile[]
    completedChunks: Record<string,number>
    outputData: TrainingItem[]
    config:{
        model: string
        processingType: string
        chunkSize: number
        concurrency: number
        provider: string
    }
    timestamp: number
}
function isSelectedFile(value: unknown): value is SelectedFile{
    if(value===null||typeof value!=="object")return false
    let obj=value as Record<string,unknown>
    return typeof obj.name==="string"&&typeof obj.size==="number"&&typeof obj.type==="string"
}
function isValidCheckpointData(value: unknown): value is CheckpointData{
    if(value===null||typeof value!=="object")return false
    let data=value as Record<string,unknown>
    let version=typeof data.version==="number"?data.version:CHECKPOINT_VERSION
    if(version!==CHECKPOINT_VERSION)return false
    if(!Array.isArray(data.files)||!data.files.every(isSelectedFile))return false
    if(data.completedChunks===null||typeof data.completedChunks!=="object")return false
    if(!Array.isArray(data.outputData))return false
    if(data.config===null||typeof data.config!=="object")return false
    let config=data.config as Record<string,unknown>
    if(typeof config.model!=="string"||typeof config.processingType!=="string"||typeof config.chunkSize!=="number"||typeof config.concurrency!=="number"||typeof config.provider!=="string")return false
    return typeof data.timestamp==="number"
}
export async function saveCheckpoint(data: CheckpointData): Promise<boolean>{
    if(!window.electronAPI?.saveCheckpoint)return false
    try{
        let dataWithVersion:CheckpointData={...data, version:CHECKPOINT_VERSION}
        await window.electronAPI.saveCheckpoint(dataWithVersion)
        return true
    }
    catch(error){
        console.error("Failed to save checkpoint:",error)
        return false
    }
}
export async function loadCheckpoint(): Promise<CheckpointData|null>{
    try{
        if(window.electronAPI?.loadCheckpoint){
            let result=await window.electronAPI.loadCheckpoint()
            if(result.success&&result.data&&isValidCheckpointData(result.data))return result.data as CheckpointData
        }
    }
    catch(error){
        console.error("Failed to load checkpoint:",error)
    }
    return null
}
export async function clearCheckpoint(): Promise<void>{
    try{
        if(window.electronAPI?.clearCheckpoint){
            await window.electronAPI.clearCheckpoint()
        }
    }
    catch(error){
        console.error("Failed to clear checkpoint:",error)
    }
}
