---
title: Output Settings
description: Choose output formats, languages, item limits, and export behavior.
outline: [2, 3]
---

# Output Settings

Output settings determine how generated training items are structured, formatted, and exported. For model and processing tuning, see [Model Settings](/configuration/model-settings.md).

## Processing Type

- **Control**: `processing-type` dropdown
- **Options**: `instruction`, `conversation`, `chunking`, `custom`

Selects the prompt template applied to each chunk and the structure of the generated items.

| Type | Produces | Best for |
| --- | --- | --- |
| `instruction` | Question/answer pairs (Alpaca-style) | General fine-tuning, instruction tuning |
| `conversation` | Multi-turn User/Assistant dialog | Chat-tuned models |
| `chunking` | A detailed summary per chunk | Retrieval-augmented context |
| `custom` | Structured extraction from a custom template | Specialized extraction workflows |

See [Processing Overview](/processing/overview.md) for details on each type.

## Output Format

- **Control**: `output-format` dropdown
- **Options**: `jsonl`, `chatml`, `text`, `csv`

The serialization format for the exported file. A full description with examples is in [Output Formats](/output/formats.md).

| Format | Use case |
| --- | --- |
| `jsonl` | Default for training pipelines (Alpaca) |
| `chatml` | Chat-tuned models using a messages array |
| `text` | Quick inspection / plain text corpora |
| `csv` | Spreadsheets and tabular tooling |

::: tip JSON export
The export menu also offers a pretty-printed JSON array option (`.json`) when exporting via the save dialog, in addition to JSONL.
:::

## Output Language

- **Control**: `language-select` dropdown
- **Options**: `en`, `zh-Hans`, `zh-Hant`, `es`, `fr`, `de`, `ja`, `ko`

The language used in generated prompts and the final output. The app loads the matching prompt template from `src/prompts/<lang>_<type>.txt` (32 templates total: 8 languages × 4 processing types).

::: warning Match language to model
Generate output in a language the selected model supports well. Non-Latin scripts (`zh-Hans`, `zh-Hant`, `ja`, `ko`) require multilingual models such as `qwen2.5` or `aya`.
:::

The UI language itself is configurable separately in the Settings modal under **UI Language** and covers the full interface.

## Max Output Items per File

- **Control**: `max-output-items` dropdown (Settings modal)
- **Options**: `0` (unlimited), `10,000`, `50,000`, `100,000`, `500,000`, `1,000,000`
- **Default**: `100,000`

Caps how many training items a single file can produce.

## Export Behavior

### Automatic file splitting

When an export exceeds `100,000` items, the output is split across multiple files:

```
training_data-1.jsonl
training_data-2.jsonl
training_data-3.jsonl
...
```

You will be prompted for a save location for each part.

### Export actions

Available once at least one file has been processed successfully:

- **Copy to clipboard** — copies the generated output using the selected format.
- **Export to file** — opens a save dialog and writes the output via the main process.

::: danger Permissions
Choose a folder where you have write permission. Cancelling the save dialog stops the export with an "Export cancelled" message.
:::

## Provenance & Quality

Every generated item is tagged with provenance metadata that records its source file and chunk. The quality validator scores generated items and the deduplicator removes near-duplicates (simhash + length ratio). These run automatically; provenance from removed items is merged into the kept item.

## Quick reference

| Setting | Default | Options |
| --- | --- | --- |
| Processing Type | `instruction` | `instruction`, `conversation`, `chunking`, `custom` |
| Output Format | `jsonl` | `jsonl`, `chatml`, `text`, `csv` (+ JSON on export) |
| Output Language | `en` | `en`, `zh-Hans`, `zh-Hant`, `es`, `fr`, `de`, `ja`, `ko` |
| Max Output Items | `100,000` | unlimited – `1,000,000` |
