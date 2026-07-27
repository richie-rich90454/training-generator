// @vitest-environment happy-dom
import{describe, test, expect, beforeEach, afterEach}from "vitest"
import{FocusManager, isFocusable, FOCUSABLE_SELECTOR}from "../src/core/focusManager.js"
describe("FOCUSABLE_SELECTOR", ()=>{
    test("is a non-empty string", ()=>{
        expect(typeof FOCUSABLE_SELECTOR).toBe("string")
        expect(FOCUSABLE_SELECTOR.length).toBeGreaterThan(0)
    })
})
describe("isFocusable", ()=>{
    let manager: FocusManager
    let container: HTMLElement
    beforeEach(()=>{
        document.body.innerHTML=""
        manager=new FocusManager()
        container=document.createElement("div")
        document.body.appendChild(container)
    })
    afterEach(()=>{
        manager.releaseFocus()
        document.body.innerHTML=""
    })
    test("returns true for a standard button", ()=>{
        let button=document.createElement("button")
        expect(isFocusable(button)).toBe(true)
    })
    test("returns true for an anchor with href", ()=>{
        let link=document.createElement("a")
        link.href="#"
        expect(isFocusable(link)).toBe(true)
    })
    test("returns false for tabindex -1", ()=>{
        let button=document.createElement("button")
        button.setAttribute("tabindex", "-1")
        expect(isFocusable(button)).toBe(false)
    })
    test("returns false for disabled input", ()=>{
        let input=document.createElement("input")
        input.setAttribute("disabled", "")
        expect(isFocusable(input)).toBe(false)
    })
    test("returns false for hidden input", ()=>{
        let input=document.createElement("input")
        input.type="hidden"
        expect(isFocusable(input)).toBe(false)
    })
    test("returns false for aria-hidden element", ()=>{
        let button=document.createElement("button")
        button.setAttribute("aria-hidden", "true")
        expect(isFocusable(button)).toBe(false)
    })
})
describe("FocusManager", ()=>{
    let manager: FocusManager
    let container: HTMLElement
    beforeEach(()=>{
        document.body.innerHTML=""
        manager=new FocusManager()
        container=document.createElement("div")
        document.body.appendChild(container)
    })
    afterEach(()=>{
        manager.releaseFocus()
        document.body.innerHTML=""
    })
    test("getFocusableElements finds buttons and inputs", ()=>{
        container.innerHTML='<button id="b1">One</button><input id="i1" /><button id="b2">Two</button>'
        let elements=manager.getFocusableElements(container)
        expect(elements.length).toBe(3)
        expect(elements[0].id).toBe("b1")
        expect(elements[1].id).toBe("i1")
        expect(elements[2].id).toBe("b2")
    })
    test("getFocusableElements excludes disabled elements", ()=>{
        container.innerHTML='<button>Enabled</button><button disabled>Disabled</button>'
        let elements=manager.getFocusableElements(container)
        expect(elements.length).toBe(1)
        expect(elements[0].textContent).toBe("Enabled")
    })
    test("getFocusableElements excludes tabindex -1 elements", ()=>{
        container.innerHTML='<button>Focusable</button><button tabindex="-1">Skipped</button>'
        let elements=manager.getFocusableElements(container)
        expect(elements.length).toBe(1)
        expect(elements[0].textContent).toBe("Focusable")
    })
    test("getFocusableElements excludes hidden inputs", ()=>{
        container.innerHTML='<input type="text" id="visible" /><input type="hidden" id="hidden" />'
        let elements=manager.getFocusableElements(container)
        expect(elements.length).toBe(1)
        expect(elements[0].id).toBe("visible")
    })
    test("getFocusableElements returns empty array when none", ()=>{
        container.innerHTML='<div>Not focusable</div>'
        let elements=manager.getFocusableElements(container)
        expect(elements.length).toBe(0)
    })
    test("focusFirst focuses first focusable element", ()=>{
        container.innerHTML='<button id="first">First</button><button id="second">Second</button>'
        manager.focusFirst(container)
        expect(document.activeElement).toBe(container.querySelector("#first"))
    })
    test("focusLast focuses last focusable element", ()=>{
        container.innerHTML='<button id="first">First</button><button id="second">Second</button>'
        manager.focusLast(container)
        expect(document.activeElement).toBe(container.querySelector("#second"))
    })
    test("focusFirst does nothing when no focusable elements", ()=>{
        container.innerHTML='<div>No focus</div>'
        let previous=document.activeElement
        manager.focusFirst(container)
        expect(document.activeElement).toBe(previous)
    })
    test("focusLast does nothing when no focusable elements", ()=>{
        container.innerHTML='<div>No focus</div>'
        let previous=document.activeElement
        manager.focusLast(container)
        expect(document.activeElement).toBe(previous)
    })
    test("trapFocus forwards Tab to first element", ()=>{
        container.innerHTML='<button id="first">First</button><button id="last">Last</button>'
        let last=container.querySelector("#last") as HTMLElement
        let first=container.querySelector("#first") as HTMLElement
        last.focus()
        manager.trapFocus(container)
        let event=new KeyboardEvent("keydown", {key: "Tab", shiftKey: false, bubbles: true, cancelable: true})
        last.dispatchEvent(event)
        expect(document.activeElement).toBe(first)
    })
    test("trapFocus backwards Tab to last element", ()=>{
        container.innerHTML='<button id="first">First</button><button id="last">Last</button>'
        let first=container.querySelector("#first") as HTMLElement
        let last=container.querySelector("#last") as HTMLElement
        first.focus()
        manager.trapFocus(container)
        let event=new KeyboardEvent("keydown", {key: "Tab", shiftKey: true, bubbles: true, cancelable: true})
        first.dispatchEvent(event)
        expect(document.activeElement).toBe(last)
    })
    test("trapFocus prevents default on forward cycle", ()=>{
        container.innerHTML='<button id="first">First</button><button id="last">Last</button>'
        let last=container.querySelector("#last") as HTMLElement
        last.focus()
        manager.trapFocus(container)
        let event=new KeyboardEvent("keydown", {key: "Tab", shiftKey: false, bubbles: true, cancelable: true})
        last.dispatchEvent(event)
        expect(event.defaultPrevented).toBe(true)
    })
    test("trapFocus prevents default on backward cycle", ()=>{
        container.innerHTML='<button id="first">First</button><button id="last">Last</button>'
        let first=container.querySelector("#first") as HTMLElement
        first.focus()
        manager.trapFocus(container)
        let event=new KeyboardEvent("keydown", {key: "Tab", shiftKey: true, bubbles: true, cancelable: true})
        first.dispatchEvent(event)
        expect(event.defaultPrevented).toBe(true)
    })
    test("trapFocus ignores non-Tab keys", ()=>{
        container.innerHTML='<button id="first">First</button><button id="last">Last</button>'
        let first=container.querySelector("#first") as HTMLElement
        first.focus()
        manager.trapFocus(container)
        let event=new KeyboardEvent("keydown", {key: "Enter", bubbles: true, cancelable: true})
        first.dispatchEvent(event)
        expect(document.activeElement).toBe(first)
        expect(event.defaultPrevented).toBe(false)
    })
    test("releaseFocus removes listeners", ()=>{
        container.innerHTML='<button id="first">First</button><button id="last">Last</button>'
        let last=container.querySelector("#last") as HTMLElement
        last.focus()
        manager.trapFocus(container)
        manager.releaseFocus()
        let event=new KeyboardEvent("keydown", {key: "Tab", shiftKey: false, bubbles: true, cancelable: true})
        last.dispatchEvent(event)
        expect(document.activeElement).toBe(last)
        expect(event.defaultPrevented).toBe(false)
    })
    test("handleArrowNavigation moves down", ()=>{
        container.innerHTML='<button id="a">A</button><button id="b">B</button><button id="c">C</button>'
        let first=container.querySelector("#a") as HTMLElement
        let second=container.querySelector("#b") as HTMLElement
        first.focus()
        let event=new KeyboardEvent("keydown", {key: "ArrowDown", bubbles: true, cancelable: true})
        manager.handleArrowNavigation(container, event)
        expect(document.activeElement).toBe(second)
        expect(event.defaultPrevented).toBe(true)
    })
    test("handleArrowNavigation moves up", ()=>{
        container.innerHTML='<button id="a">A</button><button id="b">B</button><button id="c">C</button>'
        let second=container.querySelector("#b") as HTMLElement
        let first=container.querySelector("#a") as HTMLElement
        second.focus()
        let event=new KeyboardEvent("keydown", {key: "ArrowUp", bubbles: true, cancelable: true})
        manager.handleArrowNavigation(container, event)
        expect(document.activeElement).toBe(first)
        expect(event.defaultPrevented).toBe(true)
    })
    test("handleArrowNavigation wraps from last to first", ()=>{
        container.innerHTML='<button id="a">A</button><button id="b">B</button><button id="c">C</button>'
        let last=container.querySelector("#c") as HTMLElement
        let first=container.querySelector("#a") as HTMLElement
        last.focus()
        let event=new KeyboardEvent("keydown", {key: "ArrowDown", bubbles: true, cancelable: true})
        manager.handleArrowNavigation(container, event)
        expect(document.activeElement).toBe(first)
    })
    test("handleArrowNavigation wraps from first to last", ()=>{
        container.innerHTML='<button id="a">A</button><button id="b">B</button><button id="c">C</button>'
        let first=container.querySelector("#a") as HTMLElement
        let last=container.querySelector("#c") as HTMLElement
        first.focus()
        let event=new KeyboardEvent("keydown", {key: "ArrowUp", bubbles: true, cancelable: true})
        manager.handleArrowNavigation(container, event)
        expect(document.activeElement).toBe(last)
    })
    test("handleArrowNavigation horizontal moves right", ()=>{
        container.innerHTML='<button id="a">A</button><button id="b">B</button><button id="c">C</button>'
        let first=container.querySelector("#a") as HTMLElement
        let second=container.querySelector("#b") as HTMLElement
        first.focus()
        let event=new KeyboardEvent("keydown", {key: "ArrowRight", bubbles: true, cancelable: true})
        manager.handleArrowNavigation(container, event, "horizontal")
        expect(document.activeElement).toBe(second)
        expect(event.defaultPrevented).toBe(true)
    })
    test("handleArrowNavigation horizontal ignores vertical keys", ()=>{
        container.innerHTML='<button id="a">A</button><button id="b">B</button>'
        let first=container.querySelector("#a") as HTMLElement
        first.focus()
        let event=new KeyboardEvent("keydown", {key: "ArrowDown", bubbles: true, cancelable: true})
        manager.handleArrowNavigation(container, event, "horizontal")
        expect(document.activeElement).toBe(first)
        expect(event.defaultPrevented).toBe(false)
    })
    test("handleArrowNavigation vertical ignores horizontal keys", ()=>{
        container.innerHTML='<button id="a">A</button><button id="b">B</button>'
        let first=container.querySelector("#a") as HTMLElement
        first.focus()
        let event=new KeyboardEvent("keydown", {key: "ArrowRight", bubbles: true, cancelable: true})
        manager.handleArrowNavigation(container, event)
        expect(document.activeElement).toBe(first)
        expect(event.defaultPrevented).toBe(false)
    })
    test("registerSkipLink creates anchor with default label", ()=>{
        let link=manager.registerSkipLink("main")
        expect(link.tagName).toBe("A")
        expect(link.textContent).toBe("Skip to main content")
        expect(link.className).toBe("skip-link")
    })
    test("registerSkipLink uses custom label", ()=>{
        let link=manager.registerSkipLink("content", "Jump to content")
        expect(link.textContent).toBe("Jump to content")
    })
    test("registerSkipLink href points to target id", ()=>{
        let link=manager.registerSkipLink("main")
        expect(link.getAttribute("href")).toBe("#main")
    })
    test("registerSkipLink prepends to body", ()=>{
        let main=document.createElement("main")
        main.id="main"
        document.body.appendChild(main)
        manager.registerSkipLink("main")
        expect(document.body.firstChild).toBeInstanceOf(HTMLAnchorElement)
    })
    test("registerSkipLink focuses target on click", ()=>{
        let main=document.createElement("main")
        main.id="main"
        document.body.appendChild(main)
        let link=manager.registerSkipLink("main")
        let clickEvent=new MouseEvent("click", {bubbles: true, cancelable: true})
        link.dispatchEvent(clickEvent)
        expect(document.activeElement).toBe(main)
        expect(main.getAttribute("tabindex")).toBe("-1")
    })
    test("constructor accepts custom document", ()=>{
        let customDoc=document.implementation.createHTMLDocument()
        let customManager=new FocusManager({document: customDoc})
        let div=customDoc.createElement("div")
        div.innerHTML='<button>One</button>'
        customDoc.body.appendChild(div)
        let elements=customManager.getFocusableElements(div)
        expect(elements.length).toBe(1)
    })
})
