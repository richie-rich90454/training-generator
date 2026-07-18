---
title: Quick Start
description: Generate your first AI training dataset in under five minutes.
outline: [2, 3]
---

# Quick Start

This guide takes you from a clean install to your first exported training dataset as quickly as possible.

## 1. Start Ollama

Training Generator uses Ollama as the default local provider. Start the server and pull a small, fast model:

```bash
ollama serve
ollama pull llama3.2
```

::: tip Verify the connection
The app expects Ollama at `http://localhost:11434`. Confirm it is reachable:

```bash
curl http://localhost:11434/api/tags
```
:::

## 2. Launch the app

```bash
npm run dev
```

When the window opens, the Ollama status indicator in the top-right should turn green within 30 seconds. If it stays offline, see [Common Issues](/troubleshooting/common-issues.md).

## 3. Add documents

Drag and drop one or more files onto the upload card, or click **Browse** to open the file dialog. Supported formats:

- PDF
- DOCX / DOC
- RTF
- TXT / MD
- HTML

::: warning Scanned PDFs
Image-based PDFs cannot be OCR'd by the built-in parser. Convert them to text or `.docx` first.
:::

## 4. Configure processing

In the right-hand configuration panel, set:

- **Ollama Model** — choose `llama3.2` (or whichever model you pulled).
- **Processing Type** — `Instruction` for Q&A pairs.
- **Output Format** — `JSONL` (Alpaca style) is the default.
- **Output Language** — match the dominant language of your documents.
- **Chunk Size** — leave at `2000` for typical articles; use `5000+` for long-form prose with a large-context model.
- **Temperature** — `0.7` balances variety and accuracy.

## 5. Process

Click **Process Files**. The dashboard shows live progress: chunks generated, requests in flight, successes, and failures. Chunking and deduplication run in web workers, so the UI stays responsive.

## 6. Preview and export

When processing completes, review the generated items in the output preview. Then either:

- **Copy to clipboard** for a quick paste, or
- **Export** to choose a save location. The output is written by the main process and split into multiple files (`training_data-1.jsonl`, `training_data-2.jsonl`, …) when it exceeds 100,000 items.

::: tip v2.0.1 per-file output
Switch **Output File Mode** to `perFile` in the Settings modal (Export section) to write one export per source file instead of a single combined dataset. You pick a destination directory once and each source becomes its own file. See [Output Mode](/configuration/output-mode.md) for the full guide.
:::

## Example output

A typical instruction-tuning item in JSONL format looks like this:

```json
{"instruction":"Answer the question based on the text","input":"What is semantic chunking?","output":"Semantic chunking splits text at sentence boundaries while preserving code blocks, tables, and lists, adding a small context prefix from the previous chunk."}
```

## Next steps

- [Model Settings](/configuration/model-settings.md) — tune temperature, concurrency, and chunk size.
- [Output Formats](/output/formats.md) — understand JSONL, ChatML, CSV, and plain text.
- [CLI Usage](/cli/usage.md) — automate batch processing from the command line.
