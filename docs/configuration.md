# Configuration Guide

This guide explains every setting available in Training Generator, from the right-side configuration panel to the settings modal and saved profiles. Use it to tune processing behavior, manage application preferences, and reuse configurations across sessions.

---

## Configuration Panel

The configuration panel is the main place to choose how documents are converted into training data. Open it from the right column of the main window.

### Ollama Model

- **Control**: `model-select` dropdown
- **Description**: The local or remote model used to generate training data. The dropdown is populated automatically from the running Ollama instance.
- **Requirement**: Ollama must be running and reachable. See `providers.md` for setup details.
- **Recommendation**: Use a model that matches your output language and task complexity. Larger context models handle bigger chunks better.

### Provider

- **Control**: `provider` dropdown
- **Options**: `ollama` (local), `openai`, `anthropic`, `gemini`
- **Description**: Selects the AI backend. Ollama runs locally; the other providers send requests to cloud APIs.
- **Behavior**: When a cloud provider is selected, the **API Key** and **Base URL** fields appear. When Ollama is selected, those fields are hidden.
- **Recommendation**: Use Ollama for privacy and offline work; use cloud providers for stronger models or when Ollama is unavailable.

### API Key

- **Control**: `api-key` password input (visible for cloud providers)
- **Description**: Authentication key for the selected cloud provider.
- **Security**: Keys are encrypted before being stored in `localStorage` and are decrypted only in memory when needed.
- **Recommendation**: Generate a dedicated key for Training Generator and rotate it regularly.

### Base URL

- **Control**: `base-url` text input (visible for cloud providers)
- **Description**: The API endpoint used by the selected cloud provider. Defaults are applied automatically if left blank.
- **Defaults**:
  - OpenAI: `https://api.openai.com`
  - Anthropic: `https://api.anthropic.com`
  - Gemini: `https://generativelanguage.googleapis.com`
- **Recommendation**: Change this only if you use a proxy, corporate gateway, or an OpenAI-compatible endpoint.

### Processing Type

- **Control**: `processing-type` dropdown
- **Options**:
  - `instruction`: Generates question-and-answer pairs for instruction tuning (Alpaca-style).
  - `conversation`: Generates multi-turn User/Assistant conversations.
  - `chunking`: Produces a detailed summary of each text chunk.
  - `custom`: Uses the custom prompt template for structured extraction.
- **Description**: Determines the prompt template and output structure applied to each chunk.
- **Recommendation**: Use `instruction` for general fine-tuning, `conversation` for chat models, `chunking` for retrieval contexts, and `custom` when you have a specialized template.

### Output Format

- **Control**: `output-format` dropdown
- **Options**:
  - `jsonl`: One JSON object per line (Alpaca style).
  - `chatml`: Messages array in ChatML format.
  - `text`: Plain text output.
  - `csv`: Comma-separated values.
- **Description**: The serialization format used for the generated training items.
- **Recommendation**: `jsonl` is the most common format for training pipelines. `chatml` is useful for chat-tuned models.

### Output Language

- **Control**: `language-select` dropdown
- **Options**: `en`, `zh-Hans`, `zh-Hant`, `es`, `fr`, `de`, `ja`, `ko`
- **Description**: The language used in generated prompts and output. The app loads a matching prompt template from `src/prompts/<lang>_<type>.txt`.
- **Recommendation**: Match this to the dominant language of your documents and verify that the selected model supports it.

### Chunk Size (characters)

- **Control**: `chunk-size` number input
- **Range**: 500–10,000
- **Default**: 2000
- **Description**: Maximum number of characters in each text chunk sent to the model. Smaller chunks are processed individually; very small chunks may be batched when using cloud providers.
- **Recommendation**:
  - 1000–1500: Dense documents where each paragraph contains a distinct fact.
  - 2000–4000: Balanced choice for most articles and reports.
  - 5000+: Long-form prose; requires a model with a large context window.

### Concurrency

- **Control**: `concurrency` dropdown
- **Options**: 1, 2, 3, 4, 5
- **Default**: 3 (Recommended)
- **Description**: Number of chunks that can be processed in parallel for a single file.
- **Recommendation**:
  - `1 (Serial)`: Use when the provider is rate-limited or unstable.
  - `3 (Recommended)`: Good balance for local Ollama setups.
  - `5 (Fast)`: Use with powerful GPUs or cloud providers; increases memory usage.

### Temperature

- **Control**: `temperature` range slider
- **Range**: 0.0–1.0
- **Default**: 0.7
- **Description**: Controls the randomness of model outputs. Lower values produce more deterministic results; higher values produce more varied phrasing.
- **Recommendation**:
  - 0.0–0.3: Highly factual extraction where consistency matters.
  - 0.5–0.7: Balanced variety and accuracy for most training data.
  - 0.8–1.0: More creative paraphrasing; may introduce hallucinations.

### Save Preset

- **Control**: `save-preset` button
- **Description**: Saves the current configuration panel values (model, provider, API key, base URL, processing type, output format, language, chunk size, concurrency, and temperature) to `localStorage` under the key `train-generator-settings`.
- **Behavior**: The preset is restored automatically the next time the app launches.
- **Recommendation**: Save a preset after settling on a provider and model so you do not have to reconfigure each session.

---

## Settings Modal

Open the settings modal from the header (gear icon) to manage appearance, configuration profiles, processing limits, and window behavior.

### Appearance

#### Theme

- **Control**: `theme-select` dropdown
- **Options**: `auto` (system), `light`, `dark`
- **Description**: Sets the application color scheme.
- **Behavior**: `auto` follows the operating system preference.

#### Font Size

- **Control**: `font-size` dropdown
- **Options**: `small`, `medium`, `large`
- **Default**: `medium`
- **Description**: Adjusts the UI font size for readability.

