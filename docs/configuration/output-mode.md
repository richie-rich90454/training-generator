---
title: Output Mode
description: Choose between a single combined export file or one export file per source document.
outline: [2, 3]
---

# Output Mode

Introduced in v2.0.1, the **output mode** setting controls how generated training items are grouped when you export. You can choose between:

- **`combined`** (default) — every item from every file in the work queue is merged into a single export file. This is the v2.0.0 behavior.
- **`perFile`** — each input file in the work queue produces its own export file, named after the source file, containing only the items generated from that file.

The setting is two-way bound to `settingsStore` and takes effect immediately — no restart is required.

::: tip When to use which
Use `combined` when you want a single dataset for a downstream training pipeline. Use `perFile` when you want to keep the lineage between a source document and its generated items, audit per-source quality, or reprocess a single source without touching the others.
:::

---

## Where to set it

| Location | Control | Notes |
| --- | --- | --- |
| Configuration panel | `output-file-mode` radio | Quick toggle during a run. |
| Settings modal — Export section | `outputFileMode` select | Persists across restarts. |

Both controls read and write the same `outputFileMode` field on `AppSettings`, so changing one updates the other.

---

## How it works

`outputStore.exportOutput` branches on the current `outputFileMode` value. The two paths are described below.

### Combined mode

1. All generated items (from `outputData` and `stagingData`) are concatenated.
2. If the total exceeds the split threshold (100,000 items by default), the output is split into multiple parts (`training_data-1.jsonl`, `training_data-2.jsonl`, …). You are prompted for the first save location; subsequent parts are written next to it.
3. Otherwise, a single save dialog appears and one file is written.

This path is unchanged from v2.0.0.

### Per-file mode

1. Items are grouped by their `sourceFile` metadata. Every `TrainingItem` produced in v2.0.1 carries a `sourceFile` field (the originating input file path or name) so grouping is deterministic.
2. You pick a destination directory once via the directory chooser.
3. For each source group:
   - The filename is derived from the configured **filename template**.
   - If the group exceeds `maxItemsPerFile` items, it is split into parts with a `-1`, `-2`, … suffix.
   - The configured export format is applied (JSONL, ChatML, CSV, JSON, or text).
   - Source metadata is stripped from each item unless `includeSourceMetadata` is enabled.
4. Sources that produced zero items are skipped. A warning is logged and surfaced to the user, so no empty files are written.

```text
Work queue: [a.pdf, b.docx, c.txt]
                 │      │       │
                 ▼      ▼       ▼
            a.jsonl  b.jsonl  c.jsonl   ← perFile mode
                 └──────┴───────┘
                        │
                        ▼
              training_data.jsonl        ← combined mode
```

---

## Filename template

The `outputFilenameTemplate` setting controls the basename of each per-file export. The default is `{source}`.

| Placeholder | Replaced with | Example |
| --- | --- | --- |
| `{source}` | Source file stem (extension stripped) | `report` from `report.pdf` |
| `{format}` | Active export format | `jsonl`, `csv`, `text` |
| `{date}` | Current date as `YYYYMMDD` | `20260718` |
| `{timestamp}` | Unix milliseconds | `1784373128000` |
| `{index}` | 1-based queue position of the source file | `1`, `2`, `3` |

### Examples

| Template | Source | Resulting filename |
| --- | --- | --- |
| `{source}` | `report.pdf` → `report.jsonl` | `report.jsonl` |
| `{source}-{format}` | `notes.md` → `notes-jsonl.jsonl` | `notes-jsonl.jsonl` |
| `{date}-{source}` | `slides.pptx` on 2026-07-18 | `20260718-slides.jsonl` |
| `{index:02d}-{source}` (manual zero-pad) | `chapter1.txt` | `1-chapter1.jsonl` |

::: warning Sanitization
Characters that are invalid in filenames (`< > : " / \ | ? *` and the NUL byte) are replaced with `_`. An empty result after substitution falls back to `output`.
:::

