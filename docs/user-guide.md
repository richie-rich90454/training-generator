# Training Generator — User Guide

**Training Generator** is a desktop app that converts your documents into AI training data. It runs locally with Ollama and also supports cloud providers such as OpenAI, Anthropic, and Google Gemini.

This guide covers installation, first launch, uploading files, configuring a processing run, generating training data, and exporting results.

---

## Table of Contents

- [Installation](#installation)
- [First Launch](#first-launch)
- [Main Window Layout](#main-window-layout)
- [Uploading Files](#uploading-files)
- [Configuring a Processing Run](#configuring-a-processing-run)
- [Processing Files](#processing-files)
- [Exporting Results](#exporting-results)
- [Tips for Best Results](#tips-for-best-results)

---

## Installation

### Prerequisites

- **Node.js 20 or later** (Node.js 24+ recommended).
- **Ollama** if you want to process files locally. Download it from [ollama.com](https://ollama.com/).

### Install from Source

1. Clone the repository:

   ```bash
   git clone https://github.com/richie-rich90454/training-generator.git
   cd training-generator
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start Ollama in a separate terminal:

   ```bash
   ollama serve
   ```

4. Pull at least one model, for example:

   ```bash
   ollama pull llama3.2
   ```

5. Launch the app:

   ```bash
   npm run dev   # development mode with hot reload
   # or
   npm start     # production mode
   ```

### Install a Packaged Release

Pre-built installers are available on the [GitHub Releases](https://github.com/richie-rich90454/training-generator/releases) page:

- **Windows**: `.exe` installer and portable executable.
- **macOS**: `.dmg` and `.zip`.
- **Linux**: `.AppImage` and `.deb`.

Download the file for your platform, run the installer, and open **Training Generator** from your applications menu or desktop shortcut.

---

## First Launch

When the app opens you will see the main window with the title **Training Generator** and subtitle **Convert documents to AI training data using Ollama**.

In the top-right corner of the header are two icon buttons:

- **Settings** — Open the settings modal.
- **Help** — Show a quick help overlay.

The **System Status** card on the right side shows whether Ollama is online and lists how many models are available. If Ollama is offline, start it with `ollama serve` and the app will detect it automatically within a few seconds.

---

## Main Window Layout

The window is split into two resizable columns.

### Left Column

From top to bottom:

1. **Upload Documents** card — Drag and drop area plus the selected file list.
2. **Processing** card — Progress bar, status text, and processing log.
3. **Output Preview** card — Live preview of generated training items and export controls.

### Right Column

From top to bottom:

1. **Configuration** panel — Model, provider, processing type, output format, language, chunk size, concurrency, and temperature.
2. **System Status** panel — Ollama status, files processed count, and last processed time.

You can resize the columns by dragging the vertical splitter bar between them, or by using the `Left Arrow` and `Right Arrow` keys while the splitter is focused.

---

## Uploading Files

Training Generator can read:

- PDF
- DOCX and DOC
- RTF
- TXT
- MD (Markdown)
- HTML

### How to Upload

1. Click the **Browse Files** button inside the **Upload Documents** card, or press `Ctrl+O`.
2. Select one or more files in the file dialog.
3. Alternatively, drag files from your file explorer and drop them onto the upload area.

The upload area also supports keyboard activation: focus it and press `Space` or `Enter` to open the file dialog.

### File List

Selected files appear in the **Selected Files** list below the upload area. Each item shows:

- An icon for the file type.
- The file name (truncated with a tooltip if it is very long).
- The file size.
- A status indicator: **Waiting**, **Processing**, **Completed**, or **Failed**.
- A remove button (`×`) to remove the file from the queue.

Click **Clear All** to remove every file at once.

### Limits

- Maximum file size: 100 MB per file.
- Maximum selected files: 100.
- Large PDFs (greater than 20 MB) may take longer to parse.

---

## Configuring a Processing Run

Use the **Configuration** panel on the right to choose how files are converted into training data.

### Provider and Model

- **Ollama Model** — Select a model pulled locally, such as `llama3.2`.
- **Provider** — Choose `Ollama (Local)`, `OpenAI`, `Anthropic`, or `Google Gemini`.
  - Cloud providers reveal extra fields for **API Key** and **Base URL**.
  - API keys are encrypted with AES-256-GCM before being stored.

### Processing Type

- **Instruction Tuning (Q&A)** — Extracts question-and-answer pairs from the text.
- **Conversation Generation** — Generates dialog-style training data.
- **Text Chunking** — Produces semantic chunks suitable for retrieval or context tasks.
- **Custom Prompt** — Uses a user-defined prompt template.

### Output Format

- **JSONL (Alpaca style)** — One JSON object per line with `instruction`, `input`, and `output` fields.
- **ChatML Format** — Messages array with `user` and `assistant` roles.
- **Plain Text** — Simplified text output.
- **CSV** — Tabular `input`/`output` format.

### Output Language

Choose from English, Chinese (Simplified), Chinese (Traditional), Spanish, French, German, Japanese, or Korean. Make sure your selected model supports the chosen language.

### UI Language

Open the settings modal and use the **UI Language** dropdown to change the language of the entire application interface. All user-facing text — including menus, buttons, status messages, tooltips, error dialogs, analytics labels, exporter content, and splash screen text — is translated. If you add or modify any UI string in the codebase, make sure it is added to `src/renderer/i18n.ts` for every supported language.

### Chunk Size

The number of characters per chunk. The allowed range is 500 to 10,000. Smaller chunks are easier for models to process; larger chunks preserve more context.

### Concurrency

How many chunks are sent to the model at the same time:

- **1** — Serial, lowest resource usage.
- **3** — Recommended balance.
- **5** — Fastest, but requires more memory and API quota.

### Temperature

Controls creativity. A lower value such as `0.2` produces more deterministic output; a higher value such as `0.8` produces more varied output. The default is `0.7`.

### Saving Presets

Click **Save Preset** to store the current configuration. Presets are restored automatically the next time you open the app.

---

## Processing Files

1. Make sure at least one file is selected and a model is available.
2. Click **Process Files** or press `Ctrl+Enter`.

The app will:

1. Read each file.
2. Split the text into semantic chunks.
3. Send chunks to the selected provider.
4. Parse the responses into training items.
5. Remove near-duplicate items.
6. Update the **Output Preview** and **Processing Log** as items are generated.

### During Processing

- The progress bar shows overall completion.
- The processing log displays status messages, warnings, and errors.
- The **Dashboard** button toggles a real-time metrics panel.
- The **Demo** button lets you run without a model using placeholder data, which is useful for testing the UI.

### Stopping

Press `Escape` or click the **Process Files** button again (now showing a stop icon) to cancel processing. The app will finish the current chunk and then stop cleanly.

### Resume

If processing is interrupted, the app saves a checkpoint every 30 seconds. On the next launch it will ask whether you want to resume from the checkpoint.

---

## Exporting Results

After processing completes, the **Export** and **Copy** buttons become active in the **Output Preview** card.

### Output mode (v2.0.1)

Training Generator supports two output modes, controlled by the **Output File Mode** setting in the configuration panel and the Settings modal:

- **Combined** (default) — all items from every file in the work queue are merged into a single export file. If the total exceeds 100,000 items, the output is split into numbered parts.
- **Per-file** — each input file produces its own export file, named after the source file (for example `report.pdf` becomes `report.jsonl`). You pick a destination directory once, and the app writes one file per source. Sources that produced zero items are skipped with a warning instead of writing empty files.

The per-file filename is controlled by the **Output Filename Template** setting in the Settings modal. The default template is `{source}`. Supported placeholders: `{source}`, `{format}`, `{date}`, `{timestamp}`, `{index}`. See [Output Mode](/configuration/output-mode.md) for the full guide.

The choice takes effect immediately and persists across restarts.

### Export to File

1. Choose a format from the **Export Format** dropdown: JSONL, JSON Array, or CSV.
2. Choose an output mode if you want per-file exports.
3. Click **Export** or press `Ctrl+E`.
4. In combined mode, choose a save location in the file dialog. In per-file mode, choose a destination directory.

If the output contains more than 100,000 items in combined mode, it is automatically split into multiple files. In per-file mode, each source file's output is split independently when it exceeds the `maxItemsPerFile` setting (default 50,000).

### Copy to Clipboard

Click **Copy** or press `Ctrl+Shift+C` to copy the current output to the clipboard in the selected export format. Copy always uses combined mode regardless of the `outputFileMode` setting.

### Output Preview

The preview pane shows the last few generated items. When there are more than 100 items, a virtual scrolling list is used for performance.

::: details Did you know?
Every generated training item carries hidden `sourceFile` metadata so per-file export can group items by their origin. In combined mode this metadata is stripped from the export unless you enable **Include Source Metadata** in the Settings modal. Enable it when you want to audit which source document produced each item — useful for regression testing or for proving dataset provenance to a reviewer.
:::

---

## Tips for Best Results

- **Use GPU-accelerated Ollama** for faster processing.
- **Reduce chunk size** for large documents or models with small context windows.
- **Convert scanned PDFs to text first** using OCR software; image-based PDFs cannot be parsed.
- **Start with the default settings** and adjust temperature and chunk size based on the output quality.
- **Save presets** for recurring workflows so you do not have to reconfigure the app each time.

---

## Next Steps

- Learn about every configuration option in the [Configuration Guide](configuration.md).
- Set up cloud providers in the [Provider Guide](providers.md).
- Find solutions to common issues in the [Troubleshooting Guide](troubleshooting.md).
