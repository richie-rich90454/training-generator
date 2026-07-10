import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { translations } from "../src/renderer/i18n.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, "i18n-missing.log")

const enKeys = Object.keys(translations.en).sort()
const locales = Object.keys(translations).filter((l) => l !== "en")

const lines: string[] = []
let missing = 0
for (const locale of locales) {
    const dict = translations[locale]
    const missingKeys = enKeys.filter((k) => !(k in dict))
    if (missingKeys.length > 0) {
        missing += missingKeys.length
        lines.push(`\n[${locale}] missing ${missingKeys.length} keys:`)
        for (const k of missingKeys) {
            lines.push(`  - ${k}`)
        }
    }
}

fs.writeFileSync(outPath, lines.join("\n"), "utf-8")

if (missing === 0) {
    console.log("All locales have 100% key coverage against English.")
} else {
    console.log(`Missing ${missing} keys across ${locales.length} locales. See scripts/i18n-missing.log`)
}
process.exit(missing === 0 ? 0 : 1)
