# Development Guide

This guide covers local development setup, scripts, code style, testing, build and packaging, and the conventions used across the Training Generator codebase. It is the companion to [CONTRIBUTING.md](../CONTRIBUTING.md), which covers the contribution workflow and PR checklist.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Repository layout](#repository-layout)
- [npm scripts](#npm-scripts)
- [Development workflow](#development-workflow)
- [Code style](#code-style)
- [Testing](#testing)
- [Build and packaging](#build-and-packaging)
- [Documentation](#documentation)
- [Conventional Commits](#conventional-commits)
- [Releasing](#releasing)

---

## Prerequisites

| Requirement | Minimum | Recommended | Notes |
| --- | --- | --- | --- |
| Node.js | 18+ | 24 LTS | Required for the build toolchain and CLI. |
| npm | 9+ | 10+ | Ships with Node.js. |
| Git | any | latest | Required to clone the repository. |
| Ollama | — | latest | Required for local model inference. [Download](https://ollama.com/) |
| OS | Windows 10+, macOS 12+, or Linux | — | Cross-platform Electron build. |

Native modules (`better-sqlite3`, PDF parsing libraries) compile bindings during `npm install`. Platform build tools are required:

- **Windows**: Visual Studio Build Tools with the "Desktop development with C++" workload.
- **macOS**: `xcode-select --install`.
- **Linux**: `build-essential`, `python3`, `make`, and `g++`.

A `postinstall` script (`scripts/postinstall.mjs`) verifies native dependencies after install.

---

## Quick start

```bash
# 1. Clone
git clone https://github.com/richie-rich90454/training-generator.git
cd training-generator

# 2. Install dependencies (compiles native modules)
npm install

# 3. Start Ollama in a separate terminal
ollama serve
ollama pull llama3.2

# 4. Launch the app in development mode
npm run dev
```

The development script (`scripts/dev.mjs`) runs Vite and Electron concurrently. The renderer hot-reloads on file changes; the main process restarts on changes to `src/main.ts`.

---

## Repository layout

```text
training-generator/
├── assets/                 Application icons and images
├── docs/                   VitePress documentation site
├── examples/               Example datasets and sample inputs
├── scripts/                Build and development scripts (dev, build, postinstall)
├── src/
│   ├── cli/                Headless command-line interface
│   ├── core/               Document parsers and shared business logic
│   ├── main.ts             Electron main process entry point
│   ├── preload.ts          contextBridge preload script
│   ├── prompts/            Prompt templates (8 languages x 4 types)
│   ├── renderer/
│   │   ├── components/     SolidJS UI components
│   │   ├── components/styles/  CSS modules
│   │   ├── exporters/      Export format writers
│   │   ├── processing/     Orchestrator and pipeline glue
│   │   ├── stores/         SolidJS reactive stores
│   │   ├── validators/     Quality validators
│   │   └── workers/        Web workers (chunking, dedup)
│   └── types/              TypeScript interfaces (AppSettings, IPC, etc.)
├── tests/                  Vitest test suites and fixtures
├── .github/                Workflows, issue templates, funding
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

The repository intentionally separates UI code (`src/renderer`), business logic (`src/core`, `src/renderer/processing`), infrastructure (`src/main.ts`, `src/preload.ts`), and build tooling (`scripts/`, config files).

---

## npm scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server + Electron with hot reload. |
| `npm start` | Build (`prestart`) then launch Electron from compiled output. |
| `npm run build` | Build main process (`build:main`) and renderer (`vite build`). |
| `npm run build:main` | Build only the main process via `scripts/build-main.mjs`. |
| `npm run package` | Build and package for the current platform via `electron-builder`. |
| `npm run package:win` | Package Windows NSIS + portable. |
| `npm run package:mac` | Package macOS DMG + ZIP (Apple Silicon). |
| `npm run package:linux` | Package Linux AppImage + DEB. |
| `npm test` | Run the full Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run test:coverage` | Run Vitest with V8 coverage. |
| `npm run lint` | Run `tsc --noEmit` (typecheck). Alias: `npm run typecheck`. |
| `npm run typecheck` | Same as `lint`. |
| `npm run cli` | Run the headless CLI via `tsx src/cli/index.ts`. |
| `npm run docs:dev` | Start the VitePress docs dev server. |
| `npm run docs:build` | Build the VitePress docs site. |
| `npm run docs:preview` | Preview the built docs site locally. |

---

## Development workflow

1. Create a feature branch from `main`: `feat/short-description`, `fix/short-description`, `docs/short-description`, or `ci/short-description`.
2. Make focused changes. Keep commits small and atomic.
3. Run `npm run typecheck` and `npm test` locally before pushing.
4. Open a pull request against `richie-rich90454:main`. Fill in the PR template.
5. Address review comments. CI must pass before merge.

::: tip Iterative feedback
Run `npm run test:watch` during development for fast feedback on the test suite. Run `npm run dev` to exercise UI changes against a live Electron window with hot reload.
:::

---

## Code style

- **TypeScript strict mode** is enforced. `npm run typecheck` must pass.
- **SolidJS patterns** only in the renderer. Use `createSignal`, `createStore`, and `createMemo` for reactivity. Do not import React or Vue patterns.
- **CSS Modules** (`*.module.css`) with global class names so the rendered DOM matches the original design. No per-component magic numbers; use the design-token system.
- **No hardcoded user-facing strings** in `.tsx` files. Every string goes through `src/renderer/i18n.ts` and the `t()` helper, with translations for all eight locales.
- **Framework-agnostic modules** for business logic that does not need reactivity (for example `src/renderer/processing/orchestrator.ts`).
- **Readable code over clever code.** Keep functions focused on a single responsibility. Add tests for new behavior.
- **Preserve backwards compatibility** when practical. Settings migrations seed sensible defaults for new fields.
- **Conventional Commits** for every commit (see below).

---

## Testing

Training Generator uses **Vitest** with `@solidjs/testing-library` and `happy-dom`. The suite contains 4,868 tests across 139 files with 100% coverage as the target.

```bash
npm test                # Full suite (4,868 tests)
npm run test:watch      # Watch mode
npm run test:coverage   # V8 coverage report
npm run typecheck       # tsc --noEmit (strict mode)
```

See the [Testing guide](testing/overview.md) for the full strategy, test layout, conventions, and how to add tests for a new feature.

::: tip Crucial tests
Test files suffixed `-crucial` cover the most load-bearing behavior of a module. Treat failures of these as release blockers.
:::

---

## Build and packaging

```bash
npm run build           # Build main + renderer → dist/ and dist-main/
npm run package         # Package for current platform → release/
npm run package:win     # Windows NSIS + portable
npm run package:mac     # macOS DMG + ZIP (Apple Silicon)
npm run package:linux   # Linux AppImage + DEB
```

Packaged installers are written to the `release/` directory. The build configuration lives in the `build` section of `package.json` and uses `electron-builder`.

The `extraResources` config bundles the `docs/` directory into the packaged app so the in-app documentation is available offline.

---

## Documentation

Documentation is built with **VitePress** and lives under `docs/`.

```bash
npm run docs:dev        # Start the docs dev server
npm run docs:build      # Build the static docs site
npm run docs:preview    # Preview the built site locally
```

When adding a new feature, update the relevant doc:

- New setting → `docs/configuration/settings-reference.md` (and the relevant section doc).
- New shortcut → `docs/keyboard-shortcuts.md`.
- New provider → `docs/providers/overview.md` and `docs/providers.md`.
- New output format → `docs/output/formats.md`.
- Architecture change → `docs/architecture.md` and `docs/architecture/overview.md`.
- Troubleshooting tip → `docs/troubleshooting/common-issues.md`.

The docs README (`docs/README.md`) is the entry point for the docs site.

---

## Conventional Commits

Every commit uses a Conventional Commits prefix:

| Prefix | Use for |
| --- | --- |
| `feat:` | A new feature. |
| `fix:` | A bug fix. |
| `docs:` | Documentation only changes. |
| `refactor:` | Code change that neither fixes a bug nor adds a feature. |
| `perf:` | Code change that improves performance. |
| `style:` | Formatting, whitespace, or semicolon changes. |
| `test:` | Adding or correcting tests. |
| `chore:` | Build, tooling, or dependency changes. |
| `ci:` | CI configuration changes. |

Commits should be small, atomic, and single-purpose. The v2.0.1 release follows a "many small commits" policy — one logical change per commit, no batch commits.

### Branch naming

- `feat/short-description`
- `fix/short-description`
- `docs/short-description`
- `ci/short-description`

---

## Releasing

Releases are tagged `v<version>` (for example `v2.0.1`) and built via GitHub Actions.

1. Bump `package.json` `version` and update `CHANGELOG.md`.
2. Tag the release: `git tag v2.0.1`.
3. The release workflow builds and publishes installers to GitHub Releases.
4. The release-drafter workflow maintains the release notes draft.

See [CHANGELOG.md](../CHANGELOG.md) for the per-release change history.

---

<!--
  Easter egg: the `npm run lint` and `npm run typecheck` scripts are aliased
  to the same `tsc --noEmit` command. Running both in sequence is a perfectly
  valid way to feel twice as confident before pushing.
-->

## Next steps

- [CONTRIBUTING.md](../CONTRIBUTING.md) — contribution workflow and PR checklist.
- [Architecture](architecture/overview.md) — main/renderer/worker split and data flow.
- [Testing](testing/overview.md) — test strategy and coverage.
- [Installation](getting-started/installation.md) — local setup details.
