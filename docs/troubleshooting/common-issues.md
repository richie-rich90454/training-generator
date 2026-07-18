---
title: Common Issues
description: Diagnose and resolve common problems with Ollama, file parsing, exports, and performance.
outline: [2, 3]
---

# Common Issues

This page covers the most frequent problems and how to resolve them. If your issue is not listed, collect the logs (see [Collecting logs](#collecting-logs)) and open a bug report.

## Ollama issues

### Ollama status shows "Offline" or "Error"

The status indicator is in the top-right of the app. If it is not green/online:

1. Make sure Ollama is installed (`ollama --version`).
2. Start the server manually:

   ```bash
   ollama serve
   ```

3. The app expects Ollama at `http://localhost:11434`. Do not change the port unless you also reconfigure the app.
4. Confirm no firewall or antivirus is blocking port `11434` on localhost.
5. Wait a few seconds — the app polls Ollama status every 30 seconds.

Verify the connection manually:

```bash
curl http://localhost:11434/api/tags
```

::: tip Windows port check
```bash
netstat -ano | findstr :11434
```
:::

### "Ollama is not running" toast when starting processing

Start Ollama, wait for the status indicator to turn green, then click **Process Files** again. Alternatively, click **Demo** to generate placeholder output without calling Ollama.

### Model dropdown is empty

1. Pull a model: `ollama pull <model-name>`.
2. Wait for the next status check or restart the app.
3. Select a model from the dropdown before processing.
4. For non-Latin output (`zh-Hans`/`zh-Hant`, `ja`, `ko`), ensure the model supports that script.

### Generation fails or times out

- Prompts are sent to `http://localhost:11434/api/generate` with a streaming response.
- Prompts larger than 10,000 characters use a 10-minute timeout; smaller prompts use 5 minutes.
- A single prompt cannot exceed 500,000 characters.
- On failure, the provider retries up to 3 times with exponential backoff; after repeated failures it is marked unhealthy.

::: warning Remediation
Try a smaller **Chunk Size**, reduce **Concurrency**, or use a smaller document. For cloud providers, also check your rate limit and billing status.
:::

## File parsing issues

### No text extracted from a PDF

If you see:

> No text could be extracted from PDF. The PDF might be scanned or image-based.

The app cannot OCR scanned or image-based PDFs. Workarounds:

- Use an OCR tool to convert the scanned PDF to text first.
- Convert the PDF to `.txt`, `.md`, or `.docx` and import that file.
- Use the file dialog (**Browse**) instead of drag & drop for better extraction.

### PDF parsing is slow or fails on large PDFs

- Files larger than 10 MB use streaming/large-file handling.
- PDFs larger than 5 MB are parsed in a worker thread with a 30-second timeout; on failure the app falls back to the main thread.
- Very large PDFs may exceed memory limits — split the PDF or convert it to text first.

### "Unsupported file format"

Supported formats: PDF, DOCX, DOC, RTF, TXT, MD, HTML. The maximum allowed file size is 100 MB per file. Convert other formats to one of the supported types before importing.

### DOC / RTF / HTML extraction looks wrong

The app extracts plain text from these formats. Complex formatting, embedded objects, or unusual encodings may be stripped. Convert the document to plain text or Markdown for cleaner extraction.

## Export and clipboard issues

### "No data to export" / export button is disabled

Export actions are available only after at least one file has been processed successfully. Process your files first, then export or copy.

### Export dialog cancels or save fails

- Choose a folder where you have write permission.
- Outputs exceeding 100,000 items are split into multiple files (`training_data-1.jsonl`, `training_data-2.jsonl`, …); you are prompted for each part.
- Cancelling the save dialog stops the export with an "Export cancelled" message.

### Copy to clipboard fails

Copying uses the system clipboard. It can fail when there is no output data, the content is extremely large for the clipboard, or another program locked the clipboard. Export to a file instead.

### Output format looks different than expected

| Format | Description |
| --- | --- |
| JSONL | One JSON object per line (default) |
| JSON | A single pretty-printed JSON array |
| CSV | `instruction,input,output` columns |
| Text | Plain text of each item's output |
| ChatML | Messages array (`[{role, content}, ...]`) |

The **Export** dropdown determines how the output is saved or copied. See [Output Formats](/output/formats.md).

### Per-file export writes fewer files than I uploaded (v2.0.1)

In per-file mode (`outputFileMode: 'perFile'`), sources that produced **zero training items** are skipped with a warning rather than written as empty files. This is intentional. If you expected items from a source:

- Check the processing log for that file — parsing may have extracted no text (see [No text extracted from a PDF](#no-text-extracted-from-a-pdf)) or every chunk may have failed.
- Re-run with **Concurrency** lowered and a smaller **Chunk Size** if the model timed out.
- Switch to `combined` mode to confirm the items exist at all.

### Per-file filenames do not match my template

The `outputFilenameTemplate` setting supports five placeholders: `{source}`, `{format}`, `{date}`, `{timestamp}`, `{index}`. If a literal shows up in the filename instead of a substituted value:

- Confirm the placeholder spelling and casing — placeholders are case-sensitive and must use lowercase (`{source}`, not `{Source}`).
- Unknown placeholders (including format specifiers like `{index:02d}`) are left in the filename verbatim by design so you can spot typos. There is no zero-padding support; pre-pad the source filename itself if you need it.
- `{index}` is the 1-based queue position of the source file (the third source file gets `3`), not a part number. When a single source is split into numbered parts because it exceeds `maxItemsPerFile`, the part suffix `-1`, `-2`, … is appended after the template is expanded.
- Unsafe path characters in the source filename (`/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`, and the NUL byte) are sanitized to `_` before substitution.

See [Output Mode](/configuration/output-mode.md) for the full template reference.

### Copy to clipboard ignores per-file mode

Copy always uses combined mode regardless of `outputFileMode`. Per-file mode only affects **Export to file**. To copy a single source's items, switch to `combined` mode or filter the preview before copying.

## Performance and crashes

### Processing is very slow

- Large files and high concurrency increase memory and CPU usage.
- The app automatically throttles concurrency when JavaScript heap usage exceeds 80%.
- Lower **Max Parallel Files** and **Concurrency** in Settings.
- Close other heavy applications while processing.

### App becomes unresponsive

- Very large prompts or many parallel files can overwhelm the renderer — reduce chunk size and concurrency.
- If the window freezes, wait briefly; the renderer may recover after the current batch finishes.

::: tip GPU acceleration
Ensure Ollama is using GPU acceleration. CPU-only inference is dramatically slower for large documents. Close other GPU-intensive applications.
:::

## Collecting logs

Logs are the fastest way to diagnose a problem.

### Log file location

| OS | Path |
| --- | --- |
| Windows | `%USERPROFILE%\Documents\TrainingGenerator\logs\` |
| macOS | `~/Documents/TrainingGenerator/logs/` |
| Linux | `~/Documents/TrainingGenerator/logs/` |

Files are named `app-0.log` … `app-4.log`. Up to 5 files are kept and each is limited to roughly 1 MB.

### In-app processing log

The **Processing Log** panel on the right shows the most recent 50 messages. Older entries are removed from the UI but remain in the log files on disk.

### Debug mode

```bash
npm run dev -- --debug
```

## Reporting an issue

Use the GitHub issue templates:

- [Bug report](https://github.com/richie-rich90454/training-generator/issues/new?template=bug_report.md)
- [Feature request](https://github.com/richie-rich90454/training-generator/issues/new?template=feature_request.md)

Include in your report:

1. Training Generator version (from the app or GitHub releases).
2. Operating system and version.
3. Ollama version and the model you were using.
4. The steps that led to the problem.
5. The relevant log file (`app-0.log`).
6. If file-specific, the file type and approximate size. Do not attach sensitive documents.

::: danger Security
Redact API keys, personal information, and confidential file content from logs before sharing them.
:::

## Next steps

- [Installation](/getting-started/installation.md) — reinstall or update Ollama.
- [Providers](/providers/overview.md) — verify provider configuration.
- [Architecture](/architecture/overview.md) — understand where errors originate.
