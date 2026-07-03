// @vitest-environment node
import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

function readJson(path: string): any {
    return JSON.parse(readFileSync(path, "utf-8"))
}

describe("pdf-parse asarUnpack", () => {
    it("depends on native packages that require filesystem access", () => {
        let pkg = readJson(join(process.cwd(), "node_modules/pdf-parse/package.json"))
        let deps = Object.keys(pkg.dependencies || {})
        expect(deps).toContain("@napi-rs/canvas")
        expect(deps).toContain("pdfjs-dist")
    })
    it("keeps pdf-parse unpacked in the packaged app", () => {
        let pkg = readJson(join(process.cwd(), "package.json"))
        let unpack = pkg.build?.asarUnpack || []
        expect(unpack).toContain("**/pdf-parse/**/*")
    })
})
