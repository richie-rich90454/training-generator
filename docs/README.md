# Training Generator Documentation

Welcome to the **Training Generator** documentation. These guides cover installing the app, configuring providers, understanding the architecture, and contributing to development.

## User Guides

- [Quick Start](/getting-started/quick-start.md) — Generate your first dataset in under five minutes.
- [Installation](/getting-started/installation.md) — Prerequisites, cloning, dependencies, and packaged releases.
- [Keyboard Shortcuts](/getting-started/keyboard-shortcuts.md) — All supported shortcuts with context and action.
- [Model Settings](/configuration/model-settings.md) — Provider, model, temperature, concurrency, and chunking.
- [Output Settings](/configuration/output-settings.md) — Formats, languages, item limits, and export behavior.
- [Output Mode](/configuration/output-mode.md) — Per-file exports, filename templates, and splitting.
- [Settings Reference](/configuration/settings-reference.md) — Every `AppSettings` and `FullAppSettings` field.
- [Providers](/providers/overview.md) — Set up Ollama, OpenAI, Anthropic, and Google Gemini.
- [Troubleshooting](/troubleshooting/common-issues.md) — Common problems and resolutions.

The app supports eight UI languages. Every user-facing string — labels, buttons, status messages, errors, log messages, exporter content, and splash screen text — is translatable through `src/renderer/i18n.ts`.

## Developer and Architecture Guides

- [Architecture Overview](/architecture/overview.md) — Main, renderer, preload, and worker processes.
- [Development Guide](/architecture/development.md) — Dev setup, scripts, testing, build, packaging, and code style.
- [Processing Overview](/processing/overview.md) — Document pipeline and processing types.
- [Output Formats](/output/formats.md) — JSONL, ChatML, CSV, JSON, and text.
- [CLI Usage](/cli/usage.md) — Headless batch processing.
- [Testing](/testing/overview.md) — Test strategy and running the suite.

## Quick Links

- [Main README](../README.md)
- [GitHub Repository](https://github.com/richie-rich90454/training-generator)
- [Issue Tracker](https://github.com/richie-rich90454/training-generator/issues)
