// @vitest-environment happy-dom
import{describe,it,expect,vi,beforeEach}from "vitest"

// Mock i18n t() so we can control the help.content returned for each test
vi.mock("../src/renderer/i18n.ts",()=>({
    t: vi.fn((key: string) => {
        if (key === "help.content") return CURRENT_HELP_CONTENT
        return key
    })
}))

let CURRENT_HELP_CONTENT = ""

beforeEach(() => {
    CURRENT_HELP_CONTENT = ""
    vi.clearAllMocks()
})

describe("getHelpContent",()=>{
    it("returns fallback when content is empty",async()=>{
        CURRENT_HELP_CONTENT = ""
        let{getHelpContent}=await import("../src/renderer/helpContent.ts")
        let html = getHelpContent()
        expect(html).toContain("Training Generator Help")
        expect(html).toContain("Help content is loading")
    })

    it("returns fallback when t() returns the key itself (missing translation)",async()=>{
        let i18n = await import("../src/renderer/i18n.ts")
        vi.mocked(i18n.t).mockReturnValueOnce("help.content")
        let{getHelpContent}=await import("../src/renderer/helpContent.ts")
        let html = getHelpContent()
        expect(html).toContain("Training Generator Help")
    })

    it("returns provided content",async()=>{
        CURRENT_HELP_CONTENT = "<h3>Custom Help</h3><p>Custom content</p>"
        let{getHelpContent}=await import("../src/renderer/helpContent.ts")
        let html = getHelpContent()
        expect(html).toContain("Custom Help")
        expect(html).toContain("Custom content")
    })
})