---

## Splitting large per-file outputs

When a single source produces more items than `maxItemsPerFile` (default `50,000`), the per-source output is split into numbered parts:

```text
report-1.jsonl
report-2.jsonl
report-3.jsonl
```

This keeps individual files manageable and avoids memory pressure during export. The split threshold is independent of the 100,000-item threshold used in combined mode.

---

## Source metadata

Every `TrainingItem` carries metadata that records its origin:

| Field | Meaning |
| --- | --- |
| `sourceFile` | The originating input file path or name. |
| `sourceFileIndex` | 1-based queue position of the source file. |
| `generatedAt` | Unix milliseconds when the item was stamped. |

In `perFile` mode, `sourceFile` is always used for grouping but is **stripped** from the exported items unless `includeSourceMetadata` is `true`. In `combined` mode, the metadata is included only when `includeSourceMetadata` is `true`.

This means per-file mode is safe to use even when you do not want provenance leaking into the exported dataset — the grouping still works, the output just does not contain the `sourceFile` field.

---

## Empty sources

If a source file produced zero items (for example, the model returned no parseable Q&A pairs), per-file export skips it entirely. The app:

1. Logs a warning naming the skipped source.
2. Surfaces a toast to the user.
3. Does not write an empty file.

This prevents cluttering your output directory with empty `.jsonl` files.

---

## Interaction with other settings

| Setting | Effect on per-file mode |
| --- | --- |
| `maxItemsPerFile` | Splits each per-source output into numbered parts. |
| `includeSourceMetadata` | Controls whether `sourceFile`/`sourceFileIndex`/`generatedAt` appear in the exported items. Grouping always uses `sourceFile` internally. |
| `stripPiiBeforeExport` | Tags items for PII stripping by the exporter pipeline. |
| `confirmBeforeExport` | When enabled, shows a confirmation dialog before writing the per-file outputs. |
| `autoExportOnCompletion` | When enabled, triggers the active mode's export path automatically after a run completes. |
| `outputFilenameTemplate` | Controls the basename of each per-file export. |

---

## CLI behavior

The CLI infers its output behavior from the `--output` path. When you point `--output` at a directory and pass multiple input files, per-file semantics apply. See [CLI Usage](/cli/usage.md) for the flag reference.

---

## Scenarios

### User selects combined mode

- **Given** the work queue contains three files and `outputFileMode` is `combined`
- **When** the user clicks Export
- **Then** a single save dialog appears and one file (or threshold-split parts) is written containing all items.

### User selects per-file mode

- **Given** the work queue contains three files (`a.pdf`, `b.docx`, `c.txt`) and `outputFileMode` is `perFile`
- **When** the user clicks Export
- **Then** the user picks a destination directory and the app writes `a.jsonl`, `b.jsonl`, `c.jsonl` (one per source file), each containing only the items derived from that source.

### Per-file mode with no items for a file

- **Given** `outputFileMode` is `perFile` and one input file produced zero items
- **When** export runs
- **Then** no empty file is written for that source; a warning is logged and surfaced to the user.

### Setting persists across restarts

- **Given** the user sets `outputFileMode` to `perFile`
- **When** the app is restarted
- **Then** the setting is restored from persisted settings.

---

<!--
  Easter egg: the {index} placeholder is 1-based, not 0-based, on purpose.
  Zero-based queue positions offended the team's sense of natural numbering.
  Try {index}{source} with a single file for a delightfully redundant filename
  like "1report.jsonl".
-->

## Next steps

- [Settings Reference](/configuration/settings-reference.md) — every setting field, type, default, and version.
- [Output Formats](/output/formats.md) — JSONL, ChatML, CSV, JSON, and text.
- [Output Settings](/configuration/output-settings.md) — format and language selection.
- [Architecture](/architecture/overview.md) — how `outputStore` fits into the pipeline.
