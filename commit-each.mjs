import { execSync } from "child_process"
import path from "path"

function exec(cmd) {
    return execSync(cmd, { encoding: "utf-8", cwd: process.cwd() })
}

function messageFor(file, status) {
    const ext = path.extname(file)
    const base = path.basename(file, ext)
    const dir = path.dirname(file)

    if (file === "package.json") {
        return "build(deps): migrate renderer dependencies to SolidJS and clean npm scripts"
    }
    if (file === "package-lock.json") {
        return "build(deps): update lockfile for SolidJS ecosystem"
    }
    if (file === "tsconfig.json") {
        return "build(tsconfig): configure JSX and imports for SolidJS"
    }
    if (file === "vite.config.ts") {
        return "build(vite): switch to vite-plugin-solid and configure production asset handling"
    }
    if (file === "vitest.config.ts") {
        return "build(vitest): configure SolidJS component testing environment"
    }
    if (file === "index.html") {
        return "fix(csp): allow app protocol and strip crossorigin for Electron production"
    }
    if (file === "src/main.ts") {
        return "fix(protocol): register custom app scheme to serve production renderer assets"
    }
    if (file === "src/renderer/icons.ts") {
        return "refactor(renderer): adapt icon registry for SolidJS components"
    }
    if (file === "src/styles/main.css") {
        return "style(global): consolidate remaining global stylesheet"
    }
    if (file === "src/types/modules.d.ts") {
        return "types(modules): remove obsolete React module declarations"
    }
    if (file === "README.md") {
        return "docs(readme): document SolidJS renderer migration"
    }
    if (file === "CONTRIBUTING.md") {
        return "docs(contributing): update SolidJS development guidelines"
    }
    if (file === "docs/architecture.md") {
        return "docs(architecture): update architecture docs for SolidJS stores"
    }
    if (file === "tasks.md") {
        return "chore(docs): remove completed migration task list"
    }

    if (dir.startsWith("src/renderer/components/styles")) {
        return `style(ui): add CSS Module styles for ${base}`
    }
    if (dir.startsWith("src/renderer/components")) {
        if (ext === ".tsx") {
            return `feat(ui): add SolidJS component ${base}`
        }
        return `refactor(ui): migrate ${base} to SolidJS`
    }
    if (dir.startsWith("src/renderer/stores")) {
        return `feat(stores): add SolidJS store ${base}`
    }
    if (dir.startsWith("src/renderer/processing")) {
        return `refactor(processing): add framework-agnostic ${base}`
    }
    if (dir.startsWith("src/renderer") || file.startsWith("src/renderer/")) {
        if (status === "D") {
            return `refactor(renderer): remove legacy React module ${base}`
        }
        return `refactor(renderer): migrate ${base} to SolidJS`
    }
    if (dir.startsWith("src/styles")) {
        if (status === "D") {
            return `style(global): remove migrated global stylesheet ${base}`
        }
        return `style(global): update global stylesheet ${base}`
    }
    if (dir.startsWith("tests")) {
        if (status === "D") {
            return `test(ui): remove obsolete React test ${base}`
        }
        if (ext === ".tsx") {
            return `test(ui): add SolidJS test ${base}`
        }
        return `test(ui): update ${base} for SolidJS migration`
    }

    if (status === "D") {
        return `chore(cleanup): remove ${file}`
    }
    if (status === "??") {
        return `feat(add): add ${file}`
    }
    return `refactor(migration): update ${file}`
}

const statusOutput = exec("git status --porcelain -uall")
const lines = statusOutput.trim().split("\n").filter(Boolean)

for (const line of lines) {
    const match = line.match(/^(.)(.)\s+(.+)$/)
    if (!match) continue
    const status = (match[1] + match[2]).trim()
    const file = match[3].trim()
    if (!file) continue

    const msg = messageFor(file, status)
    console.log(`[${status}] ${file} -> ${msg}`)

    try {
        if (status === "D") {
            exec(`git rm "${file}"`)
        } else {
            exec(`git add "${file}"`)
        }
        exec(`git commit -m "${msg.replace(/"/g, '\\"')}"`)
    } catch (err) {
        console.error(`Failed to commit ${file}:`, err.message)
        process.exit(1)
    }
}

console.log(`Committed ${lines.length} changes.`)
