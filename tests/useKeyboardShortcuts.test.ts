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

describe("useKeyboardShortcuts audit (3.22)", () => {
    test("two shortcuts with same key+modifiers both fire (conflict handling)", () => {
        let handlerA = vi.fn()
        let handlerB = vi.fn()
        register([
            { id: "a", key: "s", modifiers: { ctrl: true }, handler: handlerA },
            { id: "b", key: "s", modifiers: { ctrl: true }, handler: handlerB }
        ])
        dispatchKeydown({ key: "s", ctrlKey: true })
        expect(handlerA).toHaveBeenCalledTimes(1)
        expect(handlerB).toHaveBeenCalledTimes(1)
    })
    test("shortcut with ctrl+shift+s fires only when both modifiers pressed", () => {
        let handler = vi.fn()
        register([{ id: "save-as", key: "s", modifiers: { ctrl: true, shift: true }, handler: handler }])
        dispatchKeydown({ key: "s", ctrlKey: true })
        expect(handler).not.toHaveBeenCalled()
        dispatchKeydown({ key: "s", ctrlKey: true, shiftKey: true })
        expect(handler).toHaveBeenCalledTimes(1)
    })
    test("shortcut with alt modifier fires only when alt pressed", () => {
        let handler = vi.fn()
        register([{ id: "alt-action", key: "a", modifiers: { alt: true }, handler: handler }])
        dispatchKeydown({ key: "a" })
        expect(handler).not.toHaveBeenCalled()
        dispatchKeydown({ key: "a", altKey: true })
        expect(handler).toHaveBeenCalledTimes(1)
    })
    test("shortcut with meta (cmd) modifier fires only when meta pressed", () => {
        let handler = vi.fn()
        register([{ id: "cmd-action", key: "k", modifiers: { meta: true }, handler: handler }])
        dispatchKeydown({ key: "k" })
        expect(handler).not.toHaveBeenCalled()
        dispatchKeydown({ key: "k", metaKey: true })
        expect(handler).toHaveBeenCalledTimes(1)
    })
    test("when scope option is undefined, shortcuts with scope still fire", () => {
        // The scope check is: scope !== undefined && shortcut.scope !== undefined && shortcut.scope !== scope
        // If scope option is undefined, the first condition fails, so scope filtering is skipped
        let scopedHandler = vi.fn()
        register([{ id: "scoped", key: "s", scope: "editor", handler: scopedHandler }])
        dispatchKeydown({ key: "s" })
        expect(scopedHandler).toHaveBeenCalledTimes(1)
    })
    test("parseShortcut handles 'option' as alias for 'alt'", () => {
        let result = parseShortcut("Option+S")
        expect(result.modifiers.alt).toBe(true)
        expect(result.key).toBe("s")
    })
    test("parseShortcut handles 'win' as alias for 'meta'", () => {
        let result = parseShortcut("Win+S")
        expect(result.modifiers.meta).toBe(true)
        expect(result.key).toBe("s")
    })
    test("parseShortcut handles 'control' as alias for 'ctrl'", () => {
        let result = parseShortcut("Control+S")
        expect(result.modifiers.ctrl).toBe(true)
        expect(result.key).toBe("s")
    })
    test("parseShortcut handles 'command' as alias for 'meta'", () => {
        let result = parseShortcut("Command+S")
        expect(result.modifiers.meta).toBe(true)
        expect(result.key).toBe("s")
    })
    test("parseShortcut handles whitespace around parts", () => {
        let result = parseShortcut("  Ctrl  +  S  ")
        expect(result.modifiers.ctrl).toBe(true)
        expect(result.key).toBe("s")
    })
    test("parseShortcut handles empty string gracefully", () => {
        let result = parseShortcut("")
        expect(result.key).toBe("")
        expect(result.modifiers).toEqual({})
    })
    test("formatShortcut with no modifiers returns capitalized key", () => {
        expect(formatShortcut({ key: "s", modifiers: {} })).toBe("S")
    })
    test("formatShortcut with single char key uppercases it", () => {
        expect(formatShortcut({ key: "a", modifiers: { ctrl: true } })).toBe("Ctrl+A")
    })
    test("formatShortcut with multi-char key capitalizes first letter only", () => {
        expect(formatShortcut({ key: "escape", modifiers: {} })).toBe("Escape")
        expect(formatShortcut({ key: "arrowup", modifiers: {} })).toBe("Arrowup")
    })
    test("formatShortcut preserves modifier order: meta, ctrl, alt, shift", () => {
        let result = formatShortcut({ key: "p", modifiers: { shift: true, alt: true, ctrl: true, meta: true } })
        expect(result).toBe("Cmd+Ctrl+Alt+Shift+P")
    })
    test("handler returning true does not preventDefault", () => {
        let handler = vi.fn(() => true)
        register([{ id: "save", key: "s", handler: handler }])
        let event = dispatchKeydown({ key: "s", cancelable: true })
        expect(event.defaultPrevented).toBe(false)
    })
    test("handler returning void does not preventDefault (without option)", () => {
        let handler = vi.fn((): void => {})
        register([{ id: "save", key: "s", handler: handler }])
        let event = dispatchKeydown({ key: "s", cancelable: true })
        expect(event.defaultPrevented).toBe(false)
    })
    test("multiple shortcuts with different modifiers all fire independently", () => {
        let plain = vi.fn()
        let ctrl = vi.fn()
        let shift = vi.fn()
        let ctrlShift = vi.fn()
        register([
            { id: "plain", key: "s", handler: plain },
            { id: "ctrl", key: "s", modifiers: { ctrl: true }, handler: ctrl },
            { id: "shift", key: "s", modifiers: { shift: true }, handler: shift },
            { id: "ctrl-shift", key: "s", modifiers: { ctrl: true, shift: true }, handler: ctrlShift }
        ])
        dispatchKeydown({ key: "s" })
        dispatchKeydown({ key: "s", ctrlKey: true })
        dispatchKeydown({ key: "s", shiftKey: true })
        dispatchKeydown({ key: "s", ctrlKey: true, shiftKey: true })
        expect(plain).toHaveBeenCalledTimes(1)
        expect(ctrl).toHaveBeenCalledTimes(1)
        expect(shift).toHaveBeenCalledTimes(1)
        expect(ctrlShift).toHaveBeenCalledTimes(1)
    })
    test("preventDefault option applies to all matching shortcuts", () => {
        let handlerA = vi.fn()
        let handlerB = vi.fn()
        register([
            { id: "a", key: "s", handler: handlerA },
            { id: "b", key: "s", handler: handlerB }
        ], { preventDefault: true })
        let event = dispatchKeydown({ key: "s", cancelable: true })
        expect(event.defaultPrevented).toBe(true)
    })
})
