// @vitest-environment node
import { describe, test, expect } from "vitest"

/**
 * WCAG 2.1 relative luminance and contrast ratio helpers.
 * Spec: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * These pure-function tests don't need a DOM, so they run in node.
 */

interface Rgb {
    r: number
    g: number
    b: number
}

function hexToRgb(hex: string): Rgb {
    const clean = hex.replace(/^#/, "")
    const r = parseInt(clean.slice(0, 2), 16)
    const g = parseInt(clean.slice(2, 4), 16)
    const b = parseInt(clean.slice(4, 6), 16)
    return { r, g, b }
}

function channelLuminance(channel: number): number {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function relativeLuminance(rgb: Rgb): number {
    return (
        0.2126 * channelLuminance(rgb.r) +
        0.7152 * channelLuminance(rgb.g) +
        0.0722 * channelLuminance(rgb.b)
    )
}

function contrastRatio(fg: string, bg: string): number {
    const l1 = relativeLuminance(hexToRgb(fg))
    const l2 = relativeLuminance(hexToRgb(bg))
    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Light theme brand colors and the new text-safe variants. Values must stay in
 * sync with src/styles/tokens.css. The text-safe variants are picked to meet
 * WCAG AA 4.5:1 on every common light background (surface, surface-variant,
 * page background).
 */
const LIGHT_THEME = {
    "--primary-color": "#1A73E8",
    "--primary-hover": "#1557B0",
    "--primary-text": "#1557B0",
    "--secondary-color": "#34A853",
    "--secondary-hover": "#2E7D32",
    "--secondary-text": "#2E7D32",
    "--accent-color": "#EA4335",
    "--accent-hover": "#C53929",
    "--accent-text": "#C53929",
    "--warning-color": "#FBBC05",
    "--warning-hover": "#F9A825",
    "--warning-text": "#9A5400",
    "--surface-color": "#FFFFFF",
    "--surface-variant": "#F3F3F3",
    "--background-color": "#FAFAFA",
    "--text-primary": "#202124",
    "--text-secondary": "#5F6368",
    "--text-disabled": "#9AA0A6"
} as const

const DARK_THEME = {
    "--primary-color": "#8AB4F8",
    "--primary-text": "#8AB4F8",
    "--secondary-color": "#81C995",
    "--secondary-text": "#81C995",
    "--accent-color": "#F28B82",
    "--accent-text": "#F28B82",
    "--warning-color": "#FDD663",
    "--warning-text": "#FDD663",
    "--surface-color": "#202124",
    "--surface-variant": "#2D2E30",
    "--background-color": "#1A1A1A",
    "--text-primary": "#E8EAED",
    "--text-secondary": "#9AA0A6",
    "--text-disabled": "#5F6368"
} as const

const AA_NORMAL = 4.5
const AA_UI = 3.0 // WCAG 1.4.11 non-text contrast

describe("WCAG color contrast — light theme", () => {
    const bg = LIGHT_THEME["--background-color"]
    const surface = LIGHT_THEME["--surface-color"]
    const surfaceVariant = LIGHT_THEME["--surface-variant"]

    describe("text on page background (#FAFAFA)", () => {
        test("text-primary passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--text-primary"], bg)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("text-secondary passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--text-secondary"], bg)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("primary-text passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--primary-text"], bg)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("secondary-text passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--secondary-text"], bg)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("accent-text passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--accent-text"], bg)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("warning-text passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--warning-text"], bg)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
    })

    describe("text on surface (#FFFFFF)", () => {
        test("text-primary passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--text-primary"], surface)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("text-secondary passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--text-secondary"], surface)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("primary-text passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--primary-text"], surface)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("secondary-text passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--secondary-text"], surface)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("accent-text passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--accent-text"], surface)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("warning-text passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--warning-text"], surface)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
    })

    describe("text on surface-variant (#F3F3F3)", () => {
        test("text-primary passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--text-primary"], surfaceVariant)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("text-secondary passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--text-secondary"], surfaceVariant)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("primary-text passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--primary-text"], surfaceVariant)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("secondary-text passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--secondary-text"], surfaceVariant)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("accent-text passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--accent-text"], surfaceVariant)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("warning-text passes AA", () => {
            expect(contrastRatio(LIGHT_THEME["--warning-text"], surfaceVariant)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
    })

    describe("brand colors used as UI accents pass 3:1 non-text contrast", () => {
        test("primary-color on background passes 3:1", () => {
            expect(contrastRatio(LIGHT_THEME["--primary-color"], bg)).toBeGreaterThanOrEqual(AA_UI)
        })
        test("accent-color on background passes 3:1", () => {
            expect(contrastRatio(LIGHT_THEME["--accent-color"], bg)).toBeGreaterThanOrEqual(AA_UI)
        })
    })

    describe("raw brand colors that must NOT be used as normal-size text", () => {
        test("primary-color fails AA on background (so text variant is required)", () => {
            expect(contrastRatio(LIGHT_THEME["--primary-color"], bg)).toBeLessThan(AA_NORMAL)
        })
        test("warning-color fails AA on background (so text variant is required)", () => {
            expect(contrastRatio(LIGHT_THEME["--warning-color"], bg)).toBeLessThan(AA_NORMAL)
        })
        test("accent-color fails AA on background (so text variant is required)", () => {
            expect(contrastRatio(LIGHT_THEME["--accent-color"], bg)).toBeLessThan(AA_NORMAL)
        })
        test("secondary-color fails AA on background (so text variant is required)", () => {
            expect(contrastRatio(LIGHT_THEME["--secondary-color"], bg)).toBeLessThan(AA_NORMAL)
        })
    })
})

