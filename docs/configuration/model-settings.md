---
title: Model Settings
description: Configure provider, model, temperature, concurrency, and chunking behavior.
outline: [2, 3]
---

# Model Settings

The configuration panel (right column of the main window) controls how documents are converted into training data. This page covers the model, provider, chunking, and concurrency settings. Output-format settings are described in [Output Settings](/configuration/output-settings.md).

## Provider

| Value | Mode | Endpoint |
| --- | --- | --- |
| `ollama` | Local | `http://localhost:11434` |
| `openai` | Cloud | `https://api.openai.com` |
| `anthropic` | Cloud | `https://api.anthropic.com` |
| `gemini` | Cloud | `https://generativelanguage.googleapis.com` |

When a cloud provider is selected, the **API Key** and **Base URL** fields appear. Ollama is always registered as a fallback; after three consecutive cloud failures, requests temporarily fail over to Ollama.

::: tip API key security
Keys are encrypted with AES-256-GCM before being written to `localStorage` and are only decrypted in memory when a request is made. Use a dedicated key per installation.
:::

See [Providers](/providers/overview.md) for per-provider setup.

## Model

- **Control**: `model-select` dropdown (Ollama) or text input (cloud)
- **Default**: populated from running Ollama instance
- **Behavior**: The chosen model receives one prompt per text chunk. Larger context windows handle bigger chunks; multilingual models are required for non-Latin output languages.

Recommended models:

| Use case | Model |
| --- | --- |
| General instruction tuning | `llama3.1`, `mistral`, `qwen2.5` |
| Long-context documents | `qwen2.5:32b`, `mixtral`, `claude-3-5-sonnet-latest` |
| Multilingual output | `qwen2.5`, `aya`, `gemini-1.5-pro-latest` |
| Low-resource machines | `phi4`, `llama3.2` |

## Temperature

- **Control**: range slider
- **Range**: `0.0` – `1.0`
- **Default**: `0.7`

Controls randomness. Lower values produce deterministic, factual output; higher values vary phrasing.

| Range | Best for |
| --- | --- |
| `0.0` – `0.3` | Factual extraction where consistency matters |
| `0.5` – `0.7` | Balanced variety and accuracy (default) |
| `0.8` – `1.0` | Creative paraphrasing — may introduce hallucinations |

## Chunk Size

- **Control**: `chunk-size` number input
- **Range**: `500` – `10,000` characters
- **Default**: `2000`

Maximum characters per text chunk sent to the model. Very small chunks may be batched together when using a cloud provider to reduce request count.

::: warning Match chunk size to context window
A chunk larger than the model's context window will be truncated or rejected. Reduce chunk size for smaller models (e.g. `phi4`) and increase it for long-context models (e.g. `claude-3`, `gemini-1.5-pro`).
:::

## Smart Sizing

- **Control**: `smart-sizing` checkbox (in Settings modal)
- **Default**: enabled

When enabled, the chunker adapts boundaries based on content density rather than strictly enforcing the character limit, keeping sentences and semantic units intact.

## Concurrency

- **Control**: `concurrency` dropdown
- **Options**: `1`, `2`, `3`, `4`, `5`
- **Default**: `3` (Recommended)

Number of chunks processed in parallel **per file**.

| Value | When to use |
| --- | --- |
| `1` (Serial) | Rate-limited or unstable providers |
| `3` (Recommended) | Local Ollama with a mid-range GPU |
| `5` (Fast) | Powerful GPU or cloud provider; higher memory usage |

## Max Parallel Files

- **Control**: `max-parallel-files` dropdown (Settings modal)
- **Options**: `1`, `2`, `3`, `4`, `5`, `8`, `10`
- **Default**: `1` (Sequential)

Number of files processed simultaneously. The app automatically throttles parallelism if JavaScript heap usage exceeds 80%.

::: tip Local vs cloud
Use `1` for local Ollama to avoid memory spikes. Increase to `4`–`8` for cloud providers with higher rate limits.
:::

## Processing Limits

| Setting | Control | Default | Range / Options |
| --- | --- | --- | --- |
| Max File Size (MB) | number input | `100` | `10` – `1000` |
| Max Output Items per File | dropdown | `100,000` | `0` (unlimited) – `1,000,000` |
| Max Chunks per File | dropdown | `500` | `0` (unlimited) – `5,000` |

Use these limits to control runtime and cost when processing large batches.

## Save Preset

The **Save Preset** button persists the entire configuration panel (model, provider, API key, base URL, processing type, output format, language, chunk size, concurrency, temperature) to `localStorage` under `train-generator-settings`. The preset is restored automatically on the next launch.

### Saved profiles

The Settings modal lets you save **named profiles** (`train-generator-profiles`) for different workflows — for example `English-QA-Ollama` or `Chinese-Conversation-OpenAI`. Selecting a profile instantly applies its values to the panel.

Each stored profile contains: `name`, `model`, `processingType`, `outputFormat`, `language`, `chunkSize`, `concurrency`, `provider`, `baseUrl`, `smartSizing`, `createdAt`.

## Quick reference

| Setting | Default | Typical range |
| --- | --- | --- |
| Chunk Size | `2000` | `500` – `10,000` |
| Concurrency | `3` | `1` – `5` |
| Temperature | `0.7` | `0.0` – `1.0` |
| Max File Size | `100 MB` | `10` – `1000 MB` |
| Max Output Items | `100,000` | unlimited – `1,000,000` |
| Max Chunks | `500` | unlimited – `5,000` |
| Max Parallel Files | `1` | `1` – `10` |
