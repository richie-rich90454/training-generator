# Training Generator - Generate High-Quality AI Training Datasets from Your Documents

**A modern desktop application for converting PDFs, Word documents, Markdown, HTML, and text files into high-quality instruction datasets, conversations, ChatML, and JSONL using local or cloud Large Language Models.**

<p>

[![Release](https://img.shields.io/github/v/release/richie-rich90454/training-generator?label=Latest%20Release&style=for-the-badge)](https://github.com/richie-rich90454/training-generator/releases)
[![Downloads](https://img.shields.io/github/downloads/richie-rich90454/training-generator/total?style=for-the-badge)](https://github.com/richie-rich90454/training-generator/releases)
[![License](https://img.shields.io/github/license/richie-rich90454/training-generator?style=for-the-badge)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/richie-rich90454/training-generator/ci.yml?branch=main&style=for-the-badge)](https://github.com/richie-rich90454/training-generator/actions)
[![Stars](https://img.shields.io/github/stars/richie-rich90454/training-generator?style=for-the-badge)](https://github.com/richie-rich90454/training-generator/stargazers)
[![Issues](https://img.shields.io/github/issues/richie-rich90454/training-generator?style=for-the-badge)](https://github.com/richie-rich90454/training-generator/issues)

</p>

<p>

<a href="#-installation">Installation</a>
•
<a href="#-quick-start">Quick Start</a>
•
<a href="#-features">Features</a>
•
<a href="docs/README.md">Documentation</a>
•
<a href="https://github.com/richie-rich90454/training-generator/releases">Downloads</a>

</p>

---

### Built With

![Electron](https://img.shields.io/badge/Electron-43.1-47848F?style=flat-square&logo=electron)
![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?style=flat-square&logo=typescript)
![SolidJS](https://img.shields.io/badge/SolidJS-1.9-2C4F7C?style=flat-square&logo=solid)
![Vite](https://img.shields.io/badge/Vite-8.1-646CFF?style=flat-square&logo=vite)
![Vitest](https://img.shields.io/badge/Vitest-4.1-6E9F18?style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-24%20LTS-339933?style=flat-square&logo=node.js)
![VitePress](https://img.shields.io/badge/VitePress-1.6-5C73E7?style=flat-square)

---

# What is Training Generator?

Training Generator is a **cross-platform desktop application** for creating **AI training datasets** from real-world documents.

Instead of writing custom scripts, manually splitting text, or repeatedly prompting LLMs, Training Generator provides an integrated workflow that transforms documents into structured datasets suitable for:

- LLM fine-tuning
- Instruction tuning
- Supervised learning
- RAG dataset creation
- Synthetic conversations
- Question & answer datasets
- Knowledge extraction
- Benchmark generation

Everything can run **entirely on your own computer** using **Ollama**, or through supported cloud providers such as OpenAI, Anthropic, and Google Gemini.

---

# Why Training Generator?

Most existing dataset generation workflows require one or more of the following:

- Python scripting
- Prompt engineering
- Manual document splitting
- API glue code
- Custom preprocessing
- JSON formatting
- Dataset validation

Training Generator automates the entire pipeline.

```text
            PDF
             │
             ▼
      Smart Extraction
             │
             ▼
     Semantic Chunking
             │
             ▼
      Local / Cloud LLM
             │
             ▼
 Quality Validation
             │
             ▼
 JSONL • ChatML • CSV
```

The goal is simple:

> **Spend time improving datasets—not writing preprocessing code.**

---

# Demo

> **Coming Soon**

Replace this section with:

- Animated GIF
- Short video
- Screenshot gallery

Recommended layout:

```
+--------------------------------------------------------------+
|                                                              |
|                 Main Window Screenshot                        |
|                                                              |
+--------------------------------------------------------------+

Drag PDF
      ↓

Select Model
      ↓

Generate Dataset
      ↓

Export JSONL
```

---

# Screenshots

> Replace these placeholders with actual application screenshots.

## Main Interface

```
assets/screenshots/main-window.png
```

---

## Processing Dashboard

```
assets/screenshots/dashboard.png
```

---

## Dataset Preview

```
assets/screenshots/dataset-preview.png
```

---

## Prompt Editor

```
assets/screenshots/prompt-editor.png
```

---

# Features

## Document Processing

Training Generator supports a wide range of common document formats.

✅ PDF

✅ DOCX

✅ DOC

✅ Markdown

✅ Plain Text

✅ HTML

✅ RTF

Features include:

- Structure-aware parsing
- Automatic metadata extraction
- Large document support
- Incremental reading
- Automatic file splitting
- Unicode-safe processing
- Memory-efficient streaming

---

## AI Dataset Generation

Generate multiple dataset types from a single source document.

Supported workflows include:

- Instruction datasets
- Question & answer generation
- Conversation generation
- Semantic chunk extraction
- Knowledge extraction
- Custom prompt templates

Supported providers:

| Provider | Local | Cloud |
|----------|-------|-------|
| Ollama | ✅ | — |
| OpenAI | — | ✅ |
| Anthropic | — | ✅ |
| Google Gemini | — | ✅ |

Switch providers without changing your workflow.

---

## Output Formats

Export generated datasets into formats used throughout the AI ecosystem.

| Format | Supported |
|---------|-----------|
| JSONL (Alpaca) | ✅ |
| ChatML | ✅ |
| CSV | ✅ |
| JSON | ✅ |
| Plain Text | ✅ |

Perfect for:

- Llama
- Qwen
- Mistral
- Gemma
- Phi
- DeepSeek
- OpenAI fine-tuning
- Custom pipelines

---

## Local First

Unlike many AI tools, Training Generator does **not** require uploading your documents.

When using Ollama:

- Documents remain on your machine
- No cloud storage
- No telemetry
- No vendor lock-in
- Offline operation supported

Your data stays yours.

---

# Modern Technology Stack

Training Generator is built using modern, actively maintained technologies.

| Technology | Version |
|------------|---------|
| Electron | 43 |
| TypeScript | 7 |
| SolidJS | 1.9 |
| Vite | 8.1 |
| Vitest | 4.1 |
| VitePress | 1.6 |
| Electron Builder | 26 |
| Node.js | 24 LTS (recommended) |

The project emphasizes:

- Type safety
- Modern ESM architecture
- Fast incremental builds
- Cross-platform packaging
- Extensive automated testing
- Maintainable codebase
- Long-term sustainability

---

# Quick Start

## 1. Install Node.js

Node.js **24 LTS** is recommended.

Verify installation:

```bash
node --version
npm --version
```

---

## 2. Clone the repository

```bash
git clone https://github.com/richie-rich90454/training-generator.git

cd training-generator
```

---

## 3. Install dependencies

```bash
npm install
```

---

## 4. Start Ollama

```bash
ollama serve
```

Pull your preferred model:

```bash
ollama pull llama3.2
```

---

## 5. Launch the application

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

---

Within a few minutes you'll be able to drag a document into the application and generate structured AI training datasets.
---

# Installation

Training Generator can be installed either by downloading a pre-built release or by building from source.

## Option 1 — Download a Release (Recommended)

Download the latest release for your operating system from the **Releases** page.

| Platform | Package |
|----------|---------|
| Windows x64 | NSIS Installer (.exe) |
| Windows x64 | Portable (.exe) |
| macOS Apple Silicon | DMG |
| macOS Apple Silicon | ZIP |
| Linux x64 | AppImage |
| Linux x64 | DEB |
| Linux ARM64 | AppImage |
| Linux ARM64 | DEB |

Every release is built automatically using GitHub Actions.

---

## Option 2 — Build from Source

### Requirements

| Software | Version |
|----------|---------|
| Node.js | 24 LTS recommended |
| npm | Latest |
| Git | Latest |
| Ollama | Latest (optional for local inference) |

Clone the repository.

```bash
git clone https://github.com/richie-rich90454/training-generator.git

cd training-generator
```

Install dependencies.

```bash
npm install
```

---

# Running

## Development

```bash
npm run dev
```

This launches

- Vite development server
- Electron
- Hot Module Replacement
- Source maps
- Live reload

---

## Production

```bash
npm start
```

---

## Build

```bash
npm run build
```

Outputs

```
dist/
dist-main/
```

---

## Package

Build distributable desktop applications.

```bash
npm run package
```

Platform-specific packages:

```bash
npm run package:win
```

```bash
npm run package:mac
```

```bash
npm run package:linux
```

---

# First Run

A typical workflow takes less than a minute.

1. Launch Training Generator

2. Drag a document into the window

3. Choose your provider

4. Choose an output format

5. Click Generate

6. Export the finished dataset

No scripting required.

---

# Supported File Types

| Format | Read Support |
|---------|--------------|
| PDF | ✅ |
| DOCX | ✅ |
| DOC | ✅ |
| Markdown | ✅ |
| HTML | ✅ |
| TXT | ✅ |
| RTF | ✅ |

Large files are automatically processed in chunks.

---

# AI Providers

Training Generator supports multiple providers through a unified interface.

| Provider | Local | Cloud |
|----------|-------|-------|
| Ollama | ✅ | — |
| OpenAI | — | ✅ |
| Anthropic | — | ✅ |
| Google Gemini | — | ✅ |

Provider switching requires no code changes.

---

# Processing Pipeline

```
Input Document

        │

        ▼

Document Parsing

        │

        ▼

Cleaning

        │

        ▼

Semantic Chunking

        │

        ▼

Prompt Construction

        │

        ▼

Large Language Model

        │

        ▼

Validation

        │

        ▼

Deduplication

        │

        ▼

Export
```

Every stage is modular and independently testable.

---

# Example Workflow

Imagine you have

```
OperatingSystems.pdf
```

Drag it into Training Generator.

Select

```
Instruction Dataset
```

Choose

```
Ollama

↓

llama3.2
```

Press

```
Generate
```

Training Generator automatically

- extracts text
- preserves document structure
- performs semantic chunking
- generates prompts
- validates responses
- removes near duplicates
- exports JSONL

---

# Example Output

## Alpaca JSONL

```json
{
  "instruction": "Explain virtual memory.",
  "input": "",
  "output": "Virtual memory is a memory management technique..."
}
```

---

## ChatML

```json
[
  {
    "role":"system",
    "content":"You are a helpful tutor."
  },
  {
    "role":"user",
    "content":"Explain paging."
  },
  {
    "role":"assistant",
    "content":"Paging divides memory into..."
  }
]
```

---

## CSV

```text
instruction,input,output
Explain DNS,,DNS translates domain names...
```

---

## Plain Text

```text
Question:
Explain recursion.

Answer:
Recursion is a function calling itself...
```

---

# CLI Mode

Training Generator includes a fully headless command-line interface for automation.

Run

```bash
npm run cli -- [options]
```

Example

```bash
npm run cli -- \
  --input ./documents \
  --output ./datasets \
  --model llama3.2 \
  --format jsonl
```

---

# CLI Options

| Option | Description |
|---------|-------------|
| `--input` | Input file or directory |
| `--output` | Output directory |
| `--model` | LLM model |
| `--provider` | AI provider |
| `--type` | Processing mode |
| `--format` | Export format |
| `--chunk-size` | Chunk size |
| `--temperature` | Sampling temperature |
| `--language` | Output language |
| `--config` | Configuration profile |

---

# Processing Types

Training Generator supports multiple generation modes.

## Instruction Extraction

Creates

```text
Instruction

↓

Response
```

Ideal for

- fine tuning
- supervised datasets

---

## Conversation Generation

Creates

```
User

↓

Assistant

↓

User

↓

Assistant
```

Useful for

- chat models
- assistants
- roleplay datasets

---

## Semantic Chunking

Splits documents while preserving

- paragraphs
- headings
- lists
- code blocks
- tables
- context overlap

instead of blindly splitting by character count.

---

## Custom Prompt Templates

Design your own processing pipeline.

Examples

```
Summarize

Translate

Create flashcards

Generate interview questions

Extract definitions

Rewrite documentation

Generate FAQs

Create quizzes
```

without changing application code.

---

# Internationalization

Training Generator includes a complete localization framework.

Current UI languages

- English
- 简体中文
- 繁體中文
- Español
- Français
- Deutsch
- 日本語
- 한국어

Additional languages can be added without modifying application logic.

---

# Performance

Designed for very large datasets.

Highlights

✅ Background workers

✅ Parallel processing

✅ SQLite caching

✅ Lazy loading

✅ Incremental rendering

✅ Memory-efficient parsing

✅ Streaming export

Large documents containing hundreds of pages can be processed without blocking the interface.

---

# Security

Security is a core design goal.

Features include

- AES-256-GCM encrypted API keys
- Content Security Policy
- Safe IPC architecture
- Secure preload bridge
- Input sanitization
- Local-first processing
- Path traversal protection
- Provider isolation

Sensitive credentials are never stored in plaintext.

---
---

# Architecture

Training Generator is designed around a modular, layered architecture that separates the user interface, processing pipeline, AI providers, and platform-specific functionality. Each subsystem has a clearly defined responsibility, making the project easier to maintain, extend, and test.

```text
                         ┌─────────────────────────────┐
                         │        User Interface       │
                         │        (SolidJS)            │
                         └──────────────┬──────────────┘
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │      Application Stores     │
                         │ (Reactive State Management) │
                         └──────────────┬──────────────┘
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │  Processing Orchestrator    │
                         └──────────────┬──────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
  File Parsing                  AI Providers                 Export Pipeline
           │                            │                            │
           ▼                            ▼                            ▼
   Semantic Chunking          Validation & Retry          JSONL • ChatML • CSV
```

The architecture intentionally minimizes coupling between modules. Replacing a provider, exporter, or parser does not require redesigning the rest of the application.

---

# Core Design Principles

Training Generator is built around several guiding principles.

## Local First

Documents remain on your computer whenever possible.

Using Ollama allows complete offline processing without requiring third-party cloud services.

---

## Modular

Each subsystem has a single responsibility.

Examples include:

- document parsing
- chunking
- AI providers
- exporting
- caching
- logging
- validation
- localization

Each component can evolve independently.

---

## Provider Agnostic

Switching between Ollama, OpenAI, Anthropic, or Gemini should require configuration changes—not application rewrites.

Future providers can be added through the same abstraction layer.

---

## Type Safe

The entire application is written in TypeScript using strict type checking.

Advantages include:

- safer refactoring
- fewer runtime bugs
- improved editor tooling
- self-documenting interfaces

---

## Cross Platform

Training Generator is designed to provide a consistent experience on:

- Windows
- macOS (Apple Silicon)
- Linux x64
- Linux ARM64

---

# Project Structure

```text
training-generator/

├── assets/                 Application icons and images
├── docs/                   Documentation (VitePress)
├── examples/               Example datasets
├── scripts/                Build and development scripts
├── src/
│
├── cli/                    Headless command-line interface
├── core/                   Document parsers
├── prompts/                Prompt templates
├── renderer/
│   ├── components/
│   ├── processing/
│   ├── stores/
│   └── workers/
│
├── styles/
├── types/
├── workers/
│
├── tests/
│
├── package.json
├── vite.config.ts
└── tsconfig.json
```

The repository is organized to keep UI code, business logic, infrastructure, and build tooling clearly separated.

---

# Technology Stack

Training Generator uses modern tooling throughout the development process.

| Category | Technology |
|----------|------------|
| Desktop | Electron 43 |
| Language | TypeScript 7 |
| UI Framework | SolidJS 1.9 |
| Build Tool | Vite 8.1 |
| Testing | Vitest 4.1 |
| Documentation | VitePress |
| Packaging | Electron Builder |
| Runtime | Node.js 24 LTS |

Every dependency is actively maintained and selected for long-term sustainability.

---

# Why SolidJS?

Rather than relying on a virtual DOM, SolidJS uses fine-grained reactivity.

Benefits include:

- lower memory usage
- fewer unnecessary renders
- excellent responsiveness
- small runtime
- predictable state updates

This allows Training Generator to remain responsive while processing large datasets.

---

# Why Electron?

Electron provides:

- native desktop applications
- secure IPC
- mature ecosystem
- excellent cross-platform support
- filesystem access
- local AI integration

For this application, desktop-native capabilities are significantly more useful than browser-based limitations.

---

# Performance

Training Generator has been designed for large document collections.

Optimization techniques include:

- lazy loading
- worker threads
- asynchronous parsing
- streaming exports
- incremental rendering
- SQLite caching
- parallel processing
- provider rate limiting
- exponential retry with jitter

These techniques allow the UI to remain responsive during long-running operations.

---

# Scalability

The processing pipeline has no fixed assumptions about document size.

Features include:

- configurable chunk sizes
- configurable output limits
- automatic file splitting
- resumable processing
- checkpoint persistence
- provider-independent batching

The same workflow can process:

- a one-page document
- an entire textbook
- thousands of Markdown files

without requiring changes to application logic.

---

# Internationalization

Training Generator includes a complete localization framework.

Current translations include:

- English
- 简体中文
- 繁體中文
- Deutsch
- Français
- Español
- 日本語
- 한국어

Every user-facing string is designed to be translatable.

Future languages can be added without modifying UI components.

---

# Security

Security is treated as a first-class feature.

Current protections include:

## Credential Storage

API keys are encrypted using AES-256-GCM before persistence.

---

## Content Security Policy

The renderer follows a restrictive Content Security Policy to reduce attack surface.

---

## Secure IPC

Communication between the Electron main process and renderer occurs only through a controlled preload bridge.

Direct Node.js access from renderer components is avoided.

---

## Input Validation

Incoming files are validated before processing.

Examples include:

- path sanitization
- malformed document detection
- parser isolation
- safe temporary files

---

## Local Processing

When Ollama is used, documents never leave your machine.

This makes the application suitable for sensitive documents and offline workflows.

---

# Testing

Quality is maintained through automated testing.

Current test coverage includes:

- unit tests
- integration tests
- component tests
- parser tests
- processing pipeline tests
- export validation
- regression tests

The project currently contains thousands of automated tests and continues to expand.

Development emphasizes preventing regressions before new releases.

---

# Continuous Integration

Every pull request is automatically checked.

Typical CI workflow:

```text
Push

↓

Install Dependencies

↓

Type Check

↓

Run Tests

↓

Build

↓

Package

↓

Publish Release
```

Automated releases reduce manual deployment effort and improve reliability.

---

# Documentation

Comprehensive documentation is available under the `docs/` directory.

Topics include:

- User Guide
- Architecture
- Provider Configuration
- Development
- Keyboard Shortcuts
- Troubleshooting
- Configuration Reference

Documentation is generated using **VitePress**.

---

# Benchmark Goals

Training Generator is optimized for practical document-processing workloads.

Design goals include:

- responsive interface during processing
- efficient memory usage
- scalable document parsing
- deterministic exports
- reproducible datasets
- reliable long-running sessions

Performance depends on:

- selected LLM
- document complexity
- hardware
- provider latency
- available system memory

---

# Accessibility

Accessibility is an important part of the project.

Features include:

- keyboard navigation
- focus management
- ARIA support
- accessible dialogs
- high-contrast compatible UI
- screen reader support

Future releases will continue expanding accessibility coverage.

---

# Extensibility

The architecture is intentionally designed for future expansion.

Potential additions include:

- additional AI providers
- plugin system
- OCR integration
- custom exporters
- additional dataset formats
- REST API mode
- workflow automation
- cloud synchronization

The modular architecture minimizes the work required to introduce new capabilities.

---
---

# Configuration

Training Generator is highly configurable without requiring code changes. Most settings can be adjusted directly from the graphical interface or loaded from reusable configuration profiles.

## AI Provider

Choose the provider that best fits your workflow.

| Provider | Offline | API Key Required |
|-----------|:-------:|:----------------:|
| Ollama | ✅ | ❌ |
| OpenAI | ❌ | ✅ |
| Anthropic | ❌ | ✅ |
| Google Gemini | ❌ | ✅ |

Switch providers at any time without changing your project.

---

## Processing Settings

Customize how datasets are generated.

| Setting | Description |
|----------|-------------|
| Model | Select the LLM to use |
| Processing Mode | Instructions, Conversations, Chunking, Custom |
| Chunk Size | Document segmentation size |
| Temperature | Sampling temperature |
| Output Format | JSONL, ChatML, CSV, JSON, Text |
| Language | Output language |
| Max Output Items | Optional generation limit |
| Max Chunks | Processing limit |

---

## Configuration Profiles

Save frequently used settings into reusable profiles.

Examples:

```
Documentation.json

Research.json

Flashcards.json

FineTuning.json

Chatbot.json
```

This allows switching between workflows with a single click.

---

# Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl + O | Open Files |
| Ctrl + Shift + O | Open Folder |
| Ctrl + S | Export Dataset |
| Ctrl + R | Start Processing |
| Ctrl + P | Command Palette |
| Ctrl + , | Settings |
| Ctrl + L | Clear Log |
| Ctrl + Shift + D | Developer Tools |
| F11 | Toggle Fullscreen |

---

# Troubleshooting

## Ollama Cannot Be Found

Verify Ollama is running.

```bash
ollama serve
```

Check installed models.

```bash
ollama list
```

Install a model if needed.

```bash
ollama pull llama3.2
```

---

## No Models Appear

Ensure the Ollama server is reachable.

```bash
curl http://localhost:11434/api/tags
```

Windows:

```powershell
netstat -ano | findstr 11434
```

---

## GPU Not Being Used

Depending on your platform, verify that:

- GPU drivers are current
- Ollama detects GPU acceleration
- Sufficient VRAM is available
- No other application is monopolizing GPU resources

---

## Large Documents Are Slow

Possible improvements:

- Reduce chunk size
- Use a faster model
- Increase available RAM
- Enable GPU acceleration
- Close unnecessary applications

---

## Build Problems

Delete dependencies.

```bash
rm -rf node_modules
```

or on Windows

```powershell
rmdir /S node_modules
```

Reinstall.

```bash
npm install
```

---

## TypeScript Errors

Verify versions.

```bash
node --version
npm --version
tsc --version
```

Run type checking.

```bash
npm run typecheck
```

---

# FAQ

## Does Training Generator require an Internet connection?

No.

When using Ollama, the entire workflow can operate completely offline.

---

## Are my documents uploaded anywhere?

Not when using Ollama.

Cloud providers only receive data if you explicitly configure and use them.

---

## Which models are supported?

Any compatible Ollama model, including (but not limited to):

- Llama
- Qwen
- Gemma
- Phi
- DeepSeek
- Mistral

Cloud providers support their respective APIs.

---

## Can I generate datasets from entire books?

Yes.

Large documents are automatically chunked before processing.

---

## Is this suitable for RAG?

Yes.

Semantic chunking makes the generated output suitable for Retrieval-Augmented Generation workflows.

---

## Can I automate everything?

Yes.

The built-in CLI supports batch processing and scripting.

---

## Which operating systems are supported?

Official packaging is provided for:

- Windows x64
- macOS Apple Silicon
- Linux x64
- Linux ARM64

---

## Does it support plugins?

Not yet.

A plugin system is planned for a future release.

---

# Roadmap

The following roadmap reflects planned long-term development.

## Completed

- Cross-platform desktop application
- Electron architecture
- TypeScript migration
- SolidJS renderer
- Semantic chunking
- Multi-provider support
- JSONL export
- ChatML export
- CSV export
- Prompt templates
- Configuration profiles
- SQLite caching
- Background workers
- Structured logging
- Secure API key storage
- Auto-save checkpoints
- Internationalization
- CLI mode
- Automated releases
- Extensive automated testing

---

## Planned

### Dataset Improvements

- OCR integration
- Metadata extraction
- Better duplicate detection
- Automatic quality scoring
- Dataset merging

---

### AI Features

- Plugin system
- Additional providers
- Prompt chaining
- Agent workflows
- Vision model support

---

### User Experience

- Folder monitoring
- Background processing
- Workspace management
- Session history
- Improved analytics

---

### Developer Experience

- REST API mode
- SDK
- Extension API
- Import/export plugins
- Additional CLI commands

---

# Contributing

Contributions of all sizes are welcome.

Whether you are fixing a typo or implementing a major feature, your help is appreciated.

## Development Setup

Clone the repository.

```bash
git clone https://github.com/richie-rich90454/training-generator.git
```

Install dependencies.

```bash
npm install
```

Start development.

```bash
npm run dev
```

---

## Before Opening a Pull Request

Please ensure:

- Type checking passes

```bash
npm run typecheck
```

- Tests pass

```bash
npm test
```

- The project builds

```bash
npm run build
```

---

## Coding Guidelines

- Prefer readable code over clever code.
- Keep functions focused on a single responsibility.
- Add tests for new features.
- Preserve backwards compatibility when practical.
- Write meaningful commit messages.

See:

- CONTRIBUTING.md
- CODE_OF_CONDUCT.md
- SECURITY.md

for additional information.

---

# Documentation

Documentation is built with **VitePress**.

Start the documentation site locally.

```bash
npm run docs:dev
```

Build static documentation.

```bash
npm run docs:build
```

Preview locally.

```bash
npm run docs:preview
```

---

# Security

If you discover a security vulnerability, **please do not open a public issue.**

Instead, follow the responsible disclosure process described in:

```
SECURITY.md
```

---

# License

This project is licensed under the MIT License.

See:

```
LICENSE
```

for the full license text.

---

# Acknowledgements

Training Generator would not be possible without the open-source ecosystem.

Special thanks to the maintainers of:

- Electron
- SolidJS
- Vite
- TypeScript
- Vitest
- VitePress
- Ollama
- Mammoth
- PDF-Parse
- OfficeParser
- Axios
- etc.

and everyone who contributes to these projects.

---

# Star History

[![Star History Chart](https://api.star-history.com/svg?repos=richie-rich90454/training-generator&type=Date)](https://star-history.com/#richie-rich90454/training-generator&Date)

# Support the Project

If Training Generator saves you time or helps generate better AI datasets, consider:

⭐ Starring the repository

🐛 Reporting bugs

💡 Suggesting new features

📝 Improving documentation

🔧 Contributing code

Every contribution—large or small—helps improve the project.

---

<div align="center">

## Build Better AI Datasets

**From documents to high-quality training data.**

Made with ❤️ using Electron, TypeScript, SolidJS, and modern open-source technologies.

**Happy dataset building!**

</div>