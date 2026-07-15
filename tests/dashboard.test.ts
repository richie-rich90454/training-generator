// @vitest-environment happy-dom
import{describe,it,expect,beforeEach,afterEach,vi}from "vitest"
import{Dashboard,DashboardMetrics}from "../src/renderer/dashboard.js"

const START_TIME=1000000000000

describe("Dashboard constructor",()=>{
    let dashboard:Dashboard
    beforeEach(()=>{
        document.body.innerHTML=""
        dashboard=new Dashboard()
    })
    afterEach(()=>{
        dashboard.stop()
    })
    it("appends overlay element to document body",()=>{
        let overlay=document.getElementById("dashboard-overlay")
        expect(overlay).not.toBeNull()
        expect(document.body.contains(overlay)).toBe(true)
    })
    it("applies role and aria-modal attributes",()=>{
        let overlay=document.getElementById("dashboard-overlay")!
        expect(overlay.getAttribute("role")).toBe("dialog")
        expect(overlay.getAttribute("aria-modal")).toBe("true")
    })
    it("applies aria-label from i18n",()=>{
        let overlay=document.getElementById("dashboard-overlay")!
        expect(overlay.getAttribute("aria-label")).toBe("Processing dashboard")
    })
    it("starts hidden with visible=false",()=>{
        let overlay=document.getElementById("dashboard-overlay")!
        expect(overlay.style.display).toBe("none")
        expect(dashboard.visible).toBe(false)
    })
    it("renders close button with aria-label",()=>{
        let closeBtn=document.querySelector(".dashboard-close") as HTMLButtonElement
        expect(closeBtn).not.toBeNull()
        expect(closeBtn.getAttribute("aria-label")).toBe("Close dashboard")
    })
    it("renders initial metric cell values",()=>{
        expect(document.getElementById("dash-chunks")!.textContent).toBe("0 / 0")
        expect(document.getElementById("dash-cps")!.textContent).toBe("0")
        expect(document.getElementById("dash-tps")!.textContent).toBe("0")
        expect(document.getElementById("dash-cache")!.textContent).toBe("0%")
        expect(document.getElementById("dash-latency")!.textContent).toBe("0 ms")
        expect(document.getElementById("dash-provider")!.textContent).toBe("--")
        expect(document.getElementById("dash-eta")!.textContent).toBe("--")
        expect(document.getElementById("dash-elapsed")!.textContent).toBe("0s")
    })
})

describe("Dashboard show/hide",()=>{
    let dashboard:Dashboard
    beforeEach(()=>{
        document.body.innerHTML=""
        dashboard=new Dashboard()
    })
    afterEach(()=>{
        dashboard.stop()
    })
    it("show() sets visible=true and display=block",()=>{
        dashboard.show()
        expect(dashboard.visible).toBe(true)
        let overlay=document.getElementById("dashboard-overlay")!
        expect(overlay.style.display).toBe("block")
    })
    it("hide() sets visible=false and display=none",()=>{
        dashboard.show()
        dashboard.hide()
        expect(dashboard.visible).toBe(false)
        let overlay=document.getElementById("dashboard-overlay")!
        expect(overlay.style.display).toBe("none")
    })
    it("show() focuses the close button",()=>{
        dashboard.show()
        let closeBtn=document.querySelector(".dashboard-close") as HTMLButtonElement
        expect(document.activeElement).toBe(closeBtn)
    })
    it("hide() restores focus to the previously focused element",()=>{
        let button=document.createElement("button")
        document.body.appendChild(button)
        button.focus()
        expect(document.activeElement).toBe(button)
        dashboard.show()
        expect(document.activeElement).not.toBe(button)
        dashboard.hide()
        expect(document.activeElement).toBe(button)
    })
    it("close button click hides the dashboard",()=>{
        dashboard.show()
        let closeBtn=document.querySelector(".dashboard-close") as HTMLButtonElement
        closeBtn.click()
        expect(dashboard.visible).toBe(false)
    })
})

describe("Dashboard toggle",()=>{
    let dashboard:Dashboard
    beforeEach(()=>{
        document.body.innerHTML=""
        dashboard=new Dashboard()
    })
    afterEach(()=>{
        dashboard.stop()
    })
    it("toggle() shows when hidden",()=>{
        expect(dashboard.visible).toBe(false)
        dashboard.toggle()
        expect(dashboard.visible).toBe(true)
    })
    it("toggle() hides when shown",()=>{
        dashboard.show()
        dashboard.toggle()
        expect(dashboard.visible).toBe(false)
    })
})

