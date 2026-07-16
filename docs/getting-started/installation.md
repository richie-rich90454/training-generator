---
title: Installation
description: Install prerequisites, clone the repository, and run Training Generator in development or production.
outline: [2, 3]
---

# Installation

This guide walks through everything required to install Training Generator from source and run it in development or production mode.

## Prerequisites

Training Generator is an Electron desktop application built with TypeScript and SolidJS. Before installing, make sure your machine meets the following requirements.

| Requirement | Minimum | Recommended | Notes |
| --- | --- | --- | --- |
| Node.js | 18+ | 24+ | Required for the build toolchain and CLI. |
| npm | 9+ | 10+ | Ships with Node.js. |
| Ollama | — | latest | Required for local AI processing. [Download](https://ollama.com/) |
| Git | any | latest | Required to clone the repository. |
| OS | Windows 10+, macOS 12+, or Linux | — | Cross-platform Electron build. |

::: tip GPU acceleration
For the best local performance, install Ollama with GPU support enabled. CPU-only inference works but is significantly slower for large documents.
:::

### Install Node.js

Download the LTS installer for your platform from [nodejs.org](https://nodejs.org/) or use a version manager:

```bash
# Using nvm (macOS / Linux)
nvm install --lts
nvm use --lts

# Using fnm (cross-platform)
fnm install --lts
fnm use lts-latest
```

Verify the installation:

```bash
node --version
npm --version
```

### Install Ollama

Ollama is the default local AI provider. Install it from [ollama.com](https://ollama.com/) and verify:

```bash
ollama --version
```

## Clone the repository

```bash
git clone https://github.com/richie-rich90454/training-generator.git
cd training-generator
```

## Install dependencies

```bash
npm install
```

::: warning Native modules
The build uses `better-sqlite3` and PDF parsing libraries that compile native bindings. If installation fails, ensure you have the platform build tools installed:

- **Windows**: `npm install --global windows-build-tools` or Visual Studio Build Tools with the "Desktop development with C++" workload.
- **macOS**: `xcode-select --install`
- **Linux**: `build-essential`, `python3`, and `make` / `g++`.
:::

A `postinstall` script (`scripts/postinstall.mjs`) runs automatically to verify native dependencies.

## Pull a model

Before running the app, pull at least one Ollama model so the model dropdown is populated:

```bash
ollama pull llama3.2
```

See [Providers](/providers/overview.md) for model recommendations and cloud-provider setup.

## Development commands

Start the Ollama server in a separate terminal, then launch the app in development mode with hot reload:

```bash
# Terminal 1 — start the local model server
ollama serve

# Terminal 2 — run the app with hot reload (Vite dev server + Electron)
npm run dev
```

The development script (`scripts/dev.mjs`) runs Vite and Electron concurrently. The renderer hot-reloads on file changes; the main process restarts on changes to `src/main.ts`.

### Production mode

Run directly from TypeScript source without a build step:

```bash
npm start
```

`npm start` triggers `prestart` (which builds) and then launches Electron from the compiled output. Use this to validate a release-like configuration.

### Headless CLI mode

Process files from the command line without opening the GUI:

```bash
npm run cli -- --input ./examples --output ./output/data.jsonl --model llama3.2
```

See the [CLI guide](/cli/usage.md) for the full flag reference.

## Build and package

Build the application for distribution:

```bash
npm run build           # Build main + renderer
npm run package         # Package for current platform
npm run package:win     # Windows NSIS + portable
npm run package:mac     # macOS DMG + ZIP (Apple Silicon)
npm run package:linux   # Linux AppImage + DEB
```

Packaged installers are written to the `release/` directory.

## Type checking and tests

```bash
npm run typecheck       # tsc --noEmit (strict mode)
npm test                # Run the full test suite (3300+ tests)
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

## Next steps

- [Quick Start](/getting-started/quick-start.md) — generate your first dataset in five minutes.
- [Configuration](/configuration/model-settings.md) — tune model, provider, chunk size, and concurrency.
- [Providers](/providers/overview.md) — connect Ollama, OpenAI, Anthropic, or Gemini.
