// @vitest-environment node
import {describe, it, expect, vi, beforeEach} from "vitest"
import {CronScheduler, parseCronExpression, getNextOccurrence, CronJob} from "../src/core/cronScheduler.js"
const hoisted=vi.hoisted(()=>{
    let tasks: Map<string, any>=new Map()
    let shouldThrow=false
    let scheduleMock=vi.fn((expression: string, handler: ()=>void|Promise<void>, options?: Record<string, unknown>)=>{
        let task={stop: vi.fn()}
        tasks.set(expression, task)
        return task
    })
    let validateMock=vi.fn((expression: string)=>true)
    function reset(): void{
        tasks.clear()
        shouldThrow=false
        scheduleMock.mockClear()
        validateMock.mockClear()
    }
    function getTask(expression: string): any{
        return tasks.get(expression)
    }
    function setThrow(value: boolean): void{
        shouldThrow=value
    }
    function getShouldThrow(): boolean{
        return shouldThrow
    }
    return {scheduleMock, validateMock, reset, getTask, setThrow, getShouldThrow}
})
vi.mock("node-cron", ()=>{
    if(hoisted.getShouldThrow()){
        throw new Error("node-cron not installed")
    }
    return {
        default: {
            schedule: (...args: any[])=>(hoisted.scheduleMock as any)(...args),
            validate: (...args: any[])=>(hoisted.validateMock as any)(...args)
        },
        schedule: (...args: any[])=>(hoisted.scheduleMock as any)(...args),
        validate: (...args: any[])=>(hoisted.validateMock as any)(...args)
    }
})
function createJob(overrides?: Partial<CronJob>): CronJob{
    return {
        id: "job-1",
        name: "test job",
        cronExpression: "* * * * *",
        source: "test",
        enabled: true,
        runCount: 0,
        ...overrides
    }
}
describe("CronScheduler", ()=>{
    beforeEach(()=>{
        hoisted.reset()
    })
    it("throws if node-cron not installed", async ()=>{
        hoisted.setThrow(true)
        let scheduler=new CronScheduler()
        await expect(scheduler.start()).rejects.toThrow("node-cron not installed")
        hoisted.setThrow(false)
    })
    it("constructor passes timezone to scheduled tasks", async ()=>{
        let scheduler=new CronScheduler({timezone: "UTC"})
        scheduler.addJob(createJob())
        await scheduler.start()
        expect(hoisted.scheduleMock).toHaveBeenCalledWith("* * * * *", expect.any(Function), expect.objectContaining({timezone: "UTC"}))
    })
    it("addJob stores job", ()=>{
        let scheduler=new CronScheduler()
        let job=createJob()
        scheduler.addJob(job)
        let jobs=scheduler.listJobs()
        expect(jobs).toHaveLength(1)
        expect(jobs[0].id).toBe("job-1")
    })
    it("removeJob removes job", ()=>{
        let scheduler=new CronScheduler()
        scheduler.addJob(createJob())
        expect(scheduler.removeJob("job-1")).toBe(true)
        expect(scheduler.listJobs()).toHaveLength(0)
        expect(scheduler.removeJob("missing")).toBe(false)
    })
    it("removeJob stops active task", async ()=>{
        let scheduler=new CronScheduler()
        scheduler.addJob(createJob())
        await scheduler.start()
        let task=hoisted.getTask("* * * * *")
        scheduler.removeJob("job-1")
        expect(task.stop).toHaveBeenCalled()
    })
    it("updateJob merges updates", ()=>{
        let scheduler=new CronScheduler()
        scheduler.addJob(createJob())
        expect(scheduler.updateJob("job-1", {name: "updated"})).toBe(true)
        expect(scheduler.listJobs()[0].name).toBe("updated")
        expect(scheduler.updateJob("missing", {name: "x"})).toBe(false)
    })
    it("listJobs returns all jobs", ()=>{
        let scheduler=new CronScheduler()
        scheduler.addJob(createJob({id: "a"}))
        scheduler.addJob(createJob({id: "b"}))
        expect(scheduler.listJobs()).toHaveLength(2)
    })
    it("start schedules enabled jobs", async ()=>{
        let scheduler=new CronScheduler()
        scheduler.addJob(createJob({id: "enabled", cronExpression: "0 * * * *"}))
        scheduler.addJob(createJob({id: "disabled", cronExpression: "30 * * * *", enabled: false}))
        await scheduler.start()
        expect(hoisted.scheduleMock).toHaveBeenCalledTimes(1)
        expect(hoisted.scheduleMock).toHaveBeenCalledWith("0 * * * *", expect.any(Function), expect.any(Object))
    })
    it("start clears previous tasks before rescheduling", async ()=>{
        let scheduler=new CronScheduler()
        scheduler.addJob(createJob())
        await scheduler.start()
        let firstTask=hoisted.getTask("* * * * *")
        await scheduler.start()
        expect(firstTask.stop).toHaveBeenCalled()
        expect(hoisted.scheduleMock).toHaveBeenCalledTimes(2)
    })
    it("stop stops all tasks", async ()=>{
        let scheduler=new CronScheduler()
        scheduler.addJob(createJob({id: "a"}))
        scheduler.addJob(createJob({id: "b"}))
        await scheduler.start()
        let taskA=hoisted.getTask("* * * * *")
        scheduler.stop()
        expect(taskA.stop).toHaveBeenCalled()
        expect(scheduler.listJobs()).toHaveLength(2)
    })
    it("runJobNow triggers onJob", async ()=>{
        let onJob=vi.fn()
        let scheduler=new CronScheduler({onJob})
        scheduler.addJob(createJob())
        await scheduler.runJobNow("job-1")
        expect(onJob).toHaveBeenCalledTimes(1)
        let passedJob=onJob.mock.calls[0][0] as CronJob
        expect(passedJob.id).toBe("job-1")
        expect(passedJob.runCount).toBe(1)
        expect(passedJob.lastRun).toBeDefined()
    })
    it("runJobNow throws for missing job", async ()=>{
        let scheduler=new CronScheduler()
        await expect(scheduler.runJobNow("missing")).rejects.toThrow("Job not found: missing")
    })
    it("runCount increments on scheduled execution", async ()=>{
        let scheduler=new CronScheduler()
        scheduler.addJob(createJob())
        await scheduler.start()
        let handler=hoisted.scheduleMock.mock.calls[0][1] as ()=>Promise<void>
        await handler()
        expect(scheduler.listJobs()[0].runCount).toBe(1)
    })
    it("disabled jobs are not scheduled", async ()=>{
        let scheduler=new CronScheduler()
        scheduler.addJob(createJob({enabled: false}))
        await scheduler.start()
        expect(hoisted.scheduleMock).not.toHaveBeenCalled()
    })
    it("getNextRun computes future timestamp", ()=>{
        let scheduler=new CronScheduler()
        let now=new Date()
        let targetMinute=(now.getMinutes()+2)%60
        let expression=`${targetMinute} * * * *`
        let ts=scheduler.getNextRun(expression)
        expect(ts).toBeDefined()
        expect(ts!).toBeGreaterThan(Date.now()-1000)
    })
    it("getNextRun returns undefined for invalid expression", ()=>{
        let scheduler=new CronScheduler()
        expect(scheduler.getNextRun("* * *")).toBeUndefined()
    })
    it("validateExpression accepts valid 5-field expression", ()=>{
        let scheduler=new CronScheduler()
        expect(scheduler.validateExpression("* * * * *")).toBe(true)
        expect(scheduler.validateExpression("0 0 * * *")).toBe(true)
    })
    it("validateExpression rejects invalid expression", ()=>{
        let scheduler=new CronScheduler()
        expect(scheduler.validateExpression("* * *")).toBe(false)
        expect(scheduler.validateExpression("a * * * *")).toBe(false)
        expect(scheduler.validateExpression("* * * * * *")).toBe(false)
    })
})
describe("parseCronExpression", ()=>{
    it("splits a 5-field cron expression", ()=>{
        let fields=parseCronExpression("0 12 * * 1")
        expect(fields.minute).toBe("0")
        expect(fields.hour).toBe("12")
        expect(fields.dayOfMonth).toBe("*")
        expect(fields.month).toBe("*")
        expect(fields.dayOfWeek).toBe("1")
    })
    it("throws for wrong number of fields", ()=>{
        expect(()=>parseCronExpression("* * *")).toThrow("Invalid cron expression: expected 5 fields")
    })
})
describe("getNextOccurrence", ()=>{
    it("returns current minute for wildcard fields", ()=>{
        let from=new Date(2025, 0, 1, 12, 30, 0)
        let fields=parseCronExpression("* * * * *")
        let next=getNextOccurrence(fields, from)
        expect(next.getTime()).toBe(from.getTime())
    })
    it("advances to next minute for wildcard fields when seconds are present", ()=>{
        let from=new Date(2025, 0, 1, 12, 30, 45)
        let fields=parseCronExpression("* * * * *")
        let next=getNextOccurrence(fields, from)
        expect(next.getSeconds()).toBe(0)
        expect(next.getTime()).toBeGreaterThanOrEqual(from.getTime())
    })
    it("matches exact minute", ()=>{
        let from=new Date(2025, 0, 1, 12, 30, 0)
        let fields=parseCronExpression("35 * * * *")
        let next=getNextOccurrence(fields, from)
        expect(next.getMinutes()).toBe(35)
        expect(next.getHours()).toBe(12)
    })
    it("rolls over to next hour for exact minute", ()=>{
        let from=new Date(2025, 0, 1, 12, 45, 0)
        let fields=parseCronExpression("30 * * * *")
        let next=getNextOccurrence(fields, from)
        expect(next.getMinutes()).toBe(30)
        expect(next.getHours()).toBe(13)
    })
})
