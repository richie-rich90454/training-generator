---
title: Output Formats
description: JSONL, ChatML, CSV, JSON, and plain-text export formats explained with examples.
outline: [2, 3]
---

# Output Formats

Training Generator can serialize generated training items into several formats. Select the format from the **Output Format** dropdown in the configuration panel; the export menu additionally offers a pretty-printed JSON array.

::: tip Choosing a format
`jsonl` is the most widely supported format for fine-tuning pipelines. Use `chatml` for chat-tuned models, `csv` for spreadsheets, and `text` for quick inspection.
:::

## JSONL (Alpaca) — default

One JSON object per line. This is the standard format for instruction-tuning datasets (Alpaca style).

```jsonl
{"instruction":"Answer the question based on the text","input":"What is semantic chunking?","output":"Semantic chunking splits text at sentence boundaries while preserving code blocks, tables, and lists."}
{"instruction":"Answer the question based on the text","input":"How does deduplication work?","output":"The deduplicator hashes item text with simhash and compares Hamming distances, filtering pairs by length ratio before applying the similarity threshold."}
```

Each line is independent, so the file can be streamed, concatenated, or split trivially.

## ChatML

A messages array using the OpenAI ChatML shape — `{ role, content }` per turn. Best for chat-tuned models.

```json
{"messages":[{"role":"user","content":"What is semantic chunking?"},{"role":"assistant","content":"Semantic chunking splits text at sentence boundaries…"}]}
```

When the processing type is `conversation`, multi-turn dialogs produce a single `messages` array with multiple user/assistant turns.

## CSV

Tabular output with `instruction`, `input`, and `output` columns. Convenient for spreadsheets, databases, or quick filtering.

```csv
instruction,input,output
"Answer the question based on the text","What is semantic chunking?","Semantic chunking splits text at sentence boundaries…"
"Answer the question based on the text","How does deduplication work?","The deduplicator hashes item text with simhash…"
```

## JSON (pretty-printed array)

A single JSON array, pretty-printed. Available from the **Export** save dialog by choosing a `.json` extension. Useful when you need a single self-describing file rather than a stream of lines.

```json
[
  {
    "instruction": "Answer the question based on the text",
    "input": "What is semantic chunking?",
    "output": "Semantic chunking splits text at sentence boundaries…"
  }
]
```

## Plain text

The `output` field of each item concatenated as plain text. Useful for corpora inspection or downstream text tooling that does not need structured fields.

```text
Semantic chunking splits text at sentence boundaries while preserving code blocks, tables, and lists.
The deduplicator hashes item text with simhash and compares Hamming distances…
```

## Format reference

| Format | Extension | Shape | Per-line | Best for |
| --- | --- | --- | --- | --- |
| JSONL | `.jsonl` | `{ instruction, input, output }` | Yes | Training pipelines (default) |
| ChatML | `.jsonl` / `.json` | `{ messages: [{ role, content }] }` | Yes (one doc per line) | Chat-tuned models |
| CSV | `.csv` | `instruction,input,output` rows | — | Spreadsheets, databases |
| JSON | `.json` | Array of items | No | Single self-describing file |
| Text | `.txt` | Plain `output` text | — | Inspection / text tooling |

## Large output splitting

When an export exceeds **100,000 items**, the output is automatically split into multiple files:

```
training_data-1.jsonl
training_data-2.jsonl
training_data-3.jsonl
```

You will be prompted for a save location for each part. The split threshold keeps individual files manageable and avoids memory pressure during export.

## CLI output selection

When running headlessly, the output format is inferred from the output file extension:

| Extension | Writer |
| --- | --- |
| `.jsonl` | `exportJSONL` |
| `.json` | `exportJSONArray` |
| `.csv` | `exportCSV` |
| other (`.txt`, etc.) | defaults to JSONL |

See [CLI Usage](/cli/usage.md) for the full flag reference.

## Next steps

- [Output Settings](/configuration/output-settings.md) — languages and item limits.
- [Processing Overview](/processing/overview.md) — how items are generated.
- [CLI Usage](/cli/usage.md) — batch export from the command line.
