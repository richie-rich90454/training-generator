# Troubleshooting

This guide covers common problems you may encounter while using Training Generator, plus how to collect the information needed to report an issue.

---

## Ollama issues

Training Generator uses a local Ollama instance for AI processing. If Ollama is not available, processing cannot start unless you enable **Demo mode**.

### Ollama status shows "Offline" or "Error"

The status indicator is in the top-right area of the app. If it is not green/online:

1. Make sure Ollama is installed.
2. Start the Ollama server:
   - Windows/macOS: open a terminal and run `ollama serve`.
   - Linux: the service is usually started automatically; otherwise run `ollama serve`.
3. The app expects Ollama at `http://localhost:11434`. Do not change the Ollama port unless you have also configured the app to match.
4. Check that a firewall or antivirus is not blocking port `11434` on localhost.
5. Wait a few seconds; the app checks Ollama status every 30 seconds.

You can verify the connection manually with:

```bash
curl http://localhost:11434/api/tags
```

If this command fails, the problem is outside the app and Ollama is not reachable yet.

### "Ollama is not running" toast when starting processing

This is the same as the status above. Start Ollama, wait for the status indicator to show online, then click **Process Files** again. Alternatively, click the **Demo** button to generate placeholder output without calling Ollama.

### Model dropdown is empty or model is not found

1. Pull the model you want to use:

   ```bash
   ollama pull <model-name>
   ```

2. After pulling, wait for the next automatic status check or restart the app.
3. Select a model from the dropdown before processing.
4. If you are generating output in a non-Latin language such as Chinese (`zh-Hans`/`zh-Hant`), Japanese (`ja`), or Korean (`ko`), make sure the model you pulled supports that script.

### Generation fails or times out

- The app sends prompts to `http://localhost:11434/api/generate` with a streaming response.
- Prompts larger than 10,000 characters use a 10-minute timeout; smaller prompts use 5 minutes.
- A single prompt cannot exceed 500,000 characters.
- If a generation fails, the provider retries up to 3 times with exponential backoff. After repeated failures it is marked unhealthy.
- Try a smaller **Chunk size** in Settings, reduce **Concurrency**, or use a smaller document.

---

## PDF and file parsing issues

### No text extracted from a PDF

Training Generator can extract text from most PDFs, but it cannot perform OCR on scanned or image-based PDFs. If you see an error such as:

> No text could be extracted from PDF. The PDF might be scanned or image-based.

try one of these workarounds:

- Use an OCR tool to convert the scanned PDF to text first.
- Convert the PDF to `.txt`, `.md`, or `.docx` and import that file instead.
- For better extraction, use the file dialog (**Browse**) instead of drag & drop.

### PDF parsing is slow or fails on large PDFs

- Files larger than 10 MB use streaming/large-file handling.
- PDFs larger than 5 MB are parsed in a worker thread with a 30-second timeout; if the worker fails, the app falls back to the main thread.
- Very large PDFs may exceed memory limits. Try splitting the PDF or converting it to text first.

### "Unsupported file format"

Supported formats are:

- PDF
- DOCX / DOC
- RTF
- TXT / MD
- HTML

If your file has a different extension, convert it to one of the supported formats first. The maximum allowed file size is 100 MB per file.

### DOC/RTF/HTML extraction looks wrong

The app extracts plain text from these formats. Complex formatting, embedded objects, or unusual encodings may be stripped. If extraction quality is poor, convert the document to plain text or Markdown before importing.

---

## Export and clipboard issues

### "No data to export" / export button is disabled

The export actions only become available after at least one file has been processed successfully. Process your files first, then try exporting or copying.

### Export dialog cancels or save fails

- Choose a folder where you have write permission.
- If the output exceeds 100,000 items, it is automatically split into multiple files (`training_data-1.jsonl`, `training_data-2.jsonl`, etc.). You will be prompted for each part.
- If you cancel the save dialog, the export stops and you will see an "Export cancelled" message.

### Copy to clipboard fails

Copying uses the system clipboard. It can fail if:

- There is no output data to copy.
- The generated content is extremely large for the clipboard.
- The app lost focus or the OS clipboard was locked by another program.

Try exporting to a file instead.

### Output format looks different than expected

Available export formats are:

| Format | Description |
|--------|-------------|
| JSONL | One JSON object per line (default). |
| JSON | A single pretty-printed JSON array. |
| CSV | `instruction,input,output` columns. |
| Text | Plain text of each item's output. |
| ChatML | Messages array (`[{role, content}, ...]`). |

The format selected in the **Export** dropdown determines how the output is saved or copied.

---

## Performance and crashes

### Processing is very slow

- Large files and high concurrency increase memory and CPU usage.
- The app automatically throttles concurrency when JavaScript heap usage exceeds 80%.
- Try lowering **Max parallel files** and **Concurrency** in Settings.
- Close other heavy applications while processing.

### App becomes unresponsive

- Very large prompts or many parallel files can overwhelm the renderer. Reduce chunk size and concurrency.
- If the window freezes, wait briefly; the renderer may recover after the current batch finishes.

---

## Collecting logs

Logs are the fastest way to diagnose a problem.

### Log file location

Training Generator writes rotating log files to:

- **Windows:** `%USERPROFILE%\Documents\TrainingGenerator\logs\`
- **macOS:** `~/Documents/TrainingGenerator/logs/`
- **Linux:** `~/Documents/TrainingGenerator/logs/`

Files are named `app-0.log`, `app-1.log`, ..., `app-4.log`. Up to 5 files are kept and each is limited to roughly 1 MB.

### In-app processing log

The **Processing Log** panel on the right shows the most recent messages. It keeps the last 50 entries; older entries are removed from the UI but remain in the log files on disk.

### What to include in a bug report

1. The Training Generator version (from the app or GitHub releases).
2. Your operating system and version.
3. Ollama version and the model you were using.
4. The steps that led to the problem.
5. The relevant log file (`app-0.log`) from the logs directory.
6. If the issue is file-specific, describe the file type and approximate size. Do not attach sensitive documents.

### Reporting an issue

Use the GitHub issue templates in the repository:

- [Bug report](../.github/ISSUE_TEMPLATE/bug_report.md)
- [Feature request](../.github/ISSUE_TEMPLATE/feature_request.md)

Before opening a new issue, check whether it has already been reported.

> **Security note:** Redact API keys, personal information, and confidential file content from logs before sharing them.