describe("Dashboard update",()=>{
    let dashboard:Dashboard
    beforeEach(()=>{
        document.body.innerHTML=""
        dashboard=new Dashboard()
    })
    afterEach(()=>{
        dashboard.stop()
    })
    it("merges partial metrics into internal state and re-renders",()=>{
        dashboard.update({chunksDone:5, chunksTotal:20, chunksPerSecond:2})
        expect(document.getElementById("dash-chunks")!.textContent).toBe("5 / 20")
        expect(document.getElementById("dash-cps")!.textContent).toBe("2")
    })
    it("preserves fields not included in the partial update",()=>{
        dashboard.update({chunksDone:5})
        dashboard.update({chunksPerSecond:3})
        expect(document.getElementById("dash-chunks")!.textContent).toBe("5 / 0")
        expect(document.getElementById("dash-cps")!.textContent).toBe("3")
    })
    it("renders large numbers without modification",()=>{
        dashboard.update({chunksPerSecond:1000000, tokensPerSecond:999999})
        expect(document.getElementById("dash-cps")!.textContent).toBe("1000000")
        expect(document.getElementById("dash-tps")!.textContent).toBe("999999")
    })
    it("renders zero values",()=>{
        dashboard.update({chunksPerSecond:0, tokensPerSecond:0, cacheHitRate:0, providerLatency:0})
        expect(document.getElementById("dash-cps")!.textContent).toBe("0")
        expect(document.getElementById("dash-tps")!.textContent).toBe("0")
        expect(document.getElementById("dash-cache")!.textContent).toBe("0%")
        expect(document.getElementById("dash-latency")!.textContent).toBe("0 ms")
    })
    it("renders negative values without transformation",()=>{
        dashboard.update({chunksPerSecond:-5, cacheHitRate:-10, providerLatency:-50})
        expect(document.getElementById("dash-cps")!.textContent).toBe("-5")
        expect(document.getElementById("dash-cache")!.textContent).toBe("-10%")
        expect(document.getElementById("dash-latency")!.textContent).toBe("-50 ms")
    })
    it("renders cacheHitRate with percent suffix",()=>{
        dashboard.update({cacheHitRate:87})
        expect(document.getElementById("dash-cache")!.textContent).toBe("87%")
    })
    it("renders providerLatency with ms suffix",()=>{
        dashboard.update({providerLatency:240})
        expect(document.getElementById("dash-latency")!.textContent).toBe("240 ms")
    })
    it("renders activeProvider and eta strings verbatim",()=>{
        dashboard.update({activeProvider:"ollama", eta:"2m 30s"})
        expect(document.getElementById("dash-provider")!.textContent).toBe("ollama")
        expect(document.getElementById("dash-eta")!.textContent).toBe("2m 30s")
    })
    it("renders elapsed string verbatim",()=>{
        dashboard.update({elapsed:"5s"})
        expect(document.getElementById("dash-elapsed")!.textContent).toBe("5s")
    })
    it("empty update preserves existing state",()=>{
        dashboard.update({chunksDone:7, chunksTotal:14})
        dashboard.update({})
        expect(document.getElementById("dash-chunks")!.textContent).toBe("7 / 14")
    })
})

