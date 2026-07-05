export interface CronJob{
    id: string;
    name: string;
    cronExpression: string;
    source: string;
    workspaceId?: string;
    options?: Record<string, unknown>;
    enabled: boolean;
    lastRun?: number;
    nextRun?: number;
    runCount: number;
}
export interface CronSchedulerOptions{
    onJob?: (job: CronJob)=>Promise<void>|void;
    timezone?: string;
}
interface CronFields{
    minute: string;
    hour: string;
    dayOfMonth: string;
    month: string;
    dayOfWeek: string;
}
interface CronTask{
    stop: ()=>void;
    start?: ()=>void;
    destroy?: ()=>void;
}
interface CronModule{
    schedule: (expression: string, handler: ()=>void|Promise<void>, options?: Record<string, unknown>)=>CronTask;
    validate: (expression: string)=>boolean;
}
export function parseCronExpression(expression: string): CronFields{
    let parts=expression.trim().split(/\s+/);
    if(parts.length!==5){
        throw new Error("Invalid cron expression: expected 5 fields");
    }
    return {
        minute: parts[0],
        hour: parts[1],
        dayOfMonth: parts[2],
        month: parts[3],
        dayOfWeek: parts[4]
    };
}
function matchesField(field: string, value: number): boolean{
    if(field==="*"){
        return true;
    }
    let exact=parseInt(field, 10);
    if(!isNaN(exact)){
        return exact===value;
    }
    return false;
}
function getComponentsInTimezone(date: Date, timezone: string): {year: number, month: number, day: number, hour: number, minute: number, dayOfWeek: number}{
    let s=date.toLocaleString("en-US", {timeZone: timezone, hour12: false});
    let [datePart, timePart]=s.split(", ");
    let [m, d, y]=datePart.split("/").map((v)=>parseInt(v, 10));
    let [hr, min]=timePart.split(":").map((v)=>parseInt(v, 10));
    let candidate=new Date(y, m-1, d, hr, min);
    return {
        year: y,
        month: m,
        day: d,
        hour: hr,
        minute: min,
        dayOfWeek: candidate.getDay()
    };
}
export function getNextOccurrence(fields: CronFields, fromDate: Date, timezone?: string): Date{
    let date=new Date(fromDate.getTime());
    date.setSeconds(0, 0);
    if(date.getTime()<fromDate.getTime()){
        date.setMinutes(date.getMinutes()+1);
    }
    let limit=366*24*60;
    for(let i=0; i<limit; i++){
        let comps: {year: number, month: number, day: number, hour: number, minute: number, dayOfWeek: number};
        if(timezone){
            comps=getComponentsInTimezone(date, timezone);
        }
        else{
            comps={
                year: date.getFullYear(),
                month: date.getMonth()+1,
                day: date.getDate(),
                hour: date.getHours(),
                minute: date.getMinutes(),
                dayOfWeek: date.getDay()
            };
        }
        if(matchesField(fields.month, comps.month)&&matchesField(fields.dayOfMonth, comps.day)&&matchesField(fields.dayOfWeek, comps.dayOfWeek)&&matchesField(fields.hour, comps.hour)&&matchesField(fields.minute, comps.minute)){
            return date;
        }
        date.setMinutes(date.getMinutes()+1);
    }
    throw new Error("Unable to find next cron occurrence");
}
export class CronScheduler{
    private jobs: Map<string, CronJob>;
    private tasks: Map<string, CronTask>;
    private onJob?: (job: CronJob)=>Promise<void>|void;
    private timezone?: string;
    private cronModule?: CronModule;
    constructor(options: CronSchedulerOptions={}){
        this.jobs=new Map();
        this.tasks=new Map();
        this.onJob=options.onJob;
        this.timezone=options.timezone;
    }
    private async loadCron(): Promise<CronModule>{
        if(this.cronModule){
            return this.cronModule;
        }
        let module: any;
        try{
            module=await import("node-cron");
        }
        catch{
            throw new Error("node-cron not installed");
        }
        this.cronModule=module.default||module;
        return this.cronModule!;
    }
    addJob(job: CronJob): void{
        this.jobs.set(job.id, {...job});
    }
    removeJob(id: string): boolean{
        this.stopTask(id);
        return this.jobs.delete(id);
    }
    updateJob(id: string, updates: Partial<CronJob>): boolean{
        let job=this.jobs.get(id);
        if(!job){
            return false;
        }
        let updated={...job, ...updates};
        this.jobs.set(id, updated);
        return true;
    }
    listJobs(): CronJob[]{
        return Array.from(this.jobs.values());
    }
    async start(): Promise<void>{
        let cron=await this.loadCron();
        this.stop();
        for(let job of this.jobs.values()){
            if(job.enabled){
                this.scheduleJob(job, cron);
            }
        }
    }
    stop(): void{
        for(let task of this.tasks.values()){
            task.stop();
        }
        this.tasks.clear();
    }
    async runJobNow(id: string): Promise<void>{
        let job=this.jobs.get(id);
        if(!job){
            throw new Error(`Job not found: ${id}`);
        }
        await this.executeJob(job);
    }
    getNextRun(cronExpression: string, timezone?: string): number|undefined{
        try{
            let fields=parseCronExpression(cronExpression);
            let next=getNextOccurrence(fields, new Date(), timezone||this.timezone);
            return next.getTime();
        }
        catch{
            return undefined;
        }
    }
    validateExpression(cronExpression: string): boolean{
        let parts=cronExpression.trim().split(/\s+/);
        if(parts.length!==5){
            return false;
        }
        let fieldPattern=/^(\*|[0-9]+(?:-[0-9]+)?(?:\/[0-9]+)?)(,(\*|[0-9]+(?:-[0-9]+)?(?:\/[0-9]+)?))*$/;
        for(let part of parts){
            if(!fieldPattern.test(part)){
                return false;
            }
        }
        return true;
    }
    private scheduleJob(job: CronJob, cron: CronModule): void{
        let options={
            scheduled: true,
            timezone: this.timezone,
            ...job.options
        };
        let task=cron.schedule(job.cronExpression, async ()=>{
            await this.executeJob(job);
        }, options);
        this.tasks.set(job.id, task);
        let nextRun=this.getNextRun(job.cronExpression, this.timezone);
        if(nextRun!==undefined){
            this.updateJob(job.id, {nextRun});
        }
    }
    private async executeJob(job: CronJob): Promise<void>{
        let now=Date.now();
        this.updateJob(job.id, {lastRun: now, runCount: job.runCount+1});
        let updatedJob=this.jobs.get(job.id)!;
        let nextRun=this.getNextRun(updatedJob.cronExpression, this.timezone);
        if(nextRun!==undefined){
            this.updateJob(updatedJob.id, {nextRun});
        }
        if(this.onJob){
            await this.onJob(updatedJob);
        }
    }
    private stopTask(id: string): void{
        let task=this.tasks.get(id);
        if(task){
            task.stop();
            this.tasks.delete(id);
        }
    }
}
