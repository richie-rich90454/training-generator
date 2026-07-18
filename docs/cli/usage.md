---
title: CLI Usage
description: Run Training Generator headlessly to batch-process directories from the command line.
outline: [2, 3]
---

# CLI Usage

Training Generator ships a headless CLI for batch-processing files without launching the GUI. It is powered by the same parser, chunker, processor, and deduplicator used by the desktop app.

## Run the CLI

```bash
npm run cli -- [options]
```

The `cli` script executes `tsx src/cli/index.ts`, so no build step is required.

::: tip Passing arguments
When using `npm run`, separate npm flags from script arguments with `--`. Everything after `--` is forwarded to the CLI.
:::

## Minimal example

Process every supported file in a directory and write the result as JSONL:

```bash
npm run cli -- \
  --input ./examples \
  --output ./output/training_data.jsonl \
  --model llama3.2 \
  --type instruction
```

## Flags

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--input` | path | _(required)_ | Directory of source documents. |
| `--output` | path | _(required)_ | Output file path. Format is inferred from the extension. |
| `--type` | enum | `instruction` | Processing type: `instruction`, `conversation`, `chunking`, `custom`. |
| `--model` | string | `llama3` | Model name (Ollama model or cloud model identifier). |
| `--provider` | enum | `ollama` | Provider: `ollama`, `openai`, `anthropic`, `gemini`. |
| `--config` | path | — | Path to a JSON config file. CLI flags override file values. |
| `--chunk-size` | int | `8000` | Characters per chunk. |
| `--concurrency` | int | `3` | Parallel chunk requests per file. |
| `--proxy` | url | — | Outbound proxy URL (e.g. `http://user:pass@host:port`). |

::: warning Required flags
`--input` and `--output` are required. The CLI exits with a non-zero status if either is missing or if the input directory does not exist or contains no supported files.
:::

## Config file

Pass a JSON file with `--config` to define reusable settings. CLI flags override file values when both are present.

```json
{
  "input": "./examples",
  "output": "./output/training_data.jsonl",
  "type": "instruction",
  "model": "llama3.2",
  "provider": "ollama",
  "chunkSize": 4000,
  "concurrency": 4,
  "proxy": null
}
```

```bash
npm run cli -- --config ./configs/english-qa.json
```

## Output format selection

The output writer is chosen from the `--output` file extension:

| Extension | Writer |
| --- | --- |
| `.jsonl` | `exportJSONL` — one JSON object per line |
| `.json` | `exportJSONArray` — pretty-printed JSON array |
| `.csv` | `exportCSV` — `instruction,input,output` columns |
| other (`.txt`, etc.) | defaults to JSONL |

See [Output Formats](/output/formats.md) for the shape of each format.

## Supported input formats

The CLI processes files with these extensions in the input directory:

```
.pdf .docx .doc .rtf .txt .md .html .htm
```

All other files are ignored. If no supported files are found, the CLI exits with an error.

## Pipeline behavior

For each file in the input directory, the CLI:

1. Parses the document with `FileParser` (main-process parser, runs under Node in CLI mode).
2. Chunks the text with `semanticChunk` (falls back to `simpleChunk` if semantic returns nothing).
3. Generates one response per chunk via the active provider, honoring `--concurrency`.
4. Parses Q&A pairs or conversation turns from the response.
5. Deduplicates items with simhash (merging provenance).
6. Aggregates results across all files and writes the output.

::: warning v2.0.1 output mode
The CLI always runs in **combined** mode and writes a single file at the path passed to `--output`. The `outputFileMode`, `outputFilenameTemplate`, and `maxItemsPerFile` settings from the desktop Settings modal are **not** exposed as CLI flags. If you need per-file exports, run the desktop app or post-process the combined output. See [Output Mode](/configuration/output-mode.md#cli-behavior).
:::

Progress is written to stdout; the final summary is written to stderr so you can redirect the output file cleanly:

```
[1/5] Processing: sample-report.docx
  Chunked into 12 chunks
  Processing chunk 12/12...
  Generated 47 training items

=== Processing Complete ===
Total items generated: 213
Total chunks: 48
Successful: 48
Failed: 0
Success rate: 100%
Prompt tokens: 91,205
Response tokens: 38,410
Time elapsed: 142.3s
Output written to: /abs/path/to/output/training_data.jsonl
```

## Proxy support

Use `--proxy` to route requests through an HTTP/HTTPS proxy (useful for corporate networks):

```bash
npm run cli -- \
  --input ./examples \
  --output ./output/data.jsonl \
  --provider openai \
  --model gpt-4o-mini \
  --proxy http://user:pass@proxy.example.com:8080
```

`ProxyManager` parses the URL and applies the proxy to outbound provider requests.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Processing completed successfully. |
| `1` | Fatal error — missing required flags, bad input path, config parse failure, or an unrecovered processing error. |

## Next steps

- [Output Formats](/output/formats.md) — JSONL, ChatML, CSV, JSON, text.
- [Providers](/providers/overview.md) — switching providers for the CLI.
- [Installation](/getting-started/installation.md) — installing Ollama and models.