describe("getHelpContent sanitization",()=>{
    it("strips script tags",async()=>{
        CURRENT_HELP_CONTENT = "<p>safe</p><script>alert('xss')</script><p>more</p>"
        let{getHelpContent}=await import("../src/renderer/helpContent.ts")
        let html = getHelpContent()
        expect(html).not.toContain("<script")
        expect(html).not.toContain("alert")
        expect(html).toContain("safe")
        expect(html).toContain("more")
    })

    it("strips inline event handlers (onclick, onload, etc.)",async()=>{
        CURRENT_HELP_CONTENT = "<p onclick=\"alert('xss')\">click me</p><img onload=\"steal()\" src=\"x\">"
        let{getHelpContent}=await import("../src/renderer/helpContent.ts")
        let html = getHelpContent()
        expect(html).not.toContain("onclick")
        expect(html).not.toContain("onload")
        expect(html).toContain("click me")
    })

    it("neutralizes javascript: URLs in href/src attributes",async()=>{
        CURRENT_HELP_CONTENT = "<a href=\"javascript:alert('xss')\">link</a><img src=\"javascript:steal()\">"
        let{getHelpContent}=await import("../src/renderer/helpContent.ts")
        let html = getHelpContent()
        // The sanitizer should replace javascript: URLs with #
        expect(html).not.toMatch(/href=["']?javascript:/)
        expect(html).not.toMatch(/src=["']?javascript:/)
    })

    it("preserves safe attributes and content",async()=>{
        CURRENT_HELP_CONTENT = "<a href=\"https://example.com\">safe link</a><p class=\"info\">text</p>"
        let{getHelpContent}=await import("../src/renderer/helpContent.ts")
        let html = getHelpContent()
        expect(html).toContain("https://example.com")
        expect(html).toContain("safe link")
        expect(html).toContain("class=\"info\"")
    })

    it("strips multiline script tags",async()=>{
        CURRENT_HELP_CONTENT = "<p>before</p><script>\nfunction evil(){\n  alert('xss')\n}\n</script><p>after</p>"
        let{getHelpContent}=await import("../src/renderer/helpContent.ts")
        let html = getHelpContent()
        expect(html).not.toContain("<script")
        expect(html).toContain("before")
        expect(html).toContain("after")
    })

    it("strips event handlers with single quotes",async()=>{
        CURRENT_HELP_CONTENT = "<p onclick='alert(\"xss\")'>click</p>"
        let{getHelpContent}=await import("../src/renderer/helpContent.ts")
        let html = getHelpContent()
        expect(html).not.toContain("onclick")
    })

    it("strips event handlers with no quotes",async()=>{
        CURRENT_HELP_CONTENT = "<p onclick=alert(1)>click</p>"
        let{getHelpContent}=await import("../src/renderer/helpContent.ts")
        let html = getHelpContent()
        expect(html).not.toContain("onclick")
    })
})

describe("getHelpSections",()=>{
    it("returns empty array when content has no h4 sections",async()=>{
        CURRENT_HELP_CONTENT = "<h3>Help</h3><p>Just intro</p>"
        let{getHelpSections}=await import("../src/renderer/helpContent.ts")
        let sections = getHelpSections()
        expect(sections).toEqual([])
    })

    it("extracts a single h4 section",async()=>{
        CURRENT_HELP_CONTENT = "<h4>Getting Started</h4><p>Intro content</p>"
        let{getHelpSections}=await import("../src/renderer/helpContent.ts")
        let sections = getHelpSections()
        expect(sections).toHaveLength(1)
        expect(sections[0].title).toBe("Getting Started")
        expect(sections[0].body).toContain("Intro content")
    })

    it("extracts multiple h4 sections",async()=>{
        CURRENT_HELP_CONTENT = "<h4>Getting Started</h4><p>Intro</p><h4>Requirements</h4><p>Req</p><h4>Troubleshooting</h4><p>Help</p>"
        let{getHelpSections}=await import("../src/renderer/helpContent.ts")
        let sections = getHelpSections()
        expect(sections).toHaveLength(3)
        expect(sections[0].title).toBe("Getting Started")
        expect(sections[1].title).toBe("Requirements")
        expect(sections[2].title).toBe("Troubleshooting")
    })

    it("trims whitespace in section titles and bodies",async()=>{
        CURRENT_HELP_CONTENT = "   <h4>  Spaced Title  </h4>   <p>  Spaced body  </p>   "
        let{getHelpSections}=await import("../src/renderer/helpContent.ts")
        let sections = getHelpSections()
        expect(sections[0].title).toBe("Spaced Title")
        expect(sections[0].body).toBe("<p>  Spaced body  </p>")
    })

    it("skips sections with empty title",async()=>{
        CURRENT_HELP_CONTENT = "<h4></h4><p>orphan body</p><h4>Real Section</h4><p>real body</p>"
        let{getHelpSections}=await import("../src/renderer/helpContent.ts")
        let sections = getHelpSections()
        expect(sections).toHaveLength(1)
        expect(sections[0].title).toBe("Real Section")
    })

    it("skips sections with whitespace-only title",async()=>{
        CURRENT_HELP_CONTENT = "<h4>   </h4><p>orphan body</p><h4>Real</h4><p>body</p>"
        let{getHelpSections}=await import("../src/renderer/helpContent.ts")
        let sections = getHelpSections()
        expect(sections).toHaveLength(1)
        expect(sections[0].title).toBe("Real")
    })

    it("handles missing body between sections",async()=>{
        CURRENT_HELP_CONTENT = "<h4>Section A</h4><h4>Section B</h4><p>body B</p>"
        let{getHelpSections}=await import("../src/renderer/helpContent.ts")
        let sections = getHelpSections()
        expect(sections).toHaveLength(2)
        expect(sections[0].title).toBe("Section A")
        expect(sections[0].body).toBe("")
        expect(sections[1].title).toBe("Section B")
        expect(sections[1].body).toContain("body B")
    })
})

describe("validateHelpContent",()=>{
    it("returns valid true when all required sections present",async()=>{
        CURRENT_HELP_CONTENT = "<h3>Help</h3><p>Getting Started, Requirements, Troubleshooting sections present</p>"
        let{validateHelpContent}=await import("../src/renderer/helpContent.ts")
        let result = validateHelpContent()
        expect(result.valid).toBe(true)
        expect(result.missing).toEqual([])
    })

    it("returns missing list when no required sections present",async()=>{
        CURRENT_HELP_CONTENT = "<h3>Help</h3><p>Just generic content</p>"
        let{validateHelpContent}=await import("../src/renderer/helpContent.ts")
        let result = validateHelpContent()
        expect(result.valid).toBe(false)
        expect(result.missing).toEqual(["Getting Started", "Requirements", "Troubleshooting"])
    })

    it("returns partial missing list when some required sections absent",async()=>{
        CURRENT_HELP_CONTENT = "<h3>Help</h3><p>Getting Started info here.</p>"
        let{validateHelpContent}=await import("../src/renderer/helpContent.ts")
        let result = validateHelpContent()
        expect(result.valid).toBe(false)
        expect(result.missing).toEqual(["Requirements", "Troubleshooting"])
    })

    it("validates against fallback content (which lacks required sections)",async()=>{
        CURRENT_HELP_CONTENT = "" // triggers fallback
        let{validateHelpContent}=await import("../src/renderer/helpContent.ts")
        let result = validateHelpContent()
        expect(result.valid).toBe(false)
        expect(result.missing.length).toBe(3)
    })

    it("detects required sections within h4 titles",async()=>{
        CURRENT_HELP_CONTENT = "<h4>Getting Started</h4><p>intro</p><h4>Requirements</h4><p>req</p><h4>Troubleshooting</h4><p>trouble</p>"
        let{validateHelpContent}=await import("../src/renderer/helpContent.ts")
        let result = validateHelpContent()
        expect(result.valid).toBe(true)
        expect(result.missing).toEqual([])
    })

    it("detects required sections anywhere in content",async()=>{
        CURRENT_HELP_CONTENT = "<p>For Getting Started help, see docs. For Requirements check the readme. Troubleshooting guide online.</p>"
        let{validateHelpContent}=await import("../src/renderer/helpContent.ts")
        let result = validateHelpContent()
        expect(result.valid).toBe(true)
    })
})
