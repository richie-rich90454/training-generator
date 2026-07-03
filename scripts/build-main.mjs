import esbuild from "esbuild"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

const external = [
    "electron",
    "axios",
    "pdf-parse",
    "mammoth",
    "officeparser",
    "rtf-parser-fixes",
    "html-to-text",
    "compromise",
    "better-sqlite3"
]

const commonOptions = {
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    external,
    sourcemap: false,
    minify: true,
    legalComments: "none",
    logLevel: "info"
}

await esbuild.build({
    ...commonOptions,
    entryPoints: [path.join(root, "src/main.ts")],
    outfile: path.join(root, "dist-main/main.js")
})

await esbuild.build({
    ...commonOptions,
    entryPoints: [path.join(root, "src/preload.ts")],
    outfile: path.join(root, "dist-main/preload.js")
})

console.log("Main process bundled to dist-main/")
