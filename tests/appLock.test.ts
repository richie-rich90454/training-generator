// @vitest-environment node
import{describe, test, expect, vi, beforeEach, afterEach}from"vitest"
import{AppLock, generateTotpSecret, buildOtpAuthUri, generateTotpToken}from"../src/core/appLock.js"
function createStorage(){
    let data: Record<string, string>={}
    return{
        getItem: (key: string)=>data[key]??null,
        setItem: (key: string, value: string)=>{data[key]=value},
        removeItem: (key: string)=>{delete data[key]}
    }
}
describe("generateTotpSecret", ()=>{
    test("returns base32 string", ()=>{
        let secret=generateTotpSecret()
        expect(secret.length).toBe(32)
        expect(/^[A-Z2-7]+$/.test(secret)).toBe(true)
    })
    test("returns different values across calls", ()=>{
        let a=generateTotpSecret()
        let b=generateTotpSecret()
        expect(a).not.toBe(b)
    })
})
describe("buildOtpAuthUri", ()=>{
    test("returns otpauth uri", ()=>{
        let secret=generateTotpSecret()
        let uri=buildOtpAuthUri(secret, "user@example.com")
        expect(uri.startsWith("otpauth://totp/")).toBe(true)
        expect(uri.includes("secret=" + secret)).toBe(true)
    })
    test("encodes account", ()=>{
        let secret=generateTotpSecret()
        let uri=buildOtpAuthUri(secret, "User Name")
        expect(uri.includes("User%20Name")).toBe(true)
    })
})
describe("AppLock", ()=>{
    beforeEach(()=>{
        vi.useFakeTimers()
    })
    afterEach(()=>{
        vi.useRealTimers()
    })
    test("setup returns uri", ()=>{
        let storage=createStorage()
        let lock=new AppLock({storage})
        let secret=generateTotpSecret()
        let result=lock.setup(secret)
        expect(result.uri.startsWith("otpauth://totp/")).toBe(true)
    })
    test("isEnabled is true after setup", ()=>{
        let lock=new AppLock()
        lock.setup(generateTotpSecret())
        expect(lock.isEnabled()).toBe(true)
    })
    test("verify accepts valid token", ()=>{
        let secret=generateTotpSecret()
        let lock=new AppLock()
        lock.setup(secret)
        let now=1620000000000
        vi.setSystemTime(now)
        let token=generateTotpToken(secret, now)
        expect(lock.verify(token)).toBe(true)
    })
    test("verify rejects invalid token", ()=>{
        let lock=new AppLock()
        lock.setup(generateTotpSecret())
        expect(lock.verify("000000")).toBe(false)
    })
    test("verify rejects when not enabled", ()=>{
        let lock=new AppLock()
        expect(lock.verify("123456")).toBe(false)
    })
    test("lock sets locked state", ()=>{
        let lock=new AppLock()
        lock.setup(generateTotpSecret())
        lock.lock()
        expect(lock.isLocked()).toBe(true)
    })
    test("unlock with valid token clears locked state", ()=>{
        let secret=generateTotpSecret()
        let lock=new AppLock()
        lock.setup(secret)
        let now=1620000000000
        vi.setSystemTime(now)
        let token=generateTotpToken(secret, now)
        lock.lock()
        expect(lock.unlock(token)).toBe(true)
        expect(lock.isLocked()).toBe(false)
    })
    test("unlock with invalid token keeps locked", ()=>{
        let lock=new AppLock()
        lock.setup(generateTotpSecret())
        lock.lock()
        expect(lock.unlock("000000")).toBe(false)
        expect(lock.isLocked()).toBe(true)
    })
    test("disable requires valid token", ()=>{
        let secret=generateTotpSecret()
        let lock=new AppLock()
        lock.setup(secret)
        let now=1620000000000
        vi.setSystemTime(now)
        let token=generateTotpToken(secret, now)
        expect(lock.disable("000000")).toBe(false)
        expect(lock.disable(token)).toBe(true)
        expect(lock.isEnabled()).toBe(false)
    })
    test("disable with valid token removes secret and locked state", ()=>{
        let secret=generateTotpSecret()
        let lock=new AppLock()
        lock.setup(secret)
        lock.lock()
        let now=1620000000000
        vi.setSystemTime(now)
        let token=generateTotpToken(secret, now)
        lock.disable(token)
        expect(lock.isEnabled()).toBe(false)
        expect(lock.isLocked()).toBe(false)
    })
    test("fallback totp works without otpauth", ()=>{
        let secret=generateTotpSecret()
        let lock=new AppLock()
        lock.setup(secret)
        let now=1620000000000
        vi.setSystemTime(now)
        let token=generateTotpToken(secret, now)
        expect(token.length).toBe(6)
        expect(/^[0-9]{6}$/.test(token)).toBe(true)
        expect(lock.verify(token)).toBe(true)
    })
})