#### UI Language

- **Control**: `ui-language-select` dropdown
- **Options**: `en`, `zh-Hans`, `zh-Hant`, `ja`, `ko`, `es`, `fr`, `de`
- **Default**: `en`
- **Description**: Changes the language of the application interface labels and messages.

### Configuration Profiles

#### Saved Profiles

- **Control**: `profile-select` dropdown
- **Description**: Lists all saved configuration profiles stored in `localStorage` under the key `train-generator-profiles`.
- **Behavior**: Selecting a profile immediately applies its values to the configuration panel.

#### Save Profile

- **Control**: `save-profile-btn` button
- **Description**: Stores the current configuration panel state as a named profile.
- **Stored fields**: model, processing type, output format, language, chunk size, concurrency, provider, base URL, smart sizing flag, and creation timestamp.
- **Recommendation**: Create separate profiles for different providers, document types, or languages.

#### Delete Profile

- **Control**: `delete-profile-btn` button
- **Description**: Removes the selected profile from `localStorage` after confirmation.

### Processing

#### Auto-save Presets

- **Control**: `auto-save` checkbox
- **Default**: enabled
- **Description**: When enabled, changes to settings modal controls are saved automatically.

#### Auto-check Ollama Status

- **Control**: `auto-check-ollama` checkbox
- **Default**: enabled
- **Description**: Periodically polls the Ollama service to refresh the model list and online/offline indicator.

#### Smart Sizing

- **Control**: `smart-sizing` checkbox
- **Default**: enabled
- **Description**: Allows the chunker to adapt chunk boundaries based on content instead of using a strict character limit.
- **Recommendation**: Leave enabled for documents with irregular section lengths.

#### Max File Size (MB)

- **Control**: `max-file-size` number input
- **Range**: 10–1000
- **Default**: 100
- **Description**: Upper size limit for files accepted by the upload area.

#### Max Output Items per File

- **Control**: `max-output-items` dropdown
- **Options**: `0` (unlimited), 10,000, 50,000, 100,000, 500,000, 1,000,000
- **Default**: 100,000
- **Description**: Caps how many training items can be produced from a single file.

#### Max Chunks per File

- **Control**: `max-chunks` dropdown
- **Options**: `0` (unlimited), 100, 200, 500, 1,000, 5,000
- **Default**: 500
- **Description**: Limits how many chunks are sent to the model per file.
- **Recommendation**: Lower this when testing or when processing very large documents to control cost and runtime.

#### Max Parallel Files

- **Control**: `max-parallel-files` dropdown
- **Options**: 1 (sequential), 2, 3, 4, 5, 8, 10
- **Default**: 1 (Sequential)
- **Description**: Number of files processed simultaneously. The app also throttles parallelism automatically if JavaScript heap usage exceeds 80%.
- **Recommendation**: Use `1` for local Ollama to avoid memory spikes; increase for cloud providers with higher rate limits.

### Window

#### Start Maximized

- **Control**: `start-maximized` checkbox
- **Default**: disabled
- **Description**: Opens the application window maximized on launch.

#### Remember Window Size

- **Control**: `remember-window-size` checkbox
- **Default**: enabled
- **Description**: Restores the last window size on launch.

### Reset to Defaults

- **Control**: `reset-settings` button
- **Description**: Reverts all settings modal controls to their factory defaults and saves them.

### Save Settings

- **Control**: `save-settings` button
- **Description**: Manually saves the current settings modal values to `localStorage` under the key `training-generator-app-settings`.

---

## Saved Profiles and Presets

Training Generator stores two kinds of reusable configuration:

| Storage | Key | Scope | How to Manage |
|---------|-----|-------|---------------|
| **Preset** | `train-generator-settings` | The configuration panel | `Save Preset` button in the panel |
| **Application settings** | `training-generator-app-settings` | Settings modal values | `Save Settings` button or auto-save |
| **Profiles** | `train-generator-profiles` | Named snapshots of the configuration panel | `Save Profile` / `Delete Profile` in settings |

### Profile Fields

Each saved profile contains the following fields:

- `name`: Profile label shown in the dropdown.
- `model`: Selected model.
- `processingType`: Instruction, conversation, chunking, or custom.
- `outputFormat`: jsonl, chatml, text, or csv.
- `language`: Output language code.
- `chunkSize`: Chunk size in characters.
- `concurrency`: Number of concurrent chunk requests.
- `provider`: ollama, openai, anthropic, or gemini.
- `baseUrl`: Optional custom API endpoint.
- `smartSizing`: Whether smart chunk sizing is enabled.
- `createdAt`: ISO timestamp of creation.

### Best Practices

1. Save a preset for your everyday provider so the app restores it automatically.
2. Create named profiles for each workflow, such as `English-QA-Ollama`, `Chinese-Conversation-OpenAI`, or `Test-Low-Chunk`.
3. Keep API keys in cloud-provider profiles only when necessary; remember that keys are encrypted at rest but still stored locally.
4. Use limits (`max-output-items`, `max-chunks`, `max-parallel-files`) when processing large batches to avoid excessive runtime or cost.
5. Pair chunk size with the model's context window. A chunk larger than the model can process will result in truncated or failed generations.

---

## Quick Reference

| Setting | Default | Typical Range |
|---------|---------|---------------|
| Chunk Size | 2000 | 500–10,000 |
| Concurrency | 3 | 1–5 |
| Temperature | 0.7 | 0.0–1.0 |
| Max File Size | 100 MB | 10–1000 MB |
| Max Output Items | 100,000 | unlimited–1,000,000 |
| Max Chunks | 500 | unlimited–5,000 |
| Max Parallel Files | 1 | 1–10 |