describe("Dashboard start/stop",()=>{
    let dashboard:Dashboard
    beforeEach(()=>{
        vi.useFakeTimers()
        vi.setSystemTime(START_TIME)
        document.body.innerHTML=""
        dashboard=new Dashboard()
    })
    afterEach(()=>{
        dashboard.stop()
        vi.useRealTimers()
    })
    it("start() resets metrics to defaults",()=>{
        dashboard.update({chunksDone:99, chunksTotal:99, chunksPerSecond:99, tokensPerSecond:99, totalTokens:99, cacheHitRate:99, providerLatency:99, activeProvider:"x", eta:"x", elapsed:"x"})
        dashboard.start(500)
        let metrics=(dashboard as any).metrics as DashboardMetrics
        expect(metrics.chunksDone).toBe(0)
        expect(metrics.chunksTotal).toBe(0)
        expect(metrics.chunksPerSecond).toBe(0)
        expect(metrics.tokensPerSecond).toBe(0)
        expect(metrics.totalTokens).toBe(0)
        expect(metrics.cacheHitRate).toBe(0)
        expect(metrics.providerLatency).toBe(0)
        expect(metrics.activeProvider).toBe("--")
        expect(metrics.eta).toBe("--")
        expect(metrics.elapsed).toBe("0s")
    })
    it("start() shows the dashboard",()=>{
        dashboard.start(500)
        expect(dashboard.visible).toBe(true)
    })
    it("start() uses default 500ms interval when no arg",()=>{
        dashboard.start()
        vi.advanceTimersByTime(499)
        let metrics=(dashboard as any).metrics as DashboardMetrics
        expect(metrics.elapsed).toBe("0s")
        vi.advanceTimersByTime(1)
        expect(metrics.elapsed).not.toBe("0s")
    })
    it("start() clears existing interval before starting new one",()=>{
        dashboard.start(1000)
        dashboard.start(2000)
        vi.advanceTimersByTime(1000)
        let metrics=(dashboard as any).metrics as DashboardMetrics
        expect(metrics.elapsed).toBe("0s")
        vi.advanceTimersByTime(1000)
        expect(metrics.elapsed).not.toBe("0s")
    })
    it("stop() hides the dashboard",()=>{
        dashboard.start(500)
        expect(dashboard.visible).toBe(true)
        dashboard.stop()
        expect(dashboard.visible).toBe(false)
    })
    it("stop() clears the update interval",()=>{
        dashboard.start(500)
        dashboard.stop()
        let metrics=(dashboard as any).metrics as DashboardMetrics
        let elapsedBefore=metrics.elapsed
        vi.advanceTimersByTime(2000)
        expect(metrics.elapsed).toBe(elapsedBefore)
    })
    it("stop() is safe when no interval is active",()=>{
        expect(()=>dashboard.stop()).not.toThrow()
    })
})

describe("Dashboard tick metrics computation",()=>{
    let dashboard:Dashboard
    beforeEach(()=>{
        vi.useFakeTimers()
        vi.setSystemTime(START_TIME)
        document.body.innerHTML=""
        dashboard=new Dashboard()
    })
    afterEach(()=>{
        dashboard.stop()
        vi.useRealTimers()
    })
    it("computes chunksPerSecond from chunksDone and elapsed seconds",()=>{
        dashboard.start(500)
        dashboard.update({chunksDone:10, chunksTotal:100})
        vi.advanceTimersByTime(2000)
        let metrics=(dashboard as any).metrics as DashboardMetrics
        expect(metrics.chunksPerSecond).toBe(5)
    })
    it("computes tokensPerSecond from totalTokens and elapsed seconds",()=>{
        dashboard.start(500)
        dashboard.update({chunksDone:1, chunksTotal:10, totalTokens:1000})
        vi.advanceTimersByTime(5000)
        let metrics=(dashboard as any).metrics as DashboardMetrics
        expect(metrics.tokensPerSecond).toBe(200)
    })
    it("tokensPerSecond is 0 when totalTokens is 0",()=>{
        dashboard.start(500)
        dashboard.update({chunksDone:1, chunksTotal:10, totalTokens:0})
        vi.advanceTimersByTime(2000)
        let metrics=(dashboard as any).metrics as DashboardMetrics
        expect(metrics.tokensPerSecond).toBe(0)
    })
    it("computes eta when chunksPerSecond and chunksTotal are positive",()=>{
        dashboard.start(500)
        dashboard.update({chunksDone:10, chunksTotal:100})
        vi.advanceTimersByTime(2000)
        let metrics=(dashboard as any).metrics as DashboardMetrics
        expect(metrics.eta).toBe("18s")
    })
    it("eta stays as '--' when chunksPerSecond is 0",()=>{
        dashboard.start(500)
        dashboard.update({chunksDone:0, chunksTotal:100})
        vi.advanceTimersByTime(2000)
        let metrics=(dashboard as any).metrics as DashboardMetrics
        expect(metrics.eta).toBe("--")
    })
    it("eta stays as '--' when chunksTotal is 0",()=>{
        dashboard.start(500)
        dashboard.update({chunksDone:10, chunksTotal:0})
        vi.advanceTimersByTime(2000)
        let metrics=(dashboard as any).metrics as DashboardMetrics
        expect(metrics.eta).toBe("--")
    })
    it("tick is a no-op when dashboard is not visible",()=>{
        dashboard.start(500)
        dashboard.update({chunksDone:10, chunksTotal:100})
        dashboard.hide()
        expect(dashboard.visible).toBe(false)
        vi.advanceTimersByTime(5000)
        let metrics=(dashboard as any).metrics as DashboardMetrics
        expect(metrics.chunksPerSecond).toBe(0)
        expect(metrics.elapsed).toBe("0s")
    })
    it("tick re-renders cells after computing metrics",()=>{
        dashboard.start(500)
        dashboard.update({chunksDone:10, chunksTotal:100})
        vi.advanceTimersByTime(2000)
        expect(document.getElementById("dash-cps")!.textContent).toBe("5")
        expect(document.getElementById("dash-elapsed")!.textContent).toBe("2s")
    })
})

