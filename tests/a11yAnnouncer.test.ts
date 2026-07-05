// @vitest-environment happy-dom
import{describe, test, expect, vi, beforeEach, afterEach}from "vitest"
import{A11yAnnouncer, createAriaLiveRegion, formatAnnouncement}from "../src/core/a11yAnnouncer.js"
describe("createAriaLiveRegion", ()=>{
    test("creates a hidden div with the given id", ()=>{
        let region=createAriaLiveRegion(document, "live-test", "polite")
        expect(region.tagName).toBe("DIV")
        expect(region.id).toBe("live-test")
    })
    test("sets aria-live to the provided priority", ()=>{
        let region=createAriaLiveRegion(document, "live-polite", "polite")
        expect(region.getAttribute("aria-live")).toBe("polite")
        let region2=createAriaLiveRegion(document, "live-assertive", "assertive")
        expect(region2.getAttribute("aria-live")).toBe("assertive")
    })
    test("sets aria-atomic to true", ()=>{
        let region=createAriaLiveRegion(document, "live-atomic", "polite")
        expect(region.getAttribute("aria-atomic")).toBe("true")
    })
    test("sets role to status for polite priority", ()=>{
        let region=createAriaLiveRegion(document, "live-status", "polite")
        expect(region.getAttribute("role")).toBe("status")
    })
    test("sets role to alert for assertive priority", ()=>{
        let region=createAriaLiveRegion(document, "live-alert", "assertive")
        expect(region.getAttribute("role")).toBe("alert")
    })
    test("positions the region off-screen", ()=>{
        let region=createAriaLiveRegion(document, "live-offscreen", "polite")
        expect(region.style.position).toBe("absolute")
        expect(region.style.left).toBe("-10000px")
    })
})
describe("formatAnnouncement", ()=>{
    test("prefixes polite messages with Status", ()=>{
        expect(formatAnnouncement("saved", "polite")).toBe("Status: saved.")
    })
    test("prefixes assertive messages with Alert", ()=>{
        expect(formatAnnouncement("error", "assertive")).toBe("Alert: error.")
    })
    test("trims whitespace from the message", ()=>{
        expect(formatAnnouncement("  hello  ", "polite")).toBe("Status: hello.")
    })
    test("does not add an extra period when message already ends with punctuation", ()=>{
        expect(formatAnnouncement("done!", "polite")).toBe("Status: done!")
        expect(formatAnnouncement("saved.", "polite")).toBe("Status: saved.")
    })
    test("returns only the prefix when message is empty", ()=>{
        expect(formatAnnouncement("", "polite")).toBe("Status: ")
    })
})
describe("A11yAnnouncer", ()=>{
    let announcer: A11yAnnouncer
    beforeEach(()=>{
        document.body.innerHTML=""
        announcer=new A11yAnnouncer()
        vi.useFakeTimers()
    })
    afterEach(()=>{
        vi.useRealTimers()
    })
    test("ensureRegions creates polite and assertive divs", ()=>{
        announcer.ensureRegions()
        let polite=document.getElementById("a11y-announcer-polite")
        let assertive=document.getElementById("a11y-announcer-assertive")
        expect(polite).not.toBeNull()
        expect(assertive).not.toBeNull()
        expect(polite!.getAttribute("aria-live")).toBe("polite")
        expect(assertive!.getAttribute("aria-live")).toBe("assertive")
    })
    test("ensureRegions reuses existing regions", ()=>{
        let polite=createAriaLiveRegion(document, "a11y-announcer-polite", "polite")
        let assertive=createAriaLiveRegion(document, "a11y-announcer-assertive", "assertive")
        document.body.appendChild(polite)
        document.body.appendChild(assertive)
        announcer.ensureRegions()
        expect(document.body.querySelectorAll("#a11y-announcer-polite").length).toBe(1)
        expect(document.body.querySelectorAll("#a11y-announcer-assertive").length).toBe(1)
    })
    test("announce sets textContent in the polite region by default", ()=>{
        announcer.announce("saved")
        let region=document.getElementById("a11y-announcer-polite")!
        expect(region.textContent).toBe("Status: saved.")
    })
    test("announce with assertive priority uses the assertive region", ()=>{
        announcer.announce("error", "assertive")
        let region=document.getElementById("a11y-announcer-assertive")!
        expect(region.textContent).toBe("Alert: error.")
    })
    test("announceProgress formats a progress message", ()=>{
        announcer.announceProgress(3, 10)
        let region=document.getElementById("a11y-announcer-polite")!
        expect(region.textContent).toBe("Status: Progress: 3 of 10 (30%).")
    })
    test("announceProgress appends the optional message", ()=>{
        announcer.announceProgress(5, 10, "almost done")
        let region=document.getElementById("a11y-announcer-polite")!
        expect(region.textContent).toBe("Status: Progress: 5 of 10 (50%). almost done.")
    })
    test("announceProgress uses zero percent when total is zero", ()=>{
        announcer.announceProgress(1, 0)
        let region=document.getElementById("a11y-announcer-polite")!
        expect(region.textContent).toContain("(0%)")
    })
    test("announceError uses assertive priority", ()=>{
        announcer.announceError("form invalid")
        let region=document.getElementById("a11y-announcer-assertive")!
        expect(region.textContent).toBe("Alert: form invalid.")
    })
    test("announceSuccess uses polite priority", ()=>{
        announcer.announceSuccess("export complete")
        let region=document.getElementById("a11y-announcer-polite")!
        expect(region.textContent).toBe("Status: export complete.")
    })
    test("clear removes text from both regions", ()=>{
        announcer.announce("polite message")
        announcer.announce("assertive message", "assertive")
        announcer.clear()
        expect(document.getElementById("a11y-announcer-polite")!.textContent).toBe("")
        expect(document.getElementById("a11y-announcer-assertive")!.textContent).toBe("")
    })
    test("clear with polite removes only the polite region", ()=>{
        announcer.announce("polite message")
        announcer.announce("assertive message", "assertive")
        announcer.clear("polite")
        expect(document.getElementById("a11y-announcer-polite")!.textContent).toBe("")
        expect(document.getElementById("a11y-announcer-assertive")!.textContent).toBe("Alert: assertive message.")
    })
    test("clear with assertive removes only the assertive region", ()=>{
        announcer.announce("polite message")
        announcer.announce("assertive message", "assertive")
        announcer.clear("assertive")
        expect(document.getElementById("a11y-announcer-polite")!.textContent).toBe("Status: polite message.")
        expect(document.getElementById("a11y-announcer-assertive")!.textContent).toBe("")
    })
    test("duplicate announcements still update the region text", ()=>{
        announcer.announce("same")
        let region=document.getElementById("a11y-announcer-polite")!
        expect(region.textContent).toBe("Status: same.")
        announcer.announce("same")
        expect(region.textContent).toBe("Status: same.")
    })
    test("announce clears the region after the default delay", ()=>{
        announcer.announce("temporary")
        let region=document.getElementById("a11y-announcer-polite")!
        expect(region.textContent).toBe("Status: temporary.")
        vi.advanceTimersByTime(5000)
        expect(region.textContent).toBe("")
    })
    test("clear cancels the auto-clear timeout", ()=>{
        announcer.announce("temporary")
        let region=document.getElementById("a11y-announcer-polite")!
        announcer.clear("polite")
        vi.advanceTimersByTime(5000)
        expect(region.textContent).toBe("")
    })
    test("constructor accepts custom ids and document", ()=>{
        let customDoc=document.implementation.createHTMLDocument()
        let custom=new A11yAnnouncer({document: customDoc, politeId: "custom-polite", assertiveId: "custom-assertive"})
        custom.ensureRegions()
        expect(customDoc.getElementById("custom-polite")).not.toBeNull()
        expect(customDoc.getElementById("custom-assertive")).not.toBeNull()
    })
})
