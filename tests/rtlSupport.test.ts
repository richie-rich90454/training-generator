import{describe, test, expect, beforeEach}from"vitest"
import{isRtlLocale, getTextDirection, convertToLogical, RtlManager}from"../src/core/rtlSupport.js"
describe("rtlSupport", ()=>{
    beforeEach(()=>{
        document.body.className="";
        document.dir="";
    })
    test("isRtlLocale returns true for ar", ()=>{
        expect(isRtlLocale("ar")).toBe(true)
    })
    test("isRtlLocale returns false for en", ()=>{
        expect(isRtlLocale("en")).toBe(false)
    })
    test("isRtlLocale returns true for ar-SA", ()=>{
        expect(isRtlLocale("ar-SA")).toBe(true)
    })
    test("isRtlLocale returns false for en-US", ()=>{
        expect(isRtlLocale("en-US")).toBe(false)
    })
    test("isRtlLocale handles uppercase locale", ()=>{
        expect(isRtlLocale("AR")).toBe(true)
    })
    test("getTextDirection returns rtl for Arabic", ()=>{
        expect(getTextDirection("ar")).toBe("rtl")
    })
    test("getTextDirection returns ltr for English", ()=>{
        expect(getTextDirection("en")).toBe("ltr")
    })
    test("getTextDirection returns ltr for unknown locale", ()=>{
        expect(getTextDirection("xx")).toBe("ltr")
    })
    test("convertToLogical converts margin-left", ()=>{
        expect(convertToLogical("margin-left", "10px")).toEqual({property: "margin-inline-start", value: "10px"})
    })
    test("convertToLogical converts padding-right", ()=>{
        expect(convertToLogical("padding-right", "1rem")).toEqual({property: "padding-inline-end", value: "1rem"})
    })
    test("convertToLogical converts text-align left to start", ()=>{
        expect(convertToLogical("text-align", "left")).toEqual({property: "text-align", value: "start"})
    })
    test("convertToLogical converts text-align right to end", ()=>{
        expect(convertToLogical("text-align", "right")).toEqual({property: "text-align", value: "end"})
    })
    test("convertToLogical converts float right to inline-end", ()=>{
        expect(convertToLogical("float", "right")).toEqual({property: "float", value: "inline-end"})
    })
    test("convertToLogical leaves unrelated property unchanged", ()=>{
        expect(convertToLogical("color", "red")).toEqual({property: "color", value: "red"})
    })
    test("RtlManager setDirection updates document.dir to rtl", ()=>{
        let manager=new RtlManager({document})
        manager.setDirection("ar")
        expect(document.dir).toBe("rtl")
    })
    test("RtlManager setDirection adds rtl body class", ()=>{
        let manager=new RtlManager({document})
        manager.setDirection("ar")
        expect(document.body.classList.contains("rtl")).toBe(true)
    })
    test("RtlManager setDirection sets ltr for English", ()=>{
        let manager=new RtlManager({document})
        manager.setDirection("en")
        expect(document.dir).toBe("ltr")
    })
    test("RtlManager setDirection removes rtl body class for ltr", ()=>{
        document.body.classList.add("rtl")
        let manager=new RtlManager({document})
        manager.setDirection("en")
        expect(document.body.classList.contains("rtl")).toBe(false)
    })
    test("RtlManager getCurrentDirection returns set direction", ()=>{
        let manager=new RtlManager({document})
        manager.setDirection("ar")
        expect(manager.getCurrentDirection()).toBe("rtl")
    })
    test("RtlManager applyLogicalCss converts margin-left", ()=>{
        let manager=new RtlManager({document})
        let result=manager.applyLogicalCss(".box{margin-left: 10px;}")
        expect(result).toContain("margin-inline-start:10px")
    })
    test("RtlManager applyLogicalCss converts multiple properties", ()=>{
        let manager=new RtlManager({document})
        let css=".box{padding-right: 1rem; text-align: left; float: right;}"
        let result=manager.applyLogicalCss(css)
        expect(result).toContain("padding-inline-end:1rem")
        expect(result).toContain("text-align:start")
        expect(result).toContain("float:inline-end")
    })
    test("RtlManager mirrorClass mirrors ml-2", ()=>{
        let manager=new RtlManager({document})
        expect(manager.mirrorClass("ml-2")).toBe("ml-2-rtl")
    })
    test("RtlManager mirrorClass mirrors text-left", ()=>{
        let manager=new RtlManager({document})
        expect(manager.mirrorClass("text-left")).toBe("text-left-rtl")
    })
    test("RtlManager mirrorClass leaves unrelated class unchanged", ()=>{
        let manager=new RtlManager({document})
        expect(manager.mirrorClass("font-bold")).toBe("font-bold")
    })
})
