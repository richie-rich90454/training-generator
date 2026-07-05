// @vitest-environment happy-dom
import{describe, test, expect, vi, beforeEach, afterEach}from "vitest"
import{AccessibilityPreferences, buildReducedMotionStyle, HIGH_CONTRAST_CLASS, MediaQueryListLike}from "../src/core/accessibilityPreferences.js"
function createMockMediaQueryList(matches: boolean): MediaQueryListLike & {listeners: (()=>void)[], dispatch: ()=>void}{
    let listeners: (()=>void)[]=[]
    let addEventListener=vi.fn((_type: string, listener: ()=>void)=>{
        listeners.push(listener)
    })
    return{
        matches,
        addEventListener,
        listeners,
        dispatch: ()=>{
            listeners.forEach((listener)=>listener())
        }
    }
}
function createMediaQueryList(matches: boolean): MediaQueryList{
    return{
        matches,
        media: "",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
    } as unknown as MediaQueryList
}
describe("HIGH_CONTRAST_CLASS", ()=>{
    test("is a non-empty string", ()=>{
        expect(typeof HIGH_CONTRAST_CLASS).toBe("string")
        expect(HIGH_CONTRAST_CLASS.length).toBeGreaterThan(0)
    })
})
describe("buildReducedMotionStyle", ()=>{
    test("returns a CSS string", ()=>{
        let style=buildReducedMotionStyle()
        expect(typeof style).toBe("string")
        expect(style.length).toBeGreaterThan(0)
    })
    test("disables animations and transitions", ()=>{
        let style=buildReducedMotionStyle()
        expect(style).toContain("animation-duration")
        expect(style).toContain("transition-duration")
    })
})
describe("AccessibilityPreferences", ()=>{
    beforeEach(()=>{
        document.documentElement.className=""
        document.head.innerHTML=""
        document.body.innerHTML=""
        vi.stubGlobal("matchMedia", vi.fn(()=>createMediaQueryList(false)))
    })
    afterEach(()=>{
        vi.unstubAllGlobals()
    })
    test("prefersReducedMotion true when media matches", ()=>{
        let mql=createMockMediaQueryList(true)
        let prefs=new AccessibilityPreferences({mediaQueryList: mql})
        expect(prefs.prefersReducedMotion()).toBe(true)
    })
    test("prefersReducedMotion false when media does not match", ()=>{
        let mql=createMockMediaQueryList(false)
        let prefs=new AccessibilityPreferences({mediaQueryList: mql})
        expect(prefs.prefersReducedMotion()).toBe(false)
    })
    test("prefersHighContrast true when forced-colors active", ()=>{
        vi.stubGlobal("matchMedia", vi.fn((query: string)=>createMediaQueryList(query==="(forced-colors: active)")))
        let prefs=new AccessibilityPreferences()
        expect(prefs.prefersHighContrast()).toBe(true)
    })
    test("prefersHighContrast false when forced-colors inactive", ()=>{
        vi.stubGlobal("matchMedia", vi.fn(()=>createMediaQueryList(false)))
        let prefs=new AccessibilityPreferences()
        expect(prefs.prefersHighContrast()).toBe(false)
    })
    test("prefersColorScheme detects dark", ()=>{
        vi.stubGlobal("matchMedia", vi.fn((query: string)=>createMediaQueryList(query==="(prefers-color-scheme: dark)")))
        let prefs=new AccessibilityPreferences()
        expect(prefs.prefersColorScheme()).toBe("dark")
    })
    test("prefersColorScheme detects light", ()=>{
        vi.stubGlobal("matchMedia", vi.fn((query: string)=>createMediaQueryList(query==="(prefers-color-scheme: light)")))
        let prefs=new AccessibilityPreferences()
        expect(prefs.prefersColorScheme()).toBe("light")
    })
    test("prefersColorScheme returns no-preference when neither", ()=>{
        vi.stubGlobal("matchMedia", vi.fn(()=>createMediaQueryList(false)))
        let prefs=new AccessibilityPreferences()
        expect(prefs.prefersColorScheme()).toBe("no-preference")
    })
    test("setHighContrast adds class", ()=>{
        let prefs=new AccessibilityPreferences()
        prefs.setHighContrast(true)
        expect(document.documentElement.classList.contains(HIGH_CONTRAST_CLASS)).toBe(true)
    })
    test("setHighContrast false removes class", ()=>{
        let prefs=new AccessibilityPreferences()
        prefs.setHighContrast(true)
        prefs.setHighContrast(false)
        expect(document.documentElement.classList.contains(HIGH_CONTRAST_CLASS)).toBe(false)
    })
    test("isHighContrast returns true when class is present", ()=>{
        let prefs=new AccessibilityPreferences()
        prefs.setHighContrast(true)
        expect(prefs.isHighContrast()).toBe(true)
    })
    test("isHighContrast returns false when class is absent", ()=>{
        let prefs=new AccessibilityPreferences()
        expect(prefs.isHighContrast()).toBe(false)
    })
    test("disableAnimations injects style", ()=>{
        let prefs=new AccessibilityPreferences()
        prefs.disableAnimations()
        expect(document.getElementById("reduced-motion-style")).not.toBeNull()
    })
    test("enableAnimations removes style", ()=>{
        let prefs=new AccessibilityPreferences()
        prefs.disableAnimations()
        prefs.enableAnimations()
        expect(document.getElementById("reduced-motion-style")).toBeNull()
    })
    test("listen callback invoked on change", ()=>{
        let mql=createMockMediaQueryList(false)
        let prefs=new AccessibilityPreferences({mediaQueryList: mql})
        let callback=vi.fn()
        prefs.listen(callback)
        mql.dispatch()
        expect(callback).toHaveBeenCalledTimes(1)
    })
    test("listen callback receives current preferences", ()=>{
        let mql=createMockMediaQueryList(true)
        vi.stubGlobal("matchMedia", vi.fn((query: string)=>createMediaQueryList(query==="(forced-colors: active)")))
        let prefs=new AccessibilityPreferences({mediaQueryList: mql})
        let callback=vi.fn()
        prefs.listen(callback)
        mql.dispatch()
        expect(callback).toHaveBeenCalledWith({
            reducedMotion: true,
            highContrast: true,
            colorScheme: "no-preference"
        })
    })
})