describe("WCAG color contrast — dark theme", () => {
    const bg = DARK_THEME["--background-color"]
    const surface = DARK_THEME["--surface-color"]
    const surfaceVariant = DARK_THEME["--surface-variant"]

    describe("text on page background (#1A1A1A)", () => {
        test("text-primary passes AA", () => {
            expect(contrastRatio(DARK_THEME["--text-primary"], bg)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("text-secondary passes AA", () => {
            expect(contrastRatio(DARK_THEME["--text-secondary"], bg)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("primary-text passes AA", () => {
            expect(contrastRatio(DARK_THEME["--primary-text"], bg)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("secondary-text passes AA", () => {
            expect(contrastRatio(DARK_THEME["--secondary-text"], bg)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("accent-text passes AA", () => {
            expect(contrastRatio(DARK_THEME["--accent-text"], bg)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("warning-text passes AA", () => {
            expect(contrastRatio(DARK_THEME["--warning-text"], bg)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
    })

    describe("text on surface (#202124)", () => {
        test("text-primary passes AA", () => {
            expect(contrastRatio(DARK_THEME["--text-primary"], surface)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("text-secondary passes AA", () => {
            expect(contrastRatio(DARK_THEME["--text-secondary"], surface)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("primary-text passes AA", () => {
            expect(contrastRatio(DARK_THEME["--primary-text"], surface)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("secondary-text passes AA", () => {
            expect(contrastRatio(DARK_THEME["--secondary-text"], surface)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("accent-text passes AA", () => {
            expect(contrastRatio(DARK_THEME["--accent-text"], surface)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("warning-text passes AA", () => {
            expect(contrastRatio(DARK_THEME["--warning-text"], surface)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
    })

    describe("text on surface-variant (#2D2E30)", () => {
        test("text-primary passes AA", () => {
            expect(contrastRatio(DARK_THEME["--text-primary"], surfaceVariant)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("text-secondary passes AA", () => {
            expect(contrastRatio(DARK_THEME["--text-secondary"], surfaceVariant)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("primary-text passes AA", () => {
            expect(contrastRatio(DARK_THEME["--primary-text"], surfaceVariant)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("secondary-text passes AA", () => {
            expect(contrastRatio(DARK_THEME["--secondary-text"], surfaceVariant)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("accent-text passes AA", () => {
            expect(contrastRatio(DARK_THEME["--accent-text"], surfaceVariant)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
        test("warning-text passes AA", () => {
            expect(contrastRatio(DARK_THEME["--warning-text"], surfaceVariant)).toBeGreaterThanOrEqual(AA_NORMAL)
        })
    })
})

describe("WCAG contrast ratio helpers", () => {
    test("black on white = 21:1", () => {
        expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0)
    })
    test("white on white = 1:1", () => {
        expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 0)
    })
    test("known WCAG sample: #777 on #FFF ≈ 4.48", () => {
        // WCAG 2.1 spec example: 4.48:1 for #777777 on #FFFFFF
        expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1)
    })
})
