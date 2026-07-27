// @vitest-environment happy-dom
import{describe,it,expect,beforeEach,afterEach}from "vitest"
import{Toast}from "../src/renderer/toast.js"
describe("toast notifications",()=>{
    let toast:Toast
    beforeEach(()=>{
        document.body.innerHTML=""
        toast=new Toast()
    })
    afterEach(()=>{
        document.querySelectorAll("#toast-container").forEach(el=>el.remove())
    })
    it("creates a toast container with ARIA attributes",()=>{
        toast.show("hello")
        let container=document.getElementById("toast-container")
        expect(container).not.toBeNull()
        expect(container!.getAttribute("role")).toBe("status")
        expect(container!.getAttribute("aria-live")).toBe("polite")
    })
    it("disables pointer events on close buttons of shifted toasts",()=>{
        let id1=toast.show("first")
        let id2=toast.show("second")
        let container=document.getElementById("toast-container")!
        let buttons=container.querySelectorAll(".toast-close")
        expect(buttons.length).toBe(2)
        let firstClose=buttons[0] as HTMLButtonElement
        let secondClose=buttons[1] as HTMLButtonElement
        expect(firstClose.style.pointerEvents).toBe("none")
        expect(secondClose.style.pointerEvents).toBe("auto")
        toast.dismiss(id2)
        expect(firstClose.style.pointerEvents).toBe("auto")
    })
    it("returns a toast id and allows dismissal",()=>{
        let id=toast.show("dismiss me")
        let container=document.getElementById("toast-container")!
        expect(container.querySelectorAll(".toast").length).toBe(1)
        expect(toast.dismiss(id)).toBe(true)
        expect(toast.dismiss(id)).toBe(false)
    })
})
