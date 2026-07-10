import { execSync } from 'child_process'
import path from 'path'

function run(cmd) {
    return execSync(cmd, { cwd: 'c:\\Users\\rjian\\Desktop\\training-generator', encoding: 'utf8', stdio: 'pipe' })
}

function msgFor(file, status) {
    const basename = path.basename(file)
    const dir = path.dirname(file).replace(/\\/g, '/')
    const scope = dir === '.' ? basename : `${dir}/${basename}`
    if (status === 'D') {
        if (file.includes('splash')) return `refactor: remove ${basename} as part of splash screen removal`
        if (file === '.gitattributes') return `chore: remove .gitattributes`
        return `refactor: remove ${basename}`
    }
    if (status === '??') {
        if (file.startsWith('tests/')) return `test: add ${basename}`
        if (file.startsWith('scripts/')) return `chore: add ${basename}`
        return `feat: add ${basename}`
    }
    // Modified
    if (file === 'package.json' || file === 'package-lock.json') return `chore(deps): update ${basename}`
    if (file === 'README.md') return `docs: update README`
    if (file === '.gitignore') return `chore: update .gitignore`
    if (file.startsWith('tests/')) return `test: update ${basename}`
    if (file.startsWith('src/renderer/components/styles/')) return `style: update ${basename}`
    if (file.startsWith('src/renderer/components/')) return `ui: update ${basename}`
    if (file.startsWith('src/renderer/stores/')) return `refactor(stores): update ${basename}`
    if (file.startsWith('src/renderer/workers/')) return `fix(workers): update ${basename}`
    if (file.startsWith('src/renderer/processing/')) return `fix(processing): update ${basename}`
    if (file === 'src/renderer/chunker.ts') return `fix(chunker): relax min chunk size clamp and keep memory guards`
    if (file === 'src/renderer/processor.ts') return `fix(processor): improve concurrency and memory handling`
    if (file === 'src/main.ts') return `fix(main): disable GPU compositor paths to prevent renderer crashes`
    if (file === 'src/preload.ts') return `fix(preload): expose additional IPC channels`
    if (file.startsWith('src/types/')) return `types: update ${basename}`
    if (file.startsWith('src/core/')) return `fix(core): update ${basename}`
    if (file.startsWith('src/renderer/i18n.ts')) return `i18n: complete translations and key coverage`
    if (file.startsWith('src/renderer/icons.ts')) return `ui(icons): update icon registry`
    if (file === 'vitest.config.ts') return `chore(tests): update vitest config`
    return `update ${basename}`
}

const status = run('git status --porcelain').trim().split('\n').filter(Boolean)
for (const line of status) {
    const s = line.slice(0, 2)
    const file = line.slice(3)
    if (!file) continue
    const message = msgFor(file, s)
    try {
        if (s === 'D') {
            run(`git rm "${file}"`)
        } else if (s === '??') {
            run(`git add "${file}"`)
        } else {
            run(`git add "${file}"`)
        }
        run(`git commit -m "${message}"`)
        console.log(`committed ${file}: ${message}`)
    } catch (e) {
        console.error(`failed ${file}:`, e.stderr || e.message)
    }
}
