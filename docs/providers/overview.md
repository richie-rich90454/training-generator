---
title: Providers
description: Set up and switch between Ollama, OpenAI, Anthropic, and Google Gemini providers.
outline: [2, 3]
---

# Providers

Training Generator supports four AI providers. Ollama runs locally by default; OpenAI, Anthropic, and Google Gemini are cloud providers that require API keys.

## Provider quick reference

| Provider | Mode | Base URL | Key source | Typical models |
| --- | --- | --- | --- | --- |
| Ollama | Local | `http://localhost:11434` | None | `llama3.1`, `qwen2.5`, `mistral`, `phi4` |
| OpenAI | Cloud | `https://api.openai.com` | OpenAI dashboard | `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo` |
| Anthropic | Cloud | `https://api.anthropic.com` | Anthropic console | `claude-3-5-sonnet-latest`, `claude-3-opus-latest` |
| Gemini | Cloud | `https://generativelanguage.googleapis.com` | Google AI Studio | `gemini-1.5-pro-latest`, `gemini-1.5-flash-latest` |

::: tip Choosing a provider
- **Privacy / offline** → Ollama
- **Highest quality** → OpenAI GPT-4o or Anthropic Claude 3.5 Sonnet
- **Low cost** → Ollama or Gemini Flash
- **Long-context documents** → Anthropic Claude or Gemini 1.5 Pro
:::

## Ollama (local, default)

Ollama is the recommended provider for privacy-focused or offline workflows.

### Install and start

1. Download the installer from [ollama.com](https://ollama.com).
2. Verify the install:

   ```bash
   ollama --version
   ```

3. Start the server (if it is not already running):

   ```bash
   ollama serve
   ```

The app checks Ollama status every 30 seconds and refreshes the model dropdown automatically.

### Pull models

```bash
ollama pull llama3.2
ollama pull qwen2.5
ollama pull mistral
ollama pull phi4

ollama list   # show installed models
```

### Select a model in the app

1. Set **Provider** to `Ollama (Local)`.
2. Wait for the **Ollama Model** dropdown to populate.
3. Choose the model.

### Model recommendations

| Use case | Suggested models |
| --- | --- |
| General instruction tuning | `llama3.1`, `mistral`, `qwen2.5` |
| Long-context documents | `llama3.1:70b`, `qwen2.5:32b`, `mixtral` |
| Multilingual output | `qwen2.5`, `aya` |
| Low-resource machines | `phi4`, `llama3.2` |

## OpenAI

Use OpenAI for high-quality cloud models.

### Configuration

1. Set **Provider** to `OpenAI`.
2. Enter your API key in **API Key** (from the [OpenAI API dashboard](https://platform.openai.com/api-keys)).
3. Leave **Base URL** blank unless you use a proxy or OpenAI-compatible endpoint.

Requests go to `/v1/chat/completions`; the key is validated against `/v1/models` during health checks. Common model identifiers: `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`, `gpt-4-turbo`.

::: warning Cost and rate limits
OpenAI charges per token. Large documents with many chunks can become expensive. The built-in rate limiter allows up to 60 requests per 10 seconds by default. Reduce **Concurrency** and **Max Parallel Files** if you hit limits.
:::

## Anthropic

Anthropic provides Claude models — strong at following long, nuanced instructions.

### Configuration

1. Set **Provider** to `Anthropic`.
2. Enter your API key (from the [Anthropic console](https://console.anthropic.com/settings/keys)).
3. Leave **Base URL** blank unless you use a proxy.

Common model identifiers: `claude-3-5-sonnet-latest`, `claude-3-opus-latest`, `claude-3-haiku-latest`. Claude's large context windows make it suitable for high **Chunk Size** values.

## Google Gemini

Google's multimodal model family, accessed via the Google AI Studio API.

### Configuration

1. Set **Provider** to `Google Gemini`.
2. Enter your API key (from [Google AI Studio](https://aistudio.google.com/app/apikey)).
3. Leave **Base URL** blank unless you use a proxy.

Common model identifiers: `gemini-1.5-pro-latest`, `gemini-1.5-flash-latest`, `gemini-1.0-pro`. Gemini offers a generous free tier, but production usage is metered.

## Security

- API keys are encrypted with **AES-256-GCM** before being stored in `localStorage`.
- Keys are only decrypted in memory when a request is made.
- Use a dedicated key per installation and rotate it regularly.
- Never commit files or screenshots that contain API keys.

## Failover behavior

When a cloud provider is selected, Training Generator keeps Ollama registered as a fallback. If the primary cloud provider fails three consecutive times, the provider manager temporarily fails over to Ollama for the next request.

::: warning Failover requires Ollama
Failover only works if Ollama is running with a compatible model. Keep Ollama running even when using a cloud provider.
:::

## CLI provider selection

The CLI exposes the same provider selection:

```bash
npm run cli -- \
  --input ./examples \
  --output ./output/data.jsonl \
  --provider openai \
  --model gpt-4o-mini
```

Cloud-provider API keys for the CLI are configured in the JSON config file or via the provider abstraction in `src/cli/provider.ts`. See [CLI Usage](/cli/usage.md).

## Next steps

- [Model Settings](/configuration/model-settings.md) — temperature, concurrency, chunk size.
- [Quick Start](/getting-started/quick-start.md) — generate your first dataset.
- [Troubleshooting](/troubleshooting/common-issues.md) — resolve connection issues.
