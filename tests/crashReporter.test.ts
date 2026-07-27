// @vitest-environment node
import{describe, test, expect, vi, beforeEach, afterEach}from"vitest"
import{CrashReporter, CrashReporterConfig, CrashEvent, generateEventId}from"../src/core/crashReporter.js"
function getBuffer(reporter: CrashReporter): CrashEvent[]{
    return (reporter as unknown as {buffer: CrashEvent[]}).buffer
}
function createTransport(): {calls: CrashEvent[], transport: (event: CrashEvent)=>Promise<void>}{
    let calls: CrashEvent[]=[]
    let transport=vi.fn(async (event: CrashEvent)=>{calls.push(event)})
    return {calls, transport}
}
beforeEach(()=>{
    vi.clearAllMocks()
    process.removeAllListeners("uncaughtException")
    process.removeAllListeners("unhandledRejection")
})
afterEach(()=>{
    process.removeAllListeners("uncaughtException")
    process.removeAllListeners("unhandledRejection")
})
describe("generateEventId", ()=>{
    test("returns string ids of length 32", ()=>{
        let id=generateEventId()
        expect(typeof id).toBe("string")
        expect(id.length).toBe(32)
    })
    test("returns distinct ids", ()=>{
        let id1=generateEventId()
        let id2=generateEventId()
        expect(id1).not.toBe(id2)
    })
})
describe("CrashReporter", ()=>{
    test("captureException buffers event when enabled", ()=>{
        let reporter=new CrashReporter({config: {enabled: true}})
        reporter.captureException(new Error("boom"))
        expect(getBuffer(reporter).length).toBe(1)
        expect(getBuffer(reporter)[0].message).toBe("boom")
        expect(getBuffer(reporter)[0].level).toBe("error")
    })
    test("captureException includes exception details", ()=>{
        let error=new Error("boom")
        error.name="CustomError"
        error.stack="stack"
        let reporter=new CrashReporter({config: {enabled: true}})
        reporter.captureException(error)
        let event=getBuffer(reporter)[0]
        expect(event.exception?.type).toBe("CustomError")
        expect(event.exception?.value).toBe("boom")
        expect(event.exception?.stack).toBe("stack")
    })
    test("captureException includes context as tags", ()=>{
        let reporter=new CrashReporter({config: {enabled: true}})
        reporter.captureException(new Error("boom"), {userId: 123, section: "home"})
        let event=getBuffer(reporter)[0]
        expect(event.tags).toEqual({userId: "123", section: "home"})
    })
    test("captureMessage buffers event", ()=>{
        let reporter=new CrashReporter({config: {enabled: true}})
        reporter.captureMessage("hello")
        expect(getBuffer(reporter).length).toBe(1)
        expect(getBuffer(reporter)[0].message).toBe("hello")
        expect(getBuffer(reporter)[0].level).toBe("info")
    })
    test("captureMessage uses provided level", ()=>{
        let reporter=new CrashReporter({config: {enabled: true}})
        reporter.captureMessage("warn", "warning")
        expect(getBuffer(reporter)[0].level).toBe("warning")
    })
    test("addBreadcrumb included in subsequent events", ()=>{
        let reporter=new CrashReporter({config: {enabled: true}})
        reporter.addBreadcrumb("nav", "ui")
        reporter.captureMessage("msg")
        let event=getBuffer(reporter)[0]
        expect(event.breadcrumbs?.length).toBe(1)
        expect(event.breadcrumbs?.[0].message).toBe("nav")
        expect(event.breadcrumbs?.[0].category).toBe("ui")
    })
    test("setTag included in events", ()=>{
        let reporter=new CrashReporter({config: {enabled: true}})
        reporter.setTag("version", "1.0")
        reporter.captureMessage("msg")
        expect(getBuffer(reporter)[0].tags?.version).toBe("1.0")
    })
    test("addBreadcrumb trims oldest beyond limit", ()=>{
        let reporter=new CrashReporter({config: {enabled: true}})
        for (let i=0;i<105;i++){
            reporter.addBreadcrumb("b"+i)
        }
        reporter.captureMessage("msg")
        let event=getBuffer(reporter)[0]
        expect(event.breadcrumbs?.length).toBe(100)
        expect(event.breadcrumbs?.[0].message).toBe("b5")
    })
    test("flush sends buffered events via transport", async ()=>{
        let {calls, transport}=createTransport()
        let reporter=new CrashReporter({config: {enabled: true}, transport})
        reporter.captureMessage("a")
        reporter.captureMessage("b")
        await reporter.flush()
        expect(transport).toHaveBeenCalledTimes(2)
        expect(calls.length).toBe(2)
        expect(calls[0].message).toBe("a")
        expect(calls[1].message).toBe("b")
    })
    test("flush clears buffer after success", async ()=>{
        let {transport}=createTransport()
        let reporter=new CrashReporter({config: {enabled: true}, transport})
        reporter.captureMessage("a")
        await reporter.flush()
        expect(getBuffer(reporter).length).toBe(0)
    })
    test("flush no-op without transport", async ()=>{
        let reporter=new CrashReporter({config: {enabled: true}})
        reporter.captureMessage("a")
        await reporter.flush()
        expect(getBuffer(reporter).length).toBe(1)
    })
    test("disabled reporter ignores captureException", ()=>{
        let reporter=new CrashReporter({config: {enabled: false}})
        reporter.captureException(new Error("boom"))
        expect(getBuffer(reporter).length).toBe(0)
    })
    test("disabled reporter ignores captureMessage", ()=>{
        let reporter=new CrashReporter({config: {enabled: false}})
        reporter.captureMessage("hi")
        expect(getBuffer(reporter).length).toBe(0)
    })
    test("beforeSend can filter event", ()=>{
        let beforeSend=vi.fn((event: CrashEvent)=>event.message==="keep" ? event : null)
        let reporter=new CrashReporter({config: {enabled: true, beforeSend}})
        reporter.captureMessage("drop")
        reporter.captureMessage("keep")
        expect(getBuffer(reporter).length).toBe(1)
        expect(getBuffer(reporter)[0].message).toBe("keep")
    })
    test("beforeSend can mutate event", ()=>{
        let beforeSend=(event: CrashEvent)=>({...event, message: event.message+"!"})
        let reporter=new CrashReporter({config: {enabled: true, beforeSend}})
        reporter.captureMessage("hi")
        expect(getBuffer(reporter)[0].message).toBe("hi!")
    })
    test("sampleRate zero drops all events", ()=>{
        let reporter=new CrashReporter({config: {enabled: true, sampleRate: 0}})
        reporter.captureMessage("a")
        reporter.captureException(new Error("b"))
        expect(getBuffer(reporter).length).toBe(0)
    })
    test("sampleRate one keeps all events", ()=>{
        let reporter=new CrashReporter({config: {enabled: true, sampleRate: 1}})
        reporter.captureMessage("a")
        reporter.captureException(new Error("b"))
        expect(getBuffer(reporter).length).toBe(2)
    })
    test("sampleRate probabilistically drops or keeps", ()=>{
        let reporter=new CrashReporter({config: {enabled: true, sampleRate: 0.5}})
        let spy=vi.spyOn(Math, "random").mockReturnValue(0.9)
        reporter.captureMessage("above")
        expect(getBuffer(reporter).length).toBe(0)
        spy.mockReturnValue(0.1)
        reporter.captureMessage("below")
        expect(getBuffer(reporter).length).toBe(1)
        spy.mockRestore()
    })
    test("init installs uncaughtException handler when enabled", ()=>{
        let spy=vi.spyOn(process, "on")
        let reporter=new CrashReporter({config: {enabled: true}})
        reporter.init()
        expect(spy).toHaveBeenCalledWith("uncaughtException", expect.any(Function))
        spy.mockRestore()
    })
    test("init installs unhandledRejection handler when enabled", ()=>{
        let spy=vi.spyOn(process, "on")
        let reporter=new CrashReporter({config: {enabled: true}})
        reporter.init()
        expect(spy).toHaveBeenCalledWith("unhandledRejection", expect.any(Function))
        spy.mockRestore()
    })
    test("init does not install handlers when disabled", ()=>{
        let spy=vi.spyOn(process, "on")
        let reporter=new CrashReporter({config: {enabled: false}})
        reporter.init()
        expect(spy).not.toHaveBeenCalledWith("uncaughtException", expect.any(Function))
        expect(spy).not.toHaveBeenCalledWith("unhandledRejection", expect.any(Function))
        spy.mockRestore()
    })
    test("timestamp is current time", ()=>{
        let reporter=new CrashReporter({config: {enabled: true}})
        let before=Date.now()
        reporter.captureMessage("x")
        let after=Date.now()
        let event=getBuffer(reporter)[0]
        expect(event.timestamp).toBeGreaterThanOrEqual(before)
        expect(event.timestamp).toBeLessThanOrEqual(after)
    })
})
