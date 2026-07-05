import { describe, test, expect, vi, afterEach } from "vitest"
import { useKeyboardShortcuts, parseShortcut, formatShortcut } from "../src/renderer/composables/useKeyboardShortcuts.js"
import type { Shortcut, ShortcutOptions } from "../src/renderer/composables/useKeyboardShortcuts.js"
let cleanup: (()=>void)|null=null
afterEach(()=>{
    if (cleanup!==null){
        cleanup()
        cleanup=null
    }
})
function dispatchKeydown(options: KeyboardEventInit): KeyboardEvent{
    let event=new KeyboardEvent("keydown", options)
    window.dispatchEvent(event)
    return event
}
function register(shortcuts: Shortcut[], options?: ShortcutOptions): void{
    cleanup=useKeyboardShortcuts(shortcuts, options).unregister
}
describe("useKeyboardShortcuts",()=>{
    test("registers shortcut and fires handler",()=>{
        let handler=vi.fn()
        register([{ id: "save", key: "s", handler: handler }])
        dispatchKeydown({ key: "s" })
        expect(handler).toHaveBeenCalledTimes(1)
    })
    test("respects modifiers",()=>{
        let handler=vi.fn()
        register([{ id: "save", key: "s", modifiers: { ctrl: true }, handler: handler }])
        dispatchKeydown({ key: "s", ctrlKey: true })
        expect(handler).toHaveBeenCalledTimes(1)
    })
    test("ignores non-matching keys",()=>{
        let handler=vi.fn()
        register([{ id: "save", key: "s", handler: handler }])
        dispatchKeydown({ key: "a" })
        expect(handler).not.toHaveBeenCalled()
    })
    test("prevents default when handler returns false",()=>{
        let handler=vi.fn(()=>false)
        register([{ id: "save", key: "s", handler: handler }])
        let event=dispatchKeydown({ key: "s", cancelable: true })
        expect(event.defaultPrevented).toBe(true)
    })
    test("unregister removes listener",()=>{
        let handler=vi.fn()
        let api=useKeyboardShortcuts([{ id: "save", key: "s", handler: handler }])
        api.unregister()
        dispatchKeydown({ key: "s" })
        expect(handler).not.toHaveBeenCalled()
    })
    test("preventDefault option prevents default",()=>{
        let handler=vi.fn()
        register([{ id: "save", key: "s", handler: handler }], { preventDefault: true })
        let event=dispatchKeydown({ key: "s", cancelable: true })
        expect(event.defaultPrevented).toBe(true)
    })
    test("multiple shortcuts can coexist",()=>{
        let handlerA=vi.fn()
        let handlerB=vi.fn()
        register([
            { id: "a", key: "a", handler: handlerA },
            { id: "b", key: "b", handler: handlerB }
        ])
        dispatchKeydown({ key: "a" })
        dispatchKeydown({ key: "b" })
        expect(handlerA).toHaveBeenCalledTimes(1)
        expect(handlerB).toHaveBeenCalledTimes(1)
    })
    test("scope filtering limits shortcuts to matching scope",()=>{
        let globalHandler=vi.fn()
        let scopedHandler=vi.fn()
        register([
            { id: "global", key: "g", handler: globalHandler },
            { id: "scoped", key: "s", scope: "editor", handler: scopedHandler }
        ], { scope: "editor" })
        dispatchKeydown({ key: "g" })
        dispatchKeydown({ key: "s" })
        expect(globalHandler).toHaveBeenCalledTimes(1)
        expect(scopedHandler).toHaveBeenCalledTimes(1)
    })
    test("ignores scoped shortcuts when scope does not match",()=>{
        let scopedHandler=vi.fn()
        register([{ id: "scoped", key: "s", scope: "editor", handler: scopedHandler }], { scope: "palette" })
        dispatchKeydown({ key: "s" })
        expect(scopedHandler).not.toHaveBeenCalled()
    })
    test("ignores non-matching modifiers",()=>{
        let handler=vi.fn()
        register([{ id: "save", key: "s", modifiers: { ctrl: true }, handler: handler }])
        dispatchKeydown({ key: "s" })
        expect(handler).not.toHaveBeenCalled()
    })
    test("handler not called when extra modifier is pressed",()=>{
        let handler=vi.fn()
        register([{ id: "save", key: "s", modifiers: { ctrl: true }, handler: handler }])
        dispatchKeydown({ key: "s", ctrlKey: true, shiftKey: true })
        expect(handler).not.toHaveBeenCalled()
    })
    test("does not prevent default when handler returns undefined",()=>{
        let handler=vi.fn(()=>undefined)
        register([{ id: "save", key: "s", handler: handler }])
        let event=dispatchKeydown({ key: "s", cancelable: true })
        expect(event.defaultPrevented).toBe(false)
    })
    test("parseShortcut extracts key and ctrl",()=>{
        let result=parseShortcut("Ctrl+S")
        expect(result.key).toBe("s")
        expect(result.modifiers.ctrl).toBe(true)
        expect(result.modifiers.shift).toBeUndefined()
    })
    test("parseShortcut extracts cmd+shift",()=>{
        let result=parseShortcut("Cmd+Shift+P")
        expect(result.key).toBe("p")
        expect(result.modifiers.meta).toBe(true)
        expect(result.modifiers.shift).toBe(true)
    })
    test("parseShortcut handles escape",()=>{
        let result=parseShortcut("Escape")
        expect(result.key).toBe("escape")
        expect(result.modifiers).toEqual({})
    })
    test("parseShortcut is case-insensitive",()=>{
        let result=parseShortcut("CTRL+shift+s")
        expect(result.key).toBe("s")
        expect(result.modifiers.ctrl).toBe(true)
        expect(result.modifiers.shift).toBe(true)
    })
    test("formatShortcut formats combo",()=>{
        let result=formatShortcut({ key: "s", modifiers: { ctrl: true } })
        expect(result).toBe("Ctrl+S")
    })
    test("formatShortcut formats cmd+shift+key",()=>{
        let result=formatShortcut({ key: "p", modifiers: { meta: true, shift: true } })
        expect(result).toBe("Cmd+Shift+P")
    })
    test("formatShortcut formats escape",()=>{
        let result=formatShortcut({ key: "escape", modifiers: {} })
        expect(result).toBe("Escape")
    })
    test("parseShortcut and formatShortcut are consistent",()=>{
        let parsed=parseShortcut("Cmd+Shift+P")
        let formatted=formatShortcut(parsed)
        expect(formatted).toBe("Cmd+Shift+P")
    })
})
