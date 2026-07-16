# Provider Setup Guide

Training Generator supports four AI providers: **Ollama** (local), **OpenAI**, **Anthropic**, and **Google Gemini**. This guide explains how to install, configure, and select models for each backend.

---

## Ollama (Local)

Ollama is the recommended provider for privacy-focused or offline workflows. It runs models on your own machine and is selected by default.

### Installation

1. Download the Ollama installer for your platform from [ollama.com](https://ollama.com).
2. Run the installer and follow the prompts.
3. Verify the installation from a terminal:

   ```bash
   ollama --version
   ```

### Starting Ollama

Ollama normally starts automatically, but if the app reports "Ollama: Offline", start the server manually:

```bash
ollama serve
```

Keep the terminal open while Training Generator is running, or configure Ollama to run as a system service.

### Pulling Models

Models are downloaded on demand. Pull a model before selecting it in the app:

```bash
ollama pull llama3.1
ollama pull qwen2.5
ollama pull mistral
ollama pull phi4
```

To list installed models:

```bash
ollama list
```

### Selecting a Model in Training Generator

1. Set **Provider** to `Ollama (Local)`.
2. Wait for the **Ollama Model** dropdown to populate. The app checks Ollama status every 30 seconds.
3. Choose the model you want to use.

### Model Recommendations

| Use Case | Suggested Models | Notes |
|----------|-----------------|-------|
| General instruction tuning | `llama3.1`, `mistral`, `qwen2.5` | Good balance of quality and speed. |
| Long-context documents | `llama3.1:70b`, `qwen2.5:32b`, `mixtral` | Larger context windows handle bigger chunks. |
| Multilingual output | `qwen2.5`, `aya` | Strong performance for Chinese, Japanese, Korean, and European languages. |
| Low-resource machines | `phi4`, `llama3.2` | Smaller, faster models that still produce usable training data. |

### Troubleshooting Ollama

- **Ollama not detected**: Confirm `ollama serve` is running and reachable at the default local endpoint.
- **Model list is empty**: Pull at least one model with `ollama pull <model>`.
- **Out of memory**: Use a smaller model, reduce **Chunk Size**, or lower **Concurrency** and **Max Parallel Files**.
- **Slow generation**: Enable GPU support for Ollama and close other GPU-heavy applications.

---

## OpenAI

Use OpenAI when you need high-quality cloud models such as GPT-4o or GPT-3.5-Turbo.

### Requirements

- An OpenAI account with billing enabled.
- A valid API key from the [OpenAI API dashboard](https://platform.openai.com/api-keys).

### Configuration

1. In the configuration panel, set **Provider** to `OpenAI`.
2. Enter your API key in the **API Key** field.
3. Leave **Base URL** blank unless you use a proxy or OpenAI-compatible endpoint.

   - Default base URL: `https://api.openai.com`

### Model Selection

Type or paste the exact model identifier into the **Ollama Model** field. Common values include:

- `gpt-4o`
- `gpt-4o-mini`
- `gpt-3.5-turbo`
- `gpt-4-turbo`

The app sends requests to `/v1/chat/completions` (via the main process) and validates the key against `/v1/models` during health checks.

### Cost and Rate Limits

- OpenAI charges per token. Large documents with many chunks can become expensive.
- The built-in rate limiter allows up to 60 requests per 10 seconds by default.
- If you hit rate limits, reduce **Concurrency** and **Max Parallel Files**.

---

## Anthropic

Anthropic provides Claude models, which are strong at following long, nuanced instructions.

### Requirements

- An Anthropic account with API access.
- An API key from the [Anthropic console](https://console.anthropic.com/settings/keys).

### Configuration

1. Set **Provider** to `Anthropic`.
2. Enter your API key in the **API Key** field.
3. Leave **Base URL** blank unless you use a proxy.

   - Default base URL: `https://api.anthropic.com`

### Model Selection

Enter the exact model identifier, for example:

- `claude-3-5-sonnet-latest`
- `claude-3-opus-latest`
- `claude-3-haiku-latest`

Training Generator uses the OpenAI-compatible request shape internally, so the base URL is the only Anthropic-specific setting required.

### Notes

- Anthropic models often have large context windows, making them suitable for high **Chunk Size** values.
- Monitor usage in the Anthropic console, especially when processing many files at once.

---

## Google Gemini

Gemini is Google's family of multimodal models, accessible through the Google AI Studio API.

### Requirements

- A Google account with API access enabled in [Google AI Studio](https://aistudio.google.com/app/apikey).
- A valid Gemini API key.

### Configuration

1. Set **Provider** to `Google Gemini`.
2. Enter your API key in the **API Key** field.
3. Leave **Base URL** blank unless you use a proxy.

   - Default base URL: `https://generativelanguage.googleapis.com`

### Model Selection

Use the model name as it appears in the Gemini API, for example:

- `gemini-1.5-pro-latest`
- `gemini-1.5-flash-latest`
- `gemini-1.0-pro`

### Notes

- Gemini offers a generous free tier, but production usage is metered.
- The app uses the same OpenAI-compatible path for Gemini when configured through the cloud-provider flow.

---

## Cloud Provider Security

- API keys are encrypted before being stored in `localStorage`.
- Keys are only decrypted in memory when a request is made.
- Do not commit files or screenshots that contain API keys.
- Use a dedicated key for Training Generator and revoke it if it is ever exposed.

---

## Failover Behavior

When a cloud provider is selected, Training Generator always keeps Ollama registered as a fallback provider. If the primary cloud provider fails three consecutive times, the provider manager temporarily fails over to Ollama for the next request. This requires Ollama to be running with a compatible model.

---

## Provider Quick Reference

| Provider | Base URL | Key Source | Typical Models (could change) |
|----------|----------|------------|----------------|
| Ollama | `http://localhost:11434` (default) | None (local) | `llama3.1`, `qwen2.5`, `mistral`, `phi4` |
| OpenAI | `https://api.openai.com` | OpenAI API dashboard | `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo` |
| Anthropic | `https://api.anthropic.com` | Anthropic console | `claude-3-5-sonnet-latest`, `claude-3-opus-latest` |
| Gemini | `https://generativelanguage.googleapis.com` | Google AI Studio | `gemini-1.5-pro-latest`, `gemini-1.5-flash-latest` |

---
