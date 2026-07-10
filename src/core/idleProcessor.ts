export interface IdleProcessorOptions{
    checkIntervalMs?: number;
    cpuThreshold?: number;
}
export interface LazyModelLoaderOptions{
    fetchModels: (provider: string)=>Promise<string[]>;
}
export class IdleProcessor{
    private checkIntervalMs: number;
    private cpuThreshold: number;
    private tasks: Array<()=>Promise<void>|void>;
    private running: boolean;
    private processing: boolean;
    private lastCpuUsage: {user: number; system: number}|null;
    private currentCpuPercent: number;
    private timerId: ReturnType<typeof setTimeout>|null;
    private idleCallbackId: number|null;
    constructor(options: IdleProcessorOptions={}){
        this.checkIntervalMs=options.checkIntervalMs??1000;
        this.cpuThreshold=options.cpuThreshold??10;
        this.tasks=[];
        this.running=false;
        this.processing=false;
        this.lastCpuUsage=null;
        this.currentCpuPercent=0;
        this.timerId=null;
        this.idleCallbackId=null;
    }
    registerTask(task: ()=>Promise<void>|void): void{
        this.tasks.push(task);
    }
    start(): void{
        if (this.running){
            return;
        }
        this.running=true;
        this._scheduleNext();
    }
    stop(): void{
        this.running=false;
        this._cancelScheduled();
    }
    isIdle(): boolean{
        return this.currentCpuPercent<this.cpuThreshold;
    }
    getPendingCount(): number{
        return this.tasks.length;
    }
    private _scheduleNext(): void{
        if (!this.running){
            return;
        }
        if (typeof requestIdleCallback!=="undefined"){
            this.idleCallbackId=requestIdleCallback((deadline)=>{
                this._onIdleCallback(deadline);
            }, {timeout: this.checkIntervalMs});
        }
        else{
            this.timerId=setTimeout(()=>{
                this._check();
            }, this.checkIntervalMs);
        }
    }
    private _cancelScheduled(): void{
        if (this.timerId!==null){
            clearTimeout(this.timerId);
            this.timerId=null;
        }
        if (this.idleCallbackId!==null){
            cancelIdleCallback(this.idleCallbackId);
            this.idleCallbackId=null;
        }
    }
    private _updateCpuUsage(): void{
        let usage=process.cpuUsage(this.lastCpuUsage??undefined);
        let totalMicros=usage.user+usage.system;
        this.currentCpuPercent=(totalMicros/1000)/this.checkIntervalMs*100;
        this.lastCpuUsage=process.cpuUsage();
    }
    private _check(): void{
        if (!this.running){
            return;
        }
        this._updateCpuUsage();
        if (this.isIdle()&&!this.processing){
            void this._runTasks();
        }
        this._scheduleNext();
    }
    private _onIdleCallback(deadline: IdleDeadline): void{
        this.idleCallbackId=null;
        if (!this.running){
            return;
        }
        this._updateCpuUsage();
        if (this.isIdle()&&!this.processing){
            void this._runTasks();
        }
        this._scheduleNext();
    }
    private async _runTasks(): Promise<void>{
        if (this.processing){
            return;
        }
        this.processing=true;
        while (this.tasks.length>0){
            let task=this.tasks.shift();
            if (task){
                await task();
            }
        }
        this.processing=false;
    }
}
export class LazyModelLoader{
    private fetchModels: (provider: string)=>Promise<string[]>;
    private cache: Map<string, Promise<string[]>|string[]>;
    constructor(options: LazyModelLoaderOptions){
        this.fetchModels=options.fetchModels;
        this.cache=new Map();
    }
    getModels(provider: string): Promise<string[]>{
        let cached=this.cache.get(provider);
        if (cached){
            return Promise.resolve(cached);
        }
        let promise=this.fetchModels(provider).then((models)=>{
            this.cache.set(provider, models);
            return models;
        }).catch((error)=>{
            this.cache.delete(provider);
            throw error;
        });
        this.cache.set(provider, promise);
        return promise;
    }
    invalidate(provider: string): void{
        this.cache.delete(provider);
    }
}
