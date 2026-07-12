import { TrainingItem } from "../types/interfaces.js"
export type PipelineStatus="idle"|"running"|"paused"|"completed"|"failed"|"cancelled"
export interface PipelineEvent{
    type: "status"|"progress"|"step-start"|"step-end"|"log"|"error",
    timestamp: number,
    payload: unknown
}
export interface PipelineProgress{
    currentStep: number,
    totalSteps: number,
    stepName: string,
    percent: number,
    message?: string
}
export interface PipelineStep{
    name: string,
    run(context: PipelineContext): Promise<PipelineContext>
}
export interface PipelineContext{
    items: TrainingItem[],
    metadata: Record<string, unknown>,
    logs: string[],
    variables: Record<string, unknown>
}
export class PipelineOrchestrator{
    name: string
    steps: PipelineStep[]
    status: PipelineStatus
    progress: PipelineProgress
    context: PipelineContext
    events: PipelineEvent[]
    listeners: Set<(event: PipelineEvent)=>void>
    private resumePromise: Promise<void>|null
    private resumeResolve: (()=>void)|null
    constructor(options: {name?: string, steps: PipelineStep[]}){
        this.name=options.name ?? "pipeline"
        this.steps=options.steps
        this.status="idle"
        this.progress={currentStep: 0, totalSteps: options.steps.length, stepName: "", percent: 0}
        this.context={items: [], metadata: {}, logs: [], variables: {}}
        this.events=[]
        this.listeners=new Set()
        this.resumePromise=null
        this.resumeResolve=null
    }
    onEvent(listener: (event: PipelineEvent)=>void): ()=>void{
        this.listeners.add(listener)
        return ()=>{
            this.listeners.delete(listener)
        }
    }
    emit(event: PipelineEvent): void{
        this.events.push(event)
        for (let listener of this.listeners){
            listener(event)
        }
    }
    setStatus(status: PipelineStatus, message?: string): void{
        this.status=status
        this.emit({type: "status", timestamp: Date.now(), payload: {status, message}})
    }
    setProgress(progress: PipelineProgress): void{
        this.progress=progress
        this.emit({type: "progress", timestamp: Date.now(), payload: progress})
    }
    log(message: string): void{
        this.context.logs.push(message)
        this.emit({type: "log", timestamp: Date.now(), payload: message})
    }
    async run(initialContext?: Partial<PipelineContext>): Promise<PipelineContext>{
        if (initialContext){
            this.context={...this.context, ...initialContext}
        }
        if (!this.isCancelled()){
            this.setStatus("running")
        }
        this.setProgress({currentStep: 0, totalSteps: this.steps.length, stepName: "", percent: 0, message: "Pipeline started"})
        for (let i=0; i<this.steps.length; i++){
            await this.waitIfPaused()
            let step=this.steps[i]
            let percent=Math.round(((i+1)/this.steps.length)*100)
            this.setProgress({currentStep: i+1, totalSteps: this.steps.length, stepName: step.name, percent: percent, message: "Running step: " + step.name})
            this.emit({type: "step-start", timestamp: Date.now(), payload: {name: step.name, index: i}})
            try{
                if (this.isCancelled()){
                    throw new Error("Pipeline cancelled")
                }
                this.context=await step.run(this.context)
            }
            catch (error){
                this.setStatus("failed", error instanceof Error ? error.message : String(error))
                this.emit({type: "error", timestamp: Date.now(), payload: error})
                throw error
            }
            this.emit({type: "step-end", timestamp: Date.now(), payload: {name: step.name, index: i}})
        }
        if (!this.isCancelled()){
            this.setStatus("completed", "Pipeline completed")
            this.setProgress({currentStep: this.steps.length, totalSteps: this.steps.length, stepName: "", percent: 100, message: "Pipeline completed"})
        }
        return this.context
    }
    cancel(): void{
        this.setStatus("cancelled", "Pipeline cancelled")
    }
    pause(): void{
        if (this.status==="running"){
            this.setStatus("paused", "Pipeline paused")
            this.resumePromise=new Promise(resolve=>{
                this.resumeResolve=resolve
            })
        }
    }
    resume(): void{
        if (this.status==="paused"){
            this.setStatus("running", "Pipeline resumed")
            if (this.resumeResolve){
                this.resumeResolve()
                this.resumeResolve=null
                this.resumePromise=null
            }
        }
    }
    isCancelled(): boolean{
        return this.status==="cancelled"
    }
    private async waitIfPaused(): Promise<void>{
        if (this.status==="paused" && this.resumePromise){
            await this.resumePromise
        }
    }
}
export function createDefaultPipelineOrchestrator(): PipelineOrchestrator{
    return new PipelineOrchestrator({name: "default", steps: []})
}
