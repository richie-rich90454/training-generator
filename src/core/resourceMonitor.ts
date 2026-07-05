import os from "os"
export interface ResourceSnapshot{
    timestamp: number
    tokensPerSecond: number
    chunksPerSecond: number
    memoryMB: number
    cpuPercent: number
}
export interface AggregatedPoint{
    timestamp: number
    value: number
}
export type ResourceMetric="tokensPerSecond"|"chunksPerSecond"|"memoryMB"|"cpuPercent"
export interface ResourceMonitorOptions{
    maxDataPoints?: number
    intervalMs?: number
    getMemoryMB?: () => number
    getCpuPercent?: () => number
}
interface CpuUsage{
    user: number
    system: number
}
interface PreviousCapture{
    tokens: number
    chunks: number
    time: number
    cpuUsage: CpuUsage
}
export class ResourceMonitor{
    private history: ResourceSnapshot[]
    private maxDataPoints: number
    private intervalMs: number
    private timer?: any
    private previous: PreviousCapture|null
    private getMemoryMB: () => number
    private getCpuPercent: () => number
    private cpuCount: number
    constructor(options: ResourceMonitorOptions={}){
        this.history=[]
        this.maxDataPoints=options.maxDataPoints??300
        this.intervalMs=options.intervalMs??1000
        this.timer=undefined
        this.previous=null
        this.cpuCount=os.cpus().length
        this.getMemoryMB=options.getMemoryMB??this.defaultMemoryMB
        this.getCpuPercent=options.getCpuPercent??this.defaultCpuPercent
    }
    private defaultMemoryMB(): number{
        return Math.round(process.memoryUsage().heapUsed/(1024*1024)*100)/100
    }
    private defaultCpuPercent(): number{
        let usage=process.cpuUsage()
        if (this.previous===null){
            return 0
        }
        let deltaUser=usage.user-this.previous.cpuUsage.user
        let deltaSystem=usage.system-this.previous.cpuUsage.system
        let delta=(deltaUser+deltaSystem)/1000
        let elapsed=Date.now()-this.previous.time
        if (elapsed<=0){
            return 0
        }
        let percent=(delta/elapsed)/this.cpuCount*100
        return Math.min(100, Math.round(percent*100)/100)
    }
    record(snapshot: ResourceSnapshot): void{
        this.history.push(snapshot)
        if (this.history.length>this.maxDataPoints){
            this.history.shift()
        }
    }
    capture(totals: {tokens: number, chunks: number}): ResourceSnapshot{
        let now=Date.now()
        let tokensPerSecond=0
        let chunksPerSecond=0
        if (this.previous!==null&&now>this.previous.time){
            let elapsed=(now-this.previous.time)/1000
            tokensPerSecond=Math.round((totals.tokens-this.previous.tokens)/elapsed)
            chunksPerSecond=Math.round((totals.chunks-this.previous.chunks)/elapsed)
        }
        let snapshot: ResourceSnapshot={
            timestamp: now,
            tokensPerSecond: tokensPerSecond,
            chunksPerSecond: chunksPerSecond,
            memoryMB: this.getMemoryMB(),
            cpuPercent: this.getCpuPercent()
        }
        this.previous={
            tokens: totals.tokens,
            chunks: totals.chunks,
            time: now,
            cpuUsage: process.cpuUsage()
        }
        this.record(snapshot)
        return snapshot
    }
    start(collector: () => {tokens: number, chunks: number}): void{
        this.stop()
        this.capture(collector())
        this.timer=setInterval(() => {
            this.capture(collector())
        }, this.intervalMs)
    }
    stop(): void{
        if (this.timer){
            clearInterval(this.timer)
            this.timer=undefined
        }
    }
    getHistory(durationMs?: number): ResourceSnapshot[]{
        if (durationMs===undefined){
            return [...this.history]
        }
        let cutoff=Date.now()-durationMs
        return this.history.filter((s) => s.timestamp>=cutoff)
    }
    getLatest(): ResourceSnapshot|undefined{
        if (this.history.length===0){
            return undefined
        }
        return this.history[this.history.length-1]
    }
    getDuration(): number{
        if (this.history.length<2){
            return 0
        }
        return this.history[this.history.length-1].timestamp-this.history[0].timestamp
    }
    getSeries(metric: ResourceMetric): AggregatedPoint[]{
        return this.history.map((s) => {
            return {timestamp: s.timestamp, value: s[metric]}
        })
    }
    getAverage(metric: ResourceMetric, durationMs?: number): number{
        let samples=this.getHistory(durationMs)
        if (samples.length===0){
            return 0
        }
        let sum=samples.reduce((acc, s) => acc+s[metric], 0)
        return Math.round(sum/samples.length*100)/100
    }
    getPeak(metric: ResourceMetric, durationMs?: number): number{
        let samples=this.getHistory(durationMs)
        if (samples.length===0){
            return 0
        }
        return Math.max(...samples.map((s) => s[metric]))
    }
    aggregate(metric: ResourceMetric, bucketMs: number): AggregatedPoint[]{
        if (bucketMs<=0||this.history.length===0){
            return []
        }
        let buckets: Record<number, number[]>={}
        this.history.forEach((s) => {
            let bucket=Math.floor(s.timestamp/bucketMs)*bucketMs
            if (buckets[bucket]===undefined){
                buckets[bucket]=[]
            }
            buckets[bucket].push(s[metric])
        })
        return Object.keys(buckets).sort((a, b) => Number(a)-Number(b)).map((key) => {
            let values=buckets[Number(key)]
            let sum=values.reduce((acc, v) => acc+v, 0)
            return {timestamp: Number(key), value: Math.round(sum/values.length*100)/100}
        })
    }
    clear(): void{
        this.history=[]
        this.previous=null
        this.stop()
    }
}
