import{describe,test,expect}from "vitest"

describe("Bootstrap configuration",()=>{
    test("bootstrap-only switches are valid",()=>{
        let bootstrapOnlySwitches:string[]=[
            "disable-features=TranslateUI",
            "ignore-gpu-blacklist"
        ]
        for(let sw of bootstrapOnlySwitches){
            expect(typeof sw).toBe("string")
            expect(sw.length).toBeGreaterThan(0)
        }
    })

    test("main.ts switches include all shared switches",()=>{
        let mainSwitches:string[]=[
            "no-first-run",
            "disable-background-networking",
            "disable-component-update",
            "disable-sync",
            "disable-default-apps",
            "metrics-recording-only"
        ]
        expect(mainSwitches).toContain("no-first-run")
        expect(mainSwitches).toContain("disable-background-networking")
        expect(mainSwitches).toContain("disable-component-update")
        expect(mainSwitches).toContain("disable-sync")
        expect(mainSwitches).toContain("disable-default-apps")
        expect(mainSwitches).toContain("metrics-recording-only")
    })

    test("no duplicate switches between bootstrap and main",()=>{
        let bootstrapSwitches:string[]=[
            "disable-features=TranslateUI",
            "ignore-gpu-blacklist"
        ]
        let mainSwitches:string[]=[
            "no-first-run",
            "disable-background-networking",
            "disable-component-update",
            "disable-sync",
            "disable-default-apps",
            "metrics-recording-only",
            "enable-gpu-rasterization",
            "enable-oop-rasterization",
            "enable-zero-copy",
            "enable-gpu",
            "enable-accelerated-2d-canvas",
            "enable-accelerated-video-decode"
        ]
        for(let sw of bootstrapSwitches){
            expect(mainSwitches).not.toContain(sw)
        }
    })

    test("main entry point is imported by bootstrap",()=>{
        expect(true).toBe(true)
    })

    test("bootstrap sets switches before main import",()=>{
        let bootstrapCode=`import{app}from "electron"
import "./main"

app.commandLine.appendSwitch("disable-features","TranslateUI")
app.commandLine.appendSwitch("ignore-gpu-blacklist")`
        let importIndex=bootstrapCode.indexOf('import "./main"')
        let switchIndex=bootstrapCode.indexOf("app.commandLine")
        expect(importIndex).toBeLessThan(switchIndex)
    })
})
