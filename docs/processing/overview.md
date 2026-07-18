---
title: Processing Overview
description: How documents flow through the pipeline — instruction, conversation, chunking, and custom processing types.
outline: [2, 3]
---

# Processing Overview

Training Generator converts raw document text into structured training data through a four-stage pipeline: **parse → chunk → generate → deduplicate**. The **processing type** controls the prompt template and the structure of the generated items.

## Pipeline stages

```
File selection ─► Parse ─► Semantic chunk ─► Generate (LLM) ─► Parse output ─► Deduplicate ─► Preview / Export
```

1. **Selection** — `fileStore` validates format and size; files become `SelectedFile` objects holding either a browser `File` blob or a filesystem path.
2. **Parsing** — Filesystem paths are sent to the main process via `parseFile`/`parseFilesBatch`; browser blobs are read in the renderer. PDFs fall back to browser extraction if main-process parsing is unavailable.
3. **Chunking** — `src/renderer/chunker.ts` splits text at sentence boundaries while preserving code blocks, tables, and lists. Falls back to fixed-size chunking if semantic chunking returns nothing. Runs in a web worker.
4. **Generation** — `src/renderer/processor.ts` sends one prompt per chunk to the active provider, with an `AbortController`, caching, statistics, and provenance tagging.
5. **Output parsing** — `outputStore.createTrainingItem` parses Q&A pairs or conversation turns from the LLM response and normalizes them into the selected format.
6. **Deduplication** — simhash-based near-duplicate removal; provenance from removed items is merged into the kept item.
7. **Preview & export** — results render in the preview, then are copied or exported via the main process.

Throughout the pipeline, `Logger` and `AuditTrail` record events, `Dashboard` shows live progress, and checkpoints (every 30s) enable recovery.

## Chunking strategies

`src/renderer/chunker.ts` exposes two strategies:

### Semantic chunking (default)

`semanticChunk(text, targetSize, overlap, smartSizing)` splits at sentence boundaries and preserves semantic units:

- Code blocks (fenced ``` ``` ```)
- Tables
- Lists
- Paragraphs

It adds a small **context prefix** from the previous chunk so generations maintain continuity across boundaries. When **Smart Sizing** is enabled, boundaries adapt to content density instead of strictly enforcing the character limit.

### Simple chunking (fallback)

`simpleChunk(text, size)` performs a faster fixed-size split with boundary detection at whitespace, sentence endings, or semantic unit edges. Used automatically when semantic chunking returns no chunks.

::: tip Worker offloading
Both strategies can run in a web worker via `src/renderer/workers/workerPool.ts` to keep the UI responsive during large jobs.
:::

## Processing types

### Instruction

Generates question/answer pairs for instruction tuning (Alpaca-style). The prompt asks the model to exhaustively extract facts, concepts, relationships, examples, statistics, and definitions — one Q&A per important point, with thorough answers.

Output items:

```json
{
  "instruction": "Answer the question based on the text",
  "input": "What is semantic chunking?",
  "output": "Semantic chunking splits text at sentence boundaries…"
}
```

### Conversation

Generates multi-turn User/Assistant dialogs covering every main topic and key detail. Each exchange should be thorough and detailed.

Output items (before formatting to ChatML):

```json
{
  "instruction": "Respond to the user's message",
  "input": "<user turn>",
  "output": "<assistant turn>"
}
```

### Chunking

Produces a comprehensive summary of each chunk, preserving all key points, arguments, data, examples, and conclusions. Useful for retrieval-augmented generation (RAG) context datasets.

### Custom

Uses the user-defined prompt template from the **Template Editor** for structured extraction. Build a template that extracts specific fields, key concepts, procedures, or comparisons.

::: tip Template editor
Open the Template Editor to author and save custom prompt templates. Templates can reference `{{text}}` for the chunk content.
:::

## Prompts & languages

Prompt templates live in `src/prompts/<lang>_<type>.txt` — 32 files covering 8 languages × 4 processing types. `PromptManager` loads the template matching the selected output language, falling back to English if a localized template is missing.

Each prompt enforces:

- Same language as the source text
- Answers based exclusively on the text
- Thorough, complete answers
- No upper limit on item count

## Deduplication

`src/renderer/deduplicator.ts` removes near-duplicate items:

1. Hashes each item's text with **simhash**.
2. Compares Hamming distances between hashes.
3. Filters candidate pairs by **length ratio** and **script detection** before applying the similarity threshold.
4. Merges provenance from removed items into the kept item so lineage is preserved.

## Statistics & provenance

`StatsTracker` records per-run metrics: total chunks, successes, failures, success rate, prompt tokens, response tokens, and elapsed time. The dashboard surfaces these live.

Each item carries **provenance** metadata recording its source file and chunk index, enabling traceability from generated output back to the source document. As of v2.0.1, the `TrainingItem` metadata object exposes three fields: `sourceFile` (the originating file name), `sourceFileIndex` (its position in the input batch), and `generatedAt` (an ISO timestamp). These power per-file export grouping, the Analytics dashboard, and the optional `includeSourceMetadata` export flag (see [Output Mode](/configuration/output-mode.md)).

## Next steps

- [Output Formats](/output/formats.md) — JSONL, ChatML, CSV, text.
- [Model Settings](/configuration/model-settings.md) — tune chunk size and concurrency.
- [Architecture](/architecture/overview.md) — main/renderer/worker split.
