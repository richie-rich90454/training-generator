---
title: Architecture
description: Electron main/renderer/worker architecture, IPC, and the processing pipeline.
outline: [2, 3]
---

# Architecture

Training Generator follows Electron's recommended multi-process architecture, with a SolidJS renderer, a secure preload bridge, and background web workers for CPU-intensive work.

```
┌─────────────────────────────────────────────────────────────────┐
│  Main process (Node.js) — src/main.ts                          │
│  • Window & lifecycle  • Filesystem  • Native dialogs          │
│  • IPC handlers         • Path validation  • Provider requests  │
└───────────────▲─────────────────────────────────┬──────────────┘
                │ contextBridge (preload.ts)      │
┌───────────────┴─────────────────────────────────▼──────────────┐
│  Renderer process (Chromium) — src/renderer/App.tsx            │
│  SolidJS UI  •  Stores  •  Orchestrator  •  Processor         │
│         │                              │                       │
│         │ spawns                       │ spawns                │
│         ▼                              ▼                       │
│  chunk.worker.ts               dedup.worker.ts                 │
└────────────────────────────────────────────────────────────────┘
```

## Process model

| Process | Entry point | Responsibility |
| --- | --- | --- |
| **Main** | `src/main.ts` | Window creation, native OS interaction, filesystem and network operations, IPC handlers. |
| **Renderer** | `src/renderer/App.tsx` | SolidJS UI, DOM events, orchestration of the training-data pipeline. |
| **Preload** | `src/preload.ts` | Bridges main ↔ renderer via `contextBridge`, exposing a tightly scoped `window.electronAPI`. |
| **Workers** | `src/renderer/workers/*.worker.ts` | CPU-heavy chunking and deduplication off the main thread. |

Context isolation is enabled and Node integration is disabled in the renderer. The main window uses a preload script for secure IPC.

## Inter-process communication

The preload script exposes methods such as `openFileDialog`, `parseFile`, `saveFile`, `generateWithOllama`, and `checkOllama`. Each maps to an `ipcMain.handle` channel registered in `src/main.ts`.

### IPC channel groups

| Group | Channels |
| --- | --- |
| Dialog & filesystem | `dialog:openFile`, `dialog:saveFile`, `file:read`, `file:save`, `file:parse`, `file:parseBatch` |
| LLM providers | `ollama:check`, `ollama:generate`, `ollama:generateStream`, `openai:generate` |
| Application state | `cache:load/save/clear`, `progress:load/save/clear`, `save-checkpoint`, `load-checkpoint`, `clear-checkpoint` |
| Diagnostics | `write-log`, `export-logs`, `app:getVersion`, `app:getPlatform` |

::: tip Path safety
The main process validates all paths before reading or writing to prevent directory traversal. Parse operations are restricted to files under the user's home directory; writes are limited to standard user directories (Documents, Downloads, Desktop, Home).
:::

## Frontend architecture

The renderer is built with **SolidJS** fine-grained reactivity (`createSignal`, `createStore`, `createMemo`) — no virtual DOM. State lives in framework-agnostic stores under `src/renderer/stores/`:

| Store | Owns |
| --- | --- |
| `appStore.ts` | Application orchestration |
| `fileStore.ts` | File list, drag-and-drop, validation, per-file status |
| `outputStore.ts` | Generated items, output parsing, export |
| `settingsStore.ts` | Settings persistence |
| `uiStore.ts` | UI state, logs, toasts, modals |

The orchestrator (`src/renderer/processing/orchestrator.ts`) decouples file reading, chunking, and processing logic from components. CSS is plain vanilla CSS with module scoping configured globally to preserve existing class names.

## Key modules

### File parsing

`src/core/fileParserLazy.ts` (`FileParserLazy`) is the main-process parser. The renderer calls `parseFile` (single) or `parseFilesBatch` (multiple). PDFs dropped into the browser fall back to a renderer-side extraction in the orchestrator if the main-process parser fails.

### Chunking

`src/renderer/chunker.ts` provides two strategies:

- **`semanticChunk`** — splits at sentence boundaries, preserves code blocks, tables, lists, and fenced blocks. Smart sizing based on density. Adds a context prefix from the previous chunk.
- **`simpleChunk`** — faster fixed-size split with boundary detection. Used as a fallback.

Both can run in web workers via `src/renderer/workers/workerPool.ts`.

### Processing

`src/renderer/processor.ts` drives LLM generation:

- Manages an `AbortController` for cancellation
- Tracks statistics via `StatsTracker`
- Caches results through `src/renderer/cache.ts` (SQLite-backed)
- Supports a demo mode that returns synthetic responses without calling a model
- Batches small chunks for non-Ollama providers
- Runs chunks with a configurable concurrency limit
- Tags items with provenance metadata

Generation is delegated to a provider object from `src/renderer/provider.ts` (Ollama, OpenAI, Anthropic, Gemini).

### Deduplication

`src/renderer/deduplicator.ts` hashes item text with simhash, compares Hamming distances, filters pairs by length ratio and script detection, then applies the similarity threshold. Provenance from removed items merges into the kept item.

### Output

`src/renderer/stores/outputStore.ts` parses Q&A pairs and conversation turns, normalizes items into the selected format (Alpaca, ChatML, text, CSV), and handles export with automatic multi-file splitting. In v2.0.1, `exportOutput` branches on the `outputFileMode` setting: `combined` writes all items to one file (or threshold-split parts), while `perFile` groups items by `sourceFile` metadata and writes one file per source using the configured filename template. See [Output Mode](/configuration/output-mode.md).

## Data flow

1. **Selection** — `fileStore` validates and adds files.
2. **Parse** — paths → main process; browser blobs → renderer; PDFs fall back to browser extraction.
3. **Chunk** — semantic chunking, fallback to simple; may run in a worker.
4. **Generate** — `Processor.processChunks` sends prompts (from `PromptManager`) per chunk; results cached and tagged with provenance.
5. **Format** — `outputStore.createTrainingItem` parses and normalizes into the selected output format.
6. **Deduplicate** — simhash near-duplicate removal with provenance merging.
7. **Preview & export** — UI preview, then copy or export via the main process.

Throughout, `Logger` and `AuditTrail` record events, `Dashboard` shows live progress, and periodic checkpoints (every 30s) enable recovery.

## Observability & resilience

| Concern | Module |
| --- | --- |
| Structured logging | `src/renderer/logger.ts` |
| Audit trail | `src/renderer/audit.ts` |
| Provenance tracking | `src/renderer/provenance.ts` |
| Live dashboard | `src/renderer/dashboard.ts` |
| Auto-save checkpoints | `src/renderer/checkpoint.ts` |
| Quality validation | `src/renderer/qualityValidator.ts` |
| Rate limiting & backoff | `src/renderer/rateLimiter.ts` |
| Caching | `src/renderer/cache.ts` (SQLite) |
| Security | `src/renderer/security.ts` (AES-256-GCM, input sanitization) |

## Next steps

- [Processing Overview](/processing/overview.md) — pipeline stages in detail.
- [Testing](/testing/overview.md) — test strategy and coverage.
- [Troubleshooting](/troubleshooting/common-issues.md) — diagnosing runtime issues.
