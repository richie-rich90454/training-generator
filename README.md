# Training Generator

[![CI](https://github.com/richie-rich90454/training-generator/actions/workflows/ci.yml/badge.svg)](https://github.com/richie-rich90454/training-generator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Release](https://img.shields.io/github/v/release/richie-rich90454/training-generator?color=blue&label=latest%20release)](https://github.com/richie-rich90454/training-generator/releases)
[![Stars](https://img.shields.io/github/stars/richie-rich90454/training-generator?style=social)](https://github.com/richie-rich90454/training-generator/stargazers)
[![Last Commit](https://img.shields.io/github/last-commit/richie-rich90454/training-generator)](https://github.com/richie-rich90454/training-generator/commits/main)
[![Build Status](https://img.shields.io/github/actions/workflow/status/richie-rich90454/training-generator/ci.yml?branch=main)](https://github.com/richie-rich90454/training-generator/actions/workflows/ci.yml)

---

### Built With

[![Electron](https://img.shields.io/badge/Electron-42.3.3-47848F.svg)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646cff.svg)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-4.1-6E9F18.svg)](https://vitest.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg)](https://nodejs.org/)
[![Ollama](https://img.shields.io/badge/Ollama-Local%20AI-9cf)](https://ollama.com/)

**Training Generator** is a production-grade, cross-platform **desktop application** built with **Electron** and **TypeScript** that converts documents (PDF, DOCX, DOC, RTF, TXT, MD, HTML) into **AI training data** using local or cloud LLM providers. Supports instruction extraction, Q&A generation, conversation datasets, and custom processing — all with enterprise-grade security, observability, and resilience.

---

## Features

### File Processing
- **Multi-format Support**: PDF, DOCX, DOC, RTF, TXT, MD, HTML
- **Smart Text Extraction**: Advanced parsing preserving document structure
- **Large File Handling**: Efficient chunking with configurable limits and automatic file splitting

### AI Processing
- **Multi-Provider Architecture**: Ollama, OpenAI, Anthropic, Google Gemini
- **Processing Types**:
  - Instruction Extraction (Q&A pairs for fine-tuning)
  - Conversation Generation (dialog-style training data)
  - Semantic Chunking (intelligent document segmentation)
  - Custom Analysis (user-defined prompt templates)
- **Semantic Chunking**: Preserves words, sentences, tables, code blocks, and lists with context overlap
- **Simhash Deduplication**: Near-duplicate detection with configurable thresholds
- **Token-Efficient Prompts**: 32 templates across 8 languages with full-attention (max_tokens=16384) and 50-60% prompt compaction

### Multi-Language
- **8 Languages**: English, Chinese (Simplified), Chinese (Traditional), Spanish, French, German, Japanese, Korean
- Full i18n framework with locale detection and dynamic UI translation
- **Complete UI coverage**: every user-facing string is translatable, including command palette labels, prompt editor controls, dataset preview actions, analytics dashboard metrics, file parser errors, log messages, toast notifications, confirmation dialogs, exporter content, devtools units, and splash screen text

### Output & Export
- **Multiple Formats**: JSONL (Alpaca), ChatML, CSV, JSON, Plain Text
- **Batch Processing**: Process multiple files simultaneously with parallel worker pools
- **Quality Validation**: Automatic quality scoring and validation of generated data
- **Provenance Tracking**: Full lineage tracking from source document to output item

### Performance
- **Web Worker Offloading**: Chunking and deduplication run in background workers
- **Virtual Scrolling**: Efficient rendering of large output lists
- **SQLite Caching**: Persistent cache with eviction policies
- **Exponential Backoff**: Retry with jitter for API resilience
- **Rate Limiting**: Configurable rate limits per provider
- **Memory-Efficient Processing**: Streaming and batching for large datasets

### Security
- **AES-256-GCM Encryption**: API key encryption at rest
- **Input Sanitization**: Path traversal prevention and safe file I/O
- **CSP Headers**: Content Security Policy enforcement
- **Local-First**: All processing runs locally by default — no data leaves your machine

### Resilience
- **Auto-Save Checkpoints**: State persisted every 30 seconds with resume support
- **Structured JSON Logging**: Log levels, rotation, and file output
- **Audit Trail**: Full event logging for compliance and debugging
- **Observability Dashboard**: Real-time processing metrics and statistics
- **Error Recovery**: Graceful degradation and error boundary handling

### User Experience
- **Modern UI**: Clean, responsive interface with drag & drop
- **Dark/Light Themes**: System-aware theme switching
- **Toast Notifications**: Non-intrusive user feedback
- **Resizable Panels**: Adjustable split-pane layout
- **Skeleton Loading States**: Perceived performance improvements
- **Keyboard Shortcuts**: Full keyboard navigation support
- **ARIA Accessibility**: Screen reader support and focus management
- **Focus Trapping**: Modal dialog accessibility
- **Confirmation Dialogs**: Critical action safeguards
- **Native Tray Icon**: Background-less, platform-specific raster icons for Windows, macOS and Linux

### Developer Experience
- **Headless CLI Mode**: Batch processing and automation via command line
- **Config Profiles**: Save and load named processing configurations
- **Template Editor**: Visual prompt template editing
- **Developer Tools Panel**: Diagnostics, state inspection, and debugging
- **Service Worker**: Offline app shell caching
- **Lazy Loading**: On-demand module loading for settings and help

### Testing
- **3328+ Tests**: 139 test files covering unit, integration, and system tests
- **TypeScript Strict Mode**: Full type safety with `tsc --noEmit`
- **CI/CD**: Automated testing and release packaging via GitHub Actions

---

## Quick Start

### Prerequisites
- **Node.js 18+** (Recommended: Node.js 24+)
- **Ollama** (for local AI processing) — [Download](https://ollama.com/)

### Installation

```bash
git clone https://github.com/richie-rich90454/training-generator.git
cd training-generator
npm install
```

### Running

```bash
# Start Ollama (separate terminal)
ollama serve

# Pull a model
ollama pull llama3.2

# Development mode (hot reload)
npm run dev

# Production mode
npm start

# CLI mode (headless)
npm run cli -- --input ./docs --output ./output --model llama3.2
```

---

## Usage

### GUI Mode

```bash
npm run dev       # Development with hot reload
npm start         # Production build
```

### CLI Mode

```bash
npm run cli -- [options]

Options:
  --input <path>       Input file or directory
  --output <path>      Output directory
  --model <name>       Ollama model name (default: llama3.2)
  --type <type>        Processing type: instruction|conversation|chunking|custom
  --format <format>    Output format: jsonl|chatml|csv|json|text
  --language <lang>    Output language code (e.g., en, zh-Hans, ja)
  --config <path>      Config profile JSON file
  --chunk-size <n>     Characters per chunk (default: 2000)
  --temperature <n>    Model temperature 0.0-1.0 (default: 0.7)
```

### Building

```bash
npm run build           # Build application
npm run package         # Package all platforms
npm run package:win     # Windows only
npm run package:mac     # macOS only
npm run package:linux   # Linux only
```

### Testing

```bash
npm test                # Run all tests (565+ tests)
npm run test:watch      # Watch mode
npm run typecheck       # TypeScript strict type checking
```

---

## Project Structure

```
training-generator/
├── src/
│   ├── main.ts              # Electron main process + IPC handlers
│   ├── preload.ts           # Secure context bridge APIs
│   ├── bootstrap.ts         # Application bootstrap
│   ├── sw.ts                # Service Worker (offline caching)
│   ├── splash.html          # Native C++ splash screen
│   ├── cli/
│   │   ├── index.ts         # Headless CLI entry point
│   │   └── provider.ts      # CLI provider configuration
│   ├── core/
│   │   ├── fileParser.ts    # Multi-format document parser
│   │   └── fileParserLazy.ts # Lazy-loaded parser variant
│   ├── renderer/
│   │   ├── app.ts           # Main application entry point
│   │   ├── provider.ts      # Multi-provider abstraction (Ollama, OpenAI, Anthropic, Gemini)
│   │   ├── processor.ts     # Processing pipeline orchestration
│   │   ├── chunker.ts       # Semantic chunking with context overlap
│   │   ├── deduplicator.ts  # Simhash-based near-duplicate detection
│   │   ├── cache.ts         # SQLite caching with persistence
│   │   ├── promptManager.ts # Multi-language prompt template management
│   │   ├── fileManager.ts   # File drag-drop, selection, validation
│   │   ├── outputManager.ts # Output formatting and export
│   │   ├── uiManager.ts     # UI state, modals, themes, tooltips
│   │   ├── statsTracker.ts  # Processing statistics aggregation
│   │   ├── i18n.ts          # Internationalization framework (8 languages)
│   │   ├── toast.ts         # Toast notification system
│   │   ├── virtualList.ts   # Virtual scrolling for large lists
│   │   ├── confirm.ts       # Confirmation modal dialogs
│   │   ├── settingsPanel.ts # Settings management
│   │   ├── helpContent.ts   # Lazy-loaded help content
│   │   ├── logger.ts        # Structured JSON logging
│   │   ├── security.ts      # AES-256-GCM encryption, input sanitization
│   │   ├── checkpoint.ts    # Auto-save state (30s interval)
│   │   ├── audit.ts         # Audit trail and event logging
│   │   ├── provenance.ts    # Output lineage tracking
│   │   ├── qualityValidator.ts # Training data quality validation
│   │   ├── rateLimiter.ts   # API rate limiting with backoff
│   │   ├── dashboard.ts     # Real-time observability dashboard
│   │   ├── devtools.ts      # Developer diagnostics panel
│   │   ├── configProfiles.ts # Named configuration profiles
│   │   ├── templateEditor.ts # Visual prompt template editor
│   │   ├── exportFormats.ts # Multi-format export definitions
│   │   └── workers/
│   │       ├── chunk.worker.ts  # Web Worker for chunking
│   │       ├── dedup.worker.ts  # Web Worker for deduplication
│   │       └── workerPool.ts    # Worker pool management
│   ├── prompts/             # 32 prompt templates (8 languages x 4 types)
│   ├── styles/
│   │   └── main.css         # Application styles with a11y support
│   ├── types/
│   │   ├── index.ts         # Core type definitions
│   │   ├── interfaces.ts    # Application state interfaces
│   │   ├── ipc.ts           # IPC channel type contracts
│   │   ├── electron.d.ts    # Electron API type extensions
│   │   └── modules.d.ts     # Module declaration types
│   └── workers/
│       └── pdfWorker.ts     # PDF parsing worker
├── tests/                   # 139 test files, 3328+ tests
├── assets/                  # Icons, fonts, favicons
├── native-splash/           # Native C++/WinAPI splash screen (Windows)
├── examples/                # Sample documents for testing
├── index.html              # Main application window
├── vite.config.ts          # Vite build configuration
├── vitest.config.ts        # Vitest test configuration
├── jest.config.ts          # Jest test configuration
├── tsconfig.json           # TypeScript configuration (strict mode)
└── package.json            # Dependencies and scripts
```

---

## Configuration

### Processing Settings
- **Model Selection**: Choose from available Ollama/cloud models
- **Chunk Size**: Adjust text segmentation (500-10000 characters)
- **Temperature**: Control AI creativity (0.0-1.0)
- **Output Format**: JSONL, ChatML, CSV, JSON, Plain Text
- **Language**: 8 output languages
- **Max Output Items**: Configurable limit with automatic file splitting
- **Max Chunks**: Configurable maximum chunks per processing run

### Application Preferences
- **Theme**: Auto, Light, or Dark mode
- **Window Behavior**: Remember size/position, start maximized
- **Config Profiles**: Save and load named configuration presets
- **File Size Limits**: Configure maximum file size

### Provider Configuration
- **Ollama**: Local auto-detection with custom endpoint support
- **OpenAI**: API key with AES-256-GCM encryption
- **Anthropic**: API key with secure storage
- **Google Gemini**: API key with secure storage

### System Integration
- **Auto-Save**: State persisted every 30 seconds
- **Resume Support**: Recover from interrupted sessions
- **Export Location**: Remember last used directory

---

## Troubleshooting

### Ollama Connection

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve

# Verify on Windows
netstat -ano | findstr :11434
```

### File Parsing Issues
- **Scanned PDFs**: Use OCR software first for image-based PDFs
- **Large Files**: Reduce chunk size or split files manually
- **Encoding Issues**: Convert files to UTF-8 first

### Performance Optimization
- **GPU Acceleration**: Ensure Ollama is using GPU
- **Memory Management**: Close other GPU-intensive applications
- **Chunk Size**: Adjust based on model context window

### Debug Mode

```bash
npm run dev -- --debug
```

Logs are available at:
- **Windows**: Application console output
- **macOS/Linux**: `~/.config/Training Generator/logs/`

---

## Documentation

For detailed information about using and developing Training Generator, see the guides in the [`docs/`](docs/) folder:

- [`docs/README.md`](docs/README.md) — Documentation overview
- [`docs/user-guide.md`](docs/user-guide.md) — User guide
- [`docs/configuration.md`](docs/configuration.md) — Configuration reference
- [`docs/providers.md`](docs/providers.md) — Provider setup
- [`docs/architecture.md`](docs/architecture.md) — Architecture overview
- [`docs/development.md`](docs/development.md) — Development guide
- [`docs/troubleshooting.md`](docs/troubleshooting.md) — Troubleshooting
- [`docs/keyboard-shortcuts.md`](docs/keyboard-shortcuts.md) — Keyboard shortcuts

---

## Roadmap

### Completed
- Multi-provider architecture (Ollama, OpenAI, Anthropic, Gemini)
- Semantic chunking with context preservation
- Simhash deduplication
- SQLite caching with persistence
- 8-language i18n framework with full UI string coverage
- AES-256-GCM API key encryption
- Structured JSON logging
- Auto-save checkpointing (30s)
- Audit trail and provenance tracking
- Headless CLI mode
- Web Worker offloading
- Virtual scrolling
- Toast notifications
- ARIA accessibility
- Service Worker offline caching
- Transparent, background-less tray icon
- 3328+ test suite

### Planned
- Plugin system for extensible processing pipelines
- Folder monitoring for automatic batch processing
- Advanced analytics and quality metrics
- REST API server mode for remote operation
- Mobile companion app for monitoring

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run typecheck: `npm run typecheck`
6. Submit a pull request

### Development Setup

```bash
npm install
npm run dev
```

### Code Style
- TypeScript strict mode enforced
- Consistent formatting
- Add comments for complex logic
- Include tests for new functionality

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Support

- **Documentation**: [GitHub Wiki](https://github.com/richie-rich90454/training-generator/wiki)
- **Issues**: [Report Bugs](https://github.com/richie-rich90454/training-generator/issues)
- **Discussions**: [GitHub Discussions](https://github.com/richie-rich90454/training-generator/discussions)
- If this project helps you, please star the repo!

---

**Privacy Note**: This application processes documents locally using your own Ollama instance. No data is sent to external servers unless you configure cloud API endpoints.

**Performance Tip**: For best results, use GPU-accelerated Ollama models and ensure sufficient system memory for large documents.