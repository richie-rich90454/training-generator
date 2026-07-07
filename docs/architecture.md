# Training Generator Architecture

This document describes the high-level architecture of Training Generator, an Electron desktop application that converts documents into AI training data.

## Process Model

Training Generator follows Electron's recommended multi-process architecture:

- **Main process** (`src/main.ts`) runs Node.js and is the entry point of the application. It creates the renderer window, manages native OS interactions, and performs filesystem and network operations.
- **Renderer process** (`src/renderer/App.tsx` and supporting modules) runs the user interface inside a Chromium sandbox. It is built with SolidJS and handles all DOM interactions, user events, and orchestration of the training-data pipeline.
- **Preload script** (`src/preload.ts`) bridges the two processes through Electron's `contextBridge`. It exposes a tightly controlled `window.electronAPI` surface to the renderer so the UI can invoke main-process capabilities without full Node.js access.

Context isolation is enabled, node integration is disabled in the renderer, and the main window uses a preload script for secure IPC.

## Inter-Process Communication

The preload script exposes methods such as `openFileDialog`, `parseFile`, `saveFile`, `generateWithOllama`, and `checkOllama`. Each method maps to a corresponding `ipcMain.handle` channel registered in `src/main.ts`.

Main-process IPC handlers fall into several groups:

- **Dialog and filesystem**: `dialog:openFile`, `dialog:saveFile`, `file:read`, `file:save`, `file:parse`, `file:parseBatch`
- **LLM providers**: `ollama:check`, `ollama:generate`, `ollama:generateStream`, `openai:generate`
- **Application state**: `cache:load/save/clear`, `progress:load/save/clear`, `save-checkpoint`, `load-checkpoint`, `clear-checkpoint`
- **Diagnostics**: `write-log`, `export-logs`, `app:getVersion`, `app:getPlatform`

The main process validates all paths before reading or writing to prevent directory traversal, restricts parse operations to files under the user's home directory, and limits write operations to standard user directories such as Documents, Downloads, Desktop, and Home.

## Key Modules

### File Management

`src/renderer/stores/fileStore.ts` owns the file list in the SolidJS UI. It handles drag-and-drop, the file input dialog, validation of supported formats (PDF, DOCX, DOC, RTF, TXT, MD, HTML), size limits, and per-file status tracking. Files are represented as `SelectedFile` objects that may contain either a browser `File` blob or a filesystem path.

### File Parsing

The main process parses documents through `FileParserLazy` (`src/core/fileParserLazy.ts`). The renderer can call `parseFile` for a single file or `parseFilesBatch` for multiple files. PDFs dropped into the browser may first be processed by a browser-side fallback in `src/renderer/processing/orchestrator.ts` if the main-process parser fails or no path is available.

### Chunking

`src/renderer/chunker.ts` provides two chunking strategies:

- `semanticChunk` splits text at sentence boundaries while preserving semantic units such as code blocks, tables, lists, and fenced blocks. It supports smart sizing based on text density and adds a small context prefix from the previous chunk.
- `simpleChunk` performs a faster fixed-size split with boundary detection at whitespace, sentence endings, or semantic unit edges.

Chunking can be offloaded to web workers via `src/renderer/workers/workerPool.ts` to keep the UI responsive.

### Processing

`src/renderer/processor.ts` drives the LLM generation phase. It:

- Manages an `AbortController` for cancellation
- Tracks statistics with `StatsTracker`
- Caches results through `src/renderer/cache.ts`
- Supports a demo mode that returns synthetic responses without calling a model
- Batches small chunks when a non-Ollama provider is selected
- Runs chunks with a configurable concurrency limit
- Tags items with provenance metadata

The actual generation is delegated to a provider object created by `src/renderer/provider.ts`, which currently supports Ollama and OpenAI-compatible endpoints.

### Deduplication

`src/renderer/deduplicator.ts` removes near-duplicate training items. It hashes item text, compares Hamming distances between hashes, and filters pairs by length ratio and script detection before applying the similarity threshold. Provenance from removed items is merged into the kept item.

### Output Management

`src/renderer/stores/outputStore.ts` converts LLM responses into structured training items. It parses question/answer pairs and conversation turns, then formats items according to the selected output format:

- Alpaca-style (`instruction`, `input`, `output`)
- ChatML (`messages` array)
- Plain text
- CSV (`input`, `output`)

It also handles exporting to JSONL, JSON, CSV, or TXT and splits large outputs into multiple files when a threshold is exceeded.

## Data Flow

The following steps describe the journey from file selection to exported training data:

1. **Selection**  
   The user selects files through drag-and-drop or the file dialog. `fileStore` validates format and size, then adds the files to `selectedFiles` and renders the list.

2. **Pre-loading and parsing**  
   When processing starts, `App.tsx` orchestrates reading each file in parallel through `src/renderer/processing/orchestrator.ts`. Filesystem paths are sent to the main process via `parseFile`, while browser `File` objects are read directly in the renderer. PDFs fall back to browser extraction if main-process parsing is unavailable.

3. **Chunking**  
   Each file's extracted text is split into chunks. The default is semantic chunking with a configurable target size; if semantic chunking returns no chunks, simple chunking is used. This step may run in a web worker.

4. **Generation**  
   `Processor.processChunks` sends each chunk to the active provider. Prompts are generated from templates loaded by `PromptManager` in the user's selected language. Results are cached and tagged with provenance.

5. **Parsing and formatting**  
   LLM responses are parsed into Q&A pairs or conversation turns by `outputStore.createTrainingItem`, then normalized into the user's chosen output format.

6. **Deduplication**  
   Items from each file are deduplicated using `dedupInWorker` (or `deduplicate` directly), merging provenance for removed duplicates.

7. **Preview and export**  
   The aggregated results are displayed in the UI preview. The user can copy the output to the clipboard or export it through a save dialog back to the main process.

Throughout the pipeline, `Logger` and `AuditTrail` record events, `Dashboard` shows live progress, and periodic checkpoints allow recovery if processing is interrupted. All user-facing strings are centralized in `src/renderer/i18n.ts` and translated into eight languages; the `t()` helper is used by renderer modules, SolidJS components, exporters, and the splash screen so that no hardcoded English text remains in the UI.
