// @vitest-environment happy-dom
import { describe, test, expect, vi, afterEach } from "vitest"
import { render, cleanup } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { Icon } from "../src/renderer/components/Icon.tsx"
import { renderIcon, hasIcon, iconRegistry } from "../src/renderer/icons.js"

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe("Icon component", () => {
    test("renders a span element", () => {
        render(() => <Icon html="<svg></svg>" />)
        const span = document.querySelector("span")
        expect(span).not.toBeNull()
    })
    test("span has aria-hidden='true'", () => {
        render(() => <Icon html="<svg></svg>" />)
        const span = document.querySelector("span")
        expect(span?.getAttribute("aria-hidden")).toBe("true")
    })
    test("renders html prop as innerHTML", () => {
        const html = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>`
        render(() => <Icon html={html} />)
        const span = document.querySelector("span")
        // innerHTML normalizes self-closing tags to <circle></circle>, so check structure
        expect(span?.innerHTML).toContain("<svg")
        expect(span?.innerHTML).toContain('viewBox="0 0 24 24"')
        expect(span?.innerHTML).toContain('cx="12"')
        expect(span?.innerHTML).toContain('cy="12"')
        expect(span?.innerHTML).toContain('r="10"')
        expect(span?.innerHTML).toContain("</svg>")
        expect(span?.querySelector("circle")).not.toBeNull()
    })
    test("applies class prop to span", () => {
        render(() => <Icon html="<svg></svg>" class="my-icon" />)
        const span = document.querySelector("span")
        expect(span?.className).toBe("my-icon")
    })
    test("renders without class when class prop omitted", () => {
        render(() => <Icon html="<svg></svg>" />)
        const span = document.querySelector("span")
        expect(span?.getAttribute("class") ?? "").toBe("")
    })
    test("updates innerHTML when html prop changes", () => {
        const [html, setHtml] = createSignal('<svg id="a"></svg>')
        render(() => <Icon html={html()} />)
        const span = document.querySelector("span")
        expect(span?.innerHTML).toContain('id="a"')
        setHtml('<svg id="b"></svg>')
        expect(span?.innerHTML).toContain('id="b"')
    })
    test("updates class when class prop changes", () => {
        const [cls, setCls] = createSignal("first")
        render(() => <Icon html="<svg></svg>" class={cls()} />)
        const span = document.querySelector("span")
        expect(span?.className).toBe("first")
        setCls("second")
        expect(span?.className).toBe("second")
    })
    test("renders complex SVG with nested elements", () => {
        const html = `<svg viewBox="0 0 24 24"><g><circle cx="12" cy="12" r="10"></circle><path d="M8 12 L16 12"></path></g></svg>`
        render(() => <Icon html={html} />)
        const span = document.querySelector("span")
        expect(span?.innerHTML).toContain("<svg")
        expect(span?.innerHTML).toContain("</svg>")
        expect(span?.querySelector("circle")).not.toBeNull()
        expect(span?.querySelector("path")).not.toBeNull()
        expect(span?.querySelector("g")).not.toBeNull()
    })
    test("renders empty html without error", () => {
        render(() => <Icon html="" />)
        const span = document.querySelector("span")
        expect(span?.innerHTML).toBe("")
    })
})

describe("renderIcon", () => {
    test("returns SVG string for known icon name", () => {
        const svg = renderIcon("fa-cog")
        expect(svg).toContain("<svg")
        expect(svg).toContain("</svg>")
    })
    test("returns SVG with viewBox 0 0 24 24 for known icon", () => {
        const svg = renderIcon("fa-cog")
        expect(svg).toContain('viewBox="0 0 24 24"')
    })
    test("default size is 16", () => {
        const svg = renderIcon("fa-cog")
        expect(svg).toContain('width="16"')
        expect(svg).toContain('height="16"')
    })
    test("applies custom size to width and height", () => {
        const svg = renderIcon("fa-cog", 32)
        expect(svg).toContain('width="32"')
        expect(svg).toContain('height="32"')
    })
    test("applies size 8 correctly", () => {
        const svg = renderIcon("fa-cog", 8)
        expect(svg).toContain('width="8"')
        expect(svg).toContain('height="8"')
    })
    test("returns fallback SVG with circle for unknown icon name", () => {
        const svg = renderIcon("fa-nonexistent-icon-xyz")
        expect(svg).toContain("<svg")
        expect(svg).toContain("<circle")
        expect(svg).toContain('cx="12"')
        expect(svg).toContain('cy="12"')
        expect(svg).toContain('r="10"')
    })
    test("fallback SVG includes size in width/height", () => {
        const svg = renderIcon("fa-nonexistent-icon-xyz", 24)
        expect(svg).toContain('width="24"')
        expect(svg).toContain('height="24"')
    })
    test("fallback SVG has stroke currentColor and fill none", () => {
        const svg = renderIcon("fa-nonexistent-icon-xyz")
        expect(svg).toContain('stroke="currentColor"')
        expect(svg).toContain('fill="none"')
    })
    test("logs console.warn for unknown icon name", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
        renderIcon("fa-nonexistent-icon-xyz")
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("fa-nonexistent-icon-xyz"))
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("not found in registry"))
    })
    test("does not log warning for known icon", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
        renderIcon("fa-cog")
        expect(warnSpy).not.toHaveBeenCalled()
    })
})

describe("renderIcon SVG sanitization", () => {
    // Since sanitizeSvg isn't exported, we test it by temporarily swapping
    // a registry entry with a malicious SVG, calling renderIcon, then restoring.
    function withSwappedIcon(name: string, maliciousSvg: string, fn: () => void): void {
        const original = iconRegistry[name]
        iconRegistry[name] = maliciousSvg
        try {
            fn()
        } finally {
            iconRegistry[name] = original
        }
    }
    test("strips <script> tags from SVG", () => {
        const original = iconRegistry["fa-cog"]
        const malicious = original.replace("</svg>", "<script>alert('xss')</script></svg>")
        let result = ""
        withSwappedIcon("fa-cog", malicious, () => {
            result = renderIcon("fa-cog")
        })
        expect(result).not.toContain("<script")
        expect(result).not.toContain("</script")
        expect(result).not.toContain("alert")
    })
    test("strips on* event handlers from SVG", () => {
        const original = iconRegistry["fa-cog"]
        const malicious = original.replace("<svg", '<svg onload="alert(\'xss\')"')
        let result = ""
        withSwappedIcon("fa-cog", malicious, () => {
            result = renderIcon("fa-cog")
        })
        expect(result).not.toContain("onload")
        expect(result).not.toContain("alert")
    })
    test("strips javascript: href attributes from SVG", () => {
        const original = iconRegistry["fa-cog"]
        const malicious = original.replace("<svg", '<a href="javascript:alert(\'xss\')">') + "</a>"
        let result = ""
        withSwappedIcon("fa-cog", malicious, () => {
            result = renderIcon("fa-cog")
        })
        expect(result).not.toContain("javascript:")
    })
    test("strips xlink:href javascript: attributes from SVG", () => {
        const original = iconRegistry["fa-cog"]
        const malicious = original.replace("<svg", '<a xlink:href="javascript:alert(\'xss\')">') + "</a>"
        let result = ""
        withSwappedIcon("fa-cog", malicious, () => {
            result = renderIcon("fa-cog")
        })
        expect(result).not.toContain("javascript:")
    })
    test("strips single-quoted on* handlers", () => {
        const original = iconRegistry["fa-cog"]
        const malicious = original.replace("<svg", "<svg onclick='alert(1)'")
        let result = ""
        withSwappedIcon("fa-cog", malicious, () => {
            result = renderIcon("fa-cog")
        })
        expect(result).not.toContain("onclick")
        expect(result).not.toContain("alert")
    })
    test("strips unquoted on* handlers", () => {
        const original = iconRegistry["fa-cog"]
        const malicious = original.replace("<svg", "<svg onload=alert(1)")
        let result = ""
        withSwappedIcon("fa-cog", malicious, () => {
            result = renderIcon("fa-cog")
        })
        expect(result).not.toContain("onload")
        expect(result).not.toContain("alert")
    })
    test("strips multiple on* handlers in one SVG", () => {
        const original = iconRegistry["fa-cog"]
        const malicious = original
            .replace("<circle", '<circle onmouseover="alert(1)"')
            .replace("<path", '<path onclick="alert(2)"')
        let result = ""
        withSwappedIcon("fa-cog", malicious, () => {
            result = renderIcon("fa-cog")
        })
        expect(result).not.toContain("onmouseover")
        expect(result).not.toContain("onclick")
        expect(result).not.toContain("alert")
    })
    test("preserves legitimate SVG attributes after sanitization", () => {
        const svg = renderIcon("fa-cog")
        expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
        expect(svg).toContain('viewBox="0 0 24 24"')
        expect(svg).toContain('stroke="currentColor"')
    })
    test("size replacement still works after sanitization", () => {
        const original = iconRegistry["fa-cog"]
        const malicious = original.replace("</svg>", "<script>alert(1)</script></svg>")
        let result = ""
        withSwappedIcon("fa-cog", malicious, () => {
            result = renderIcon("fa-cog", 48)
        })
        expect(result).toContain('width="48"')
        expect(result).toContain('height="48"')
    })
})

describe("hasIcon", () => {
    test("returns true for known icon name", () => {
        expect(hasIcon("fa-cog")).toBe(true)
    })
    test("returns false for unknown icon name", () => {
        expect(hasIcon("fa-nonexistent-icon-xyz")).toBe(false)
    })
    test("returns true for all registered icons", () => {
        for (const name of Object.keys(iconRegistry)) {
            expect(hasIcon(name)).toBe(true)
        }
    })
    test("returns false for empty string", () => {
        expect(hasIcon("")).toBe(false)
    })
    test("uses hasOwnProperty (not prototype chain)", () => {
        expect(hasIcon("toString")).toBe(false)
        expect(hasIcon("hasOwnProperty")).toBe(false)
    })
    test("returns true for fa-file- (dynamic template prefix)", () => {
        expect(hasIcon("fa-file-")).toBe(true)
    })
})

describe("iconRegistry", () => {
    test("contains fa-cog icon", () => {
        expect(iconRegistry["fa-cog"]).toBeDefined()
        expect(typeof iconRegistry["fa-cog"]).toBe("string")
    })
    test("contains fa-edit icon", () => {
        expect(iconRegistry["fa-edit"]).toBeDefined()
    })
    test("contains fa-server icon (used by StatusPanel)", () => {
        expect(iconRegistry["fa-server"]).toBeDefined()
    })
    test("contains fa-question-circle icon (used by TitleBar)", () => {
        expect(iconRegistry["fa-question-circle"]).toBeDefined()
    })
    test("all registry entries are strings starting with <svg", () => {
        for (const [, svg] of Object.entries(iconRegistry)) {
            expect(typeof svg).toBe("string")
            expect(svg.startsWith("<svg")).toBe(true)
            expect(svg.endsWith("</svg>")).toBe(true)
        }
    })
    test("all registry entries have viewBox 0 0 24 24", () => {
        for (const [, svg] of Object.entries(iconRegistry)) {
            expect(svg).toContain('viewBox="0 0 24 24"')
        }
    })
    test("all registry entries have width and height 16 by default", () => {
        for (const [, svg] of Object.entries(iconRegistry)) {
            expect(svg).toContain('width="16"')
            expect(svg).toContain('height="16"')
        }
    })
    test("registry has at least 40 icons", () => {
        expect(Object.keys(iconRegistry).length).toBeGreaterThanOrEqual(40)
    })
})
