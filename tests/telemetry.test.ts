// @vitest-environment node
import{describe, test, expect, vi, beforeEach}from"vitest"
import{Telemetry, TelemetryEvent, TelemetryStorage, scrubProperties, generateSessionId}from"../src/core/telemetry.js"
function getBuffer(telemetry: Telemetry): TelemetryEvent[]{
    return (telemetry as unknown as {buffer: TelemetryEvent[]}).buffer
}
let fetchMock: ReturnType<typeof vi.fn>
let mockFetch: typeof fetch
beforeEach(()=>{
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    fetchMock=vi.fn()
    mockFetch=fetchMock as unknown as typeof fetch
    fetchMock.mockResolvedValue({ok: true, status: 200})
})
describe("Telemetry", ()=>{
    test("track buffers event when enabled", ()=>{
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, fetch: mockFetch})
        telemetry.track("test.event", {foo: "bar"})
        expect(telemetry.getPendingCount()).toBe(1)
    })
    test("track drops when disabled", ()=>{
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: false, fetch: mockFetch})
        telemetry.track("test.event")
        expect(telemetry.getPendingCount()).toBe(0)
    })
    test("track samples by sampleRate zero", ()=>{
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, sampleRate: 0, fetch: mockFetch})
        telemetry.track("test.event")
        expect(telemetry.getPendingCount()).toBe(0)
    })
    test("track samples by sampleRate one", ()=>{
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, sampleRate: 1, fetch: mockFetch})
        telemetry.track("test.event")
        expect(telemetry.getPendingCount()).toBe(1)
    })
    test("track samples probabilistically", ()=>{
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, sampleRate: 0.5, fetch: mockFetch})
        let spy=vi.spyOn(Math, "random").mockReturnValue(0.9)
        telemetry.track("above")
        expect(telemetry.getPendingCount()).toBe(0)
        spy.mockReturnValue(0.1)
        telemetry.track("below")
        expect(telemetry.getPendingCount()).toBe(1)
        spy.mockRestore()
    })
    test("flush sends events", async ()=>{
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, fetch: mockFetch})
        telemetry.track("test.event", {foo: "bar"})
        await telemetry.flush()
        expect(fetchMock).toHaveBeenCalledTimes(1)
        let args=fetchMock.mock.calls[0]
        expect(args[0]).toBe("https://example.com/track")
        let init=args[1] as {body: string}
        let payload=JSON.parse(init.body)
        expect(payload.events.length).toBe(1)
        expect(payload.events[0].event).toBe("test.event")
        expect(payload.events[0].properties.foo).toBe("bar")
    })
    test("flush clears buffer after success", async ()=>{
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, fetch: mockFetch})
        telemetry.track("test.event")
        await telemetry.flush()
        expect(telemetry.getPendingCount()).toBe(0)
    })
    test("flush no-op when empty", async ()=>{
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, fetch: mockFetch})
        await telemetry.flush()
        expect(fetchMock).not.toHaveBeenCalled()
    })
    test("flush includes API key in headers", async ()=>{
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, apiKey: "secret123", fetch: mockFetch})
        telemetry.track("test.event")
        await telemetry.flush()
        let init=fetchMock.mock.calls[0][1] as {headers: Record<string, string>}
        expect(init.headers["X-API-Key"]).toBe("secret123")
    })
    test("flush sets content type JSON", async ()=>{
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, fetch: mockFetch})
        telemetry.track("test.event")
        await telemetry.flush()
        let init=fetchMock.mock.calls[0][1] as {headers: Record<string, string>}
        expect(init.headers["Content-Type"]).toBe("application/json")
    })
    test("flush throws on failure and keeps buffer", async ()=>{
        fetchMock.mockResolvedValue({ok: false, status: 500})
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, fetch: mockFetch})
        telemetry.track("test.event")
        await expect(telemetry.flush()).rejects.toThrow("Telemetry flush failed")
        expect(telemetry.getPendingCount()).toBe(1)
    })
    test("setEnabled updates state", ()=>{
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: false, fetch: mockFetch})
        expect(telemetry.isEnabled()).toBe(false)
        telemetry.setEnabled(true)
        expect(telemetry.isEnabled()).toBe(true)
    })
    test("track includes timestamp", ()=>{
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, fetch: mockFetch})
        let before=Date.now()
        telemetry.track("test.event")
        let after=Date.now()
        let event=getBuffer(telemetry)[0]
        expect(event.timestamp).toBeGreaterThanOrEqual(before)
        expect(event.timestamp).toBeLessThanOrEqual(after)
    })
    test("track includes sessionId", ()=>{
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, fetch: mockFetch})
        telemetry.track("test.event")
        let event=getBuffer(telemetry)[0]
        expect(event.sessionId).toBeDefined()
        expect(typeof event.sessionId).toBe("string")
    })
    test("generateSessionId stable per instance", ()=>{
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, fetch: mockFetch})
        telemetry.track("init")
        let id=getBuffer(telemetry)[0].sessionId
        telemetry.track("a")
        telemetry.track("b")
        expect(getBuffer(telemetry)[1].sessionId).toBe(id)
        expect(getBuffer(telemetry)[2].sessionId).toBe(id)
    })
    test("distinct instances have distinct session ids", ()=>{
        let telemetry1=new Telemetry({endpoint: "https://example.com/track", enabled: true, fetch: mockFetch})
        let telemetry2=new Telemetry({endpoint: "https://example.com/track", enabled: true, fetch: mockFetch})
        telemetry1.track("a")
        telemetry2.track("b")
        let id1=getBuffer(telemetry1)[0].sessionId
        let id2=getBuffer(telemetry2)[0].sessionId
        expect(id1).not.toBe(id2)
    })
    test("storage provides stable sessionId", ()=>{
        let store: Record<string, string>={}
        let storage: TelemetryStorage={
            getItem: (k: string)=>store[k] ?? null,
            setItem: (k: string, v: string)=>{store[k]=v}
        }
        let telemetry1=new Telemetry({endpoint: "https://example.com/track", enabled: true, storage, fetch: mockFetch})
        let id1=getBuffer(telemetry1)[0]?.sessionId
        let telemetry2=new Telemetry({endpoint: "https://example.com/track", enabled: true, storage, fetch: mockFetch})
        let id2=getBuffer(telemetry2)[0]?.sessionId
        expect(id1).toBe(id2)
    })
    test("respectDoNotTrack returns false by default", ()=>{
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, fetch: mockFetch})
        expect(telemetry.respectDoNotTrack()).toBe(false)
    })
    test("respectDoNotTrack returns true when DNT set", ()=>{
        vi.stubGlobal("navigator", {doNotTrack: "1"} as Navigator)
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, fetch: mockFetch})
        expect(telemetry.respectDoNotTrack()).toBe(true)
    })
    test("respectDoNotTrack returns true when GPC set", ()=>{
        vi.stubGlobal("navigator", {globalPrivacyControl: true} as unknown as Navigator)
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, fetch: mockFetch})
        expect(telemetry.respectDoNotTrack()).toBe(true)
    })
    test("track scrubs PII properties", ()=>{
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, fetch: mockFetch})
        telemetry.track("test.event", {email: "a@b.com", userId: "123"})
        let event=getBuffer(telemetry)[0]
        expect(event.properties).toEqual({userId: "123"})
    })
    test("track omits empty properties", ()=>{
        let telemetry=new Telemetry({endpoint: "https://example.com/track", enabled: true, fetch: mockFetch})
        telemetry.track("test.event", {email: "a@b.com"})
        let event=getBuffer(telemetry)[0]
        expect(event.properties).toBeUndefined()
    })
})
describe("scrubProperties", ()=>{
    test("scrub removes email name phone", ()=>{
        let props={email: "a@b.com", name: "alice", phone: "555", userId: "123"}
        let result=scrubProperties(props)
        expect(result.email).toBeUndefined()
        expect(result.name).toBeUndefined()
        expect(result.phone).toBeUndefined()
        expect(result.userId).toBe("123")
    })
    test("scrub removes password", ()=>{
        let props={password: "secret", hash: "abc"}
        let result=scrubProperties(props)
        expect(result.password).toBeUndefined()
        expect(result.hash).toBe("abc")
    })
    test("scrub removes token variants", ()=>{
        let props={authToken: "tok", refresh_token: "ref", userId: "1"}
        let result=scrubProperties(props)
        expect(result.authToken).toBeUndefined()
        expect(result.refresh_token).toBeUndefined()
        expect(result.userId).toBe("1")
    })
    test("scrub removes key variants", ()=>{
        let props={apiKey: "key", secretKey: "sec", monkey: "banana"}
        let result=scrubProperties(props)
        expect(result.apiKey).toBeUndefined()
        expect(result.secretKey).toBeUndefined()
        expect(result.monkey).toBe("banana")
    })
    test("scrub removes ssn variants", ()=>{
        let props={ssn: "123", ssnLastFour: "4567", id: "x"}
        let result=scrubProperties(props)
        expect(result.ssn).toBeUndefined()
        expect(result.ssnLastFour).toBeUndefined()
        expect(result.id).toBe("x")
    })
    test("scrub preserves safe properties", ()=>{
        let props={foo: "bar", count: 42, nested: {a: 1}}
        let result=scrubProperties(props)
        expect(result).toEqual(props)
    })
    test("scrub returns empty object when all PII", ()=>{
        let result=scrubProperties({email: "a@b.com"})
        expect(result).toEqual({})
    })
})
describe("generateSessionId", ()=>{
    test("returns string of expected length", ()=>{
        let id=generateSessionId()
        expect(typeof id).toBe("string")
        expect(id.length).toBe(32)
    })
    test("returns different ids", ()=>{
        let id1=generateSessionId()
        let id2=generateSessionId()
        expect(id1).not.toBe(id2)
    })
})