describe("Dashboard formatDuration via tick",()=>{
    let dashboard:Dashboard
    beforeEach(()=>{
        vi.useFakeTimers()
        vi.setSystemTime(START_TIME)
        document.body.innerHTML=""
        dashboard=new Dashboard()
    })
    afterEach(()=>{
        dashboard.stop()
        vi.useRealTimers()
    })
    it("formats durations under 1 second as ms",()=>{
        dashboard.start(500)
        vi.advanceTimersByTime(500)
        expect(document.getElementById("dash-elapsed")!.textContent).toBe("500ms")
    })
    it("formats durations between 1s and 60s as seconds",()=>{
        dashboard.start(500)
        vi.advanceTimersByTime(30000)
        expect(document.getElementById("dash-elapsed")!.textContent).toBe("30s")
    })
    it("formats durations >= 60s as minutes and seconds",()=>{
        dashboard.start(500)
        vi.advanceTimersByTime(65000)
        expect(document.getElementById("dash-elapsed")!.textContent).toBe("1m 5s")
    })
    it("formats duration exactly at 60s as 1m 0s",()=>{
        dashboard.start(500)
        vi.advanceTimersByTime(60000)
        expect(document.getElementById("dash-elapsed")!.textContent).toBe("1m 0s")
    })
    it("rolls over seconds >= 60 into minutes",()=>{
        dashboard.start(500)
        vi.advanceTimersByTime(119500)
        expect(document.getElementById("dash-elapsed")!.textContent).toBe("2m 0s")
    })
})

describe("Dashboard focus trap",()=>{
    let dashboard:Dashboard
    let closeBtn:HTMLButtonElement
    beforeEach(()=>{
        document.body.innerHTML=""
        dashboard=new Dashboard()
        dashboard.show()
        closeBtn=document.querySelector(".dashboard-close") as HTMLButtonElement
    })
    afterEach(()=>{
        dashboard.stop()
    })
    it("Escape key hides the dashboard and prevents default",()=>{
        expect(dashboard.visible).toBe(true)
        let event=new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true})
        document.dispatchEvent(event)
        expect(dashboard.visible).toBe(false)
        expect(event.defaultPrevented).toBe(true)
    })
    it("Tab key prevents default when focused on the close button",()=>{
        closeBtn.focus()
        let event=new KeyboardEvent("keydown",{key:"Tab",shiftKey:false,bubbles:true,cancelable:true})
        document.dispatchEvent(event)
        expect(event.defaultPrevented).toBe(true)
    })
    it("Shift+Tab also prevents default when only one focusable element",()=>{
        closeBtn.focus()
        let event=new KeyboardEvent("keydown",{key:"Tab",shiftKey:true,bubbles:true,cancelable:true})
        document.dispatchEvent(event)
        expect(event.defaultPrevented).toBe(true)
    })
    it("non-Tab keys do not prevent default",()=>{
        closeBtn.focus()
        let event=new KeyboardEvent("keydown",{key:"Enter",bubbles:true,cancelable:true})
        document.dispatchEvent(event)
        expect(event.defaultPrevented).toBe(false)
    })
    it("hide() removes the focus trap listeners",()=>{
        dashboard.hide()
        closeBtn.focus()
        let event=new KeyboardEvent("keydown",{key:"Tab",shiftKey:false,bubbles:true,cancelable:true})
        document.dispatchEvent(event)
        expect(event.defaultPrevented).toBe(false)
    })
})
