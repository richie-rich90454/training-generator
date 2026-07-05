import crypto from "crypto"
import type { TrainingItem } from "../types/index.js"
export interface ProcessCacheEntry{
    hash: string
    model: string
    prompt: string
    items: TrainingItem[]
    processedAt: number
}
export interface IncrementalProcessorOptions{
    model: string
    prompt: string
    cache?: Map<string, ProcessCacheEntry>
    hasher?: (chunk: string)=>string
}
export function chunkHash(chunk: string): string{
    return crypto.createHash("sha256").update(chunk).digest("hex")
}
export class IncrementalProcessor{
    private model: string
    private prompt: string
    private cache: Map<string, ProcessCacheEntry>
    private hasher: (chunk: string)=>string
    private hitCount: number
    private missCount: number
    private skipCount: number
    constructor(options: IncrementalProcessorOptions){
        this.model=options.model
        this.prompt=options.prompt
        this.cache=options.cache??new Map()
        this.hasher=options.hasher??chunkHash
        this.hitCount=0
        this.missCount=0
        this.skipCount=0
    }
    computeHash(chunk: string): string{
        return this.hasher(chunk)
    }
    makeCacheKey(hash: string): string{
        return `${hash}:${this.model}:${this.prompt}`
    }
    isCached(chunk: string): boolean{
        let key=this.makeCacheKey(this.computeHash(chunk))
        if(this.cache.has(key)){
            this.hitCount++
            return true
        }
        this.missCount++
        return false
    }
    getCached(chunk: string): TrainingItem[]|undefined{
        let key=this.makeCacheKey(this.computeHash(chunk))
        let entry=this.cache.get(key)
        if(entry){
            this.hitCount++
            return entry.items
        }
        this.missCount++
        return undefined
    }
    setCached(chunk: string, items: TrainingItem[]): void{
        let hash=this.computeHash(chunk)
        let key=this.makeCacheKey(hash)
        this.cache.set(key, {
            hash: hash,
            model: this.model,
            prompt: this.prompt,
            items: items,
            processedAt: Date.now()
        })
    }
    async process(chunks: string[], processor: (chunk: string)=>Promise<TrainingItem[]>): Promise<{results: TrainingItem[][], skipped: number, processed: number}>{
        let results: TrainingItem[][]=[]
        let skipped=0
        let processed=0
        for(let chunk of chunks){
            let key=this.makeCacheKey(this.computeHash(chunk))
            let entry=this.cache.get(key)
            if(entry){
                results.push(entry.items)
                skipped++
                this.hitCount++
                this.skipCount++
            }
            else{
                let items=await processor(chunk)
                this.setCached(chunk, items)
                results.push(items)
                processed++
                this.missCount++
            }
        }
        return {results, skipped, processed}
    }
    getStats(): {hitCount: number, missCount: number, skipCount: number}{
        return {
            hitCount: this.hitCount,
            missCount: this.missCount,
            skipCount: this.skipCount
        }
    }
}
