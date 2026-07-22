import { describe, it, expect } from "vitest"
import { rawTranslations } from "../src/renderer/i18n.js"

// Extracts all {{param}} placeholders from a translation value.
function extractPlaceholders(value: string): string[] {
  const matches = value.match(/\{\{(\w+)\}\}/g)
  return matches ? matches.sort() : []
}

describe("i18n key parity", () => {
  const enKeys = Object.keys(rawTranslations["en"]).sort()
  const locales = Object.keys(rawTranslations).filter((l) => l !== "en")

  it("english locale has translations defined", () => {
    expect(enKeys.length).toBeGreaterThan(0)
  })

  it("all supported non-English locales are present", () => {
    expect(locales).toEqual(
      expect.arrayContaining([
        "zh-Hans",
        "zh-Hant",
        "ja",
        "ko",
        "es",
        "fr",
        "de",
      ])
    )
  })

  for (const locale of locales) {
    describe(`${locale} locale parity`, () => {
      const localeKeys = Object.keys(rawTranslations[locale]).sort()

      it(`has every key that English has (no missing translations)`, () => {
        const missing = enKeys.filter((k) => !(k in rawTranslations[locale]))
        if (missing.length > 0) {
          // Print up to 50 missing keys for debuggability; full list available
          // in .trae/specs/i18n-coverage-full-audit/missing-keys-audit.json
          const preview = missing.slice(0, 50).join("\n  ")
          expect(
            missing,
            `${locale} is missing ${missing.length} keys:\n  ${preview}${
              missing.length > 50 ? `\n  ... and ${missing.length - 50} more` : ""
            }`
          ).toEqual([])
        }
      })

      it(`has no extra keys that English does not have`, () => {
        const extra = localeKeys.filter((k) => !(k in rawTranslations["en"]))
        if (extra.length > 0) {
          expect(
            extra,
            `${locale} has ${extra.length} extra keys not in English:\n  ${extra.join("\n  ")}`
          ).toEqual([])
        }
      })

      it(`every value is a non-empty string`, () => {
        const empty: string[] = []
        for (const key of localeKeys) {
          const value = rawTranslations[locale][key]
          if (typeof value !== "string" || value.length === 0) {
            empty.push(key)
          }
        }
        if (empty.length > 0) {
          expect(
            empty,
            `${locale} has ${empty.length} empty/non-string values:\n  ${empty.join("\n  ")}`
          ).toEqual([])
        }
      })

      it(`preserves all {{param}} placeholders from English values`, () => {
        const broken: string[] = []
        for (const key of enKeys) {
          if (!(key in rawTranslations[locale])) continue
          const enPlaceholders = extractPlaceholders(rawTranslations["en"][key])
          if (enPlaceholders.length === 0) continue
          const localePlaceholders = extractPlaceholders(rawTranslations[locale][key])
          if (enPlaceholders.length !== localePlaceholders.length ||
              !enPlaceholders.every((p, i) => p === localePlaceholders[i])) {
            broken.push(
              `${key}: en has [${enPlaceholders.join(", ")}] but ${locale} has [${localePlaceholders.join(", ")}]`
            )
          }
        }
        if (broken.length > 0) {
          expect(
            broken,
            `${locale} has ${broken.length} keys with mismatched placeholders:\n  ${broken.join("\n  ")}`
          ).toEqual([])
        }
      })
    })
  }
})
