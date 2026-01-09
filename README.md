# 🤖 Training Generator

[![CI](https://github.com/richie-rich90454/training-generator/actions/workflows/ci.yml/badge.svg)](https://github.com/richie-rich90454/training-generator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-39.2.7-47848F.svg)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg)](https://nodejs.org/)
[![Release](https://img.shields.io/github/v/release/richie-rich90454/training-generator?color=blue&label=latest%20release)](https://github.com/richie-rich90454/training-generator/releases)
[![Stars](https://img.shields.io/github/stars/richie-rich90454/training-generator?style=social)](https://github.com/richie-rich90454/training-generator/stargazers)

A modern desktop application built with **Electron** and **Node.js** that converts documents (PDF, DOCX, DOC, RTF, TXT, MD, HTML) into AI training data using local **Ollama** models. Process documents locally with privacy-first AI processing.

## ✨ Features

### 📁 **File Support**
- **Multi-format Processing**: PDF, DOCX, DOC, RTF, TXT, MD, and HTML files
- **Smart Text Extraction**: Advanced parsing for complex document structures
- **Large File Handling**: Support for files up to 100MB with efficient chunking

### 🧠 **AI Processing**
- **Ollama Integration**: Uses local Ollama API for private AI processing
- **Multiple Processing Types**:
  - 📝 **Instruction Extraction** (Q&A pairs for fine-tuning)
  - 💬 **Conversation Generation** (Dialog-style training data)
  - 🔪 **Text Chunking** (Intelligent document segmentation)
  - 🎨 **Custom Analysis** (User-defined prompt templates)
- **Multi-language Support**: English, Chinese, Spanish, French, German, Japanese, Korean

### 📊 **Output & Export**
- **Flexible Formats**: JSONL (Alpaca style), ChatML, CSV, Plain Text
- **Batch Processing**: Process multiple files simultaneously
- **Progress Tracking**: Real-time progress bars and detailed logging

### 🎨 **User Experience**
- **Modern UI**: Clean, responsive interface with drag & drop support
- **Native Splash Screen**: C++/WinAPI native splash screen on Windows for fast startup
- **Dark/Light Themes**: System-aware theme switching
- **Preset Management**: Save and load processing configurations
- **Real-time Preview**: Live output preview before export

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** and npm (Recommended: Node.js 24+ for best compatibility)
- **Ollama** (for AI processing) - [Download here](https://ollama.com/)

### Dependency Compatibility
All project dependencies are verified to be compatible with Node.js 18+:

| Dependency | Version | Node.js Compatibility | Purpose |
|------------|---------|----------------------|---------|
| **Electron** | ^39.2.7 | 18+ (uses Node.js 20.9.0) | Desktop application framework |
| **Vite** | ^7.3.0 | 18+ | Build tool and dev server |
| **Axios** | ^1.7.9 | 18+ | HTTP client for Ollama API |
| **html-to-text** | ^9.0.5 | 18+ | HTML document parsing |
| **mammoth** | ^1.11.0 | 18+ | DOCX document parsing |
| **officeparser** | ^3.0.0 | 18+ | DOC document parsing |
| **pdf-parse** | ^1.1.4 | 18+ | PDF document parsing |
| **rtf-parser-fixes** | ^1.3.4 | 18+ | RTF document parsing |
| **electron-builder** | ^26.0.12 | 18+ | Application packaging |

**Note**: The `fs` package (`^0.0.1-security`) is a placeholder package and works with all Node.js versions.

### Installation & Running

```bash
# Clone the repository
git clone https://github.com/richie-rich90454/training-generator.git
cd training-generator

# Install dependencies
npm install

# Start Ollama (in a separate terminal)
ollama serve

# Pull a model (example)
ollama pull llama3.2

# Run the application
npm run dev
```

### Quick Demo
```bash
# Test basic functionality
node test-app.js

# Test Ollama connection
node test-ollama.js

# Run complete system test
node test-complete.js
```

## 📖 Detailed Usage

### Development Mode
```bash
npm run dev
```
Starts Vite dev server and Electron app with hot reload. Perfect for development and testing.

### Production Mode
```bash
npm start
```
Runs the built Electron application from the distribution.

### Building for Distribution
```bash
# Build the application
npm run build

# Create platform-specific packages
npm run package           # All platforms
npm run package:win       # Windows only
npm run package:mac       # macOS only  
npm run package:linux     # Linux only
```

### Automated Release Packaging
When a new GitHub release is created, the following packages are automatically built and attached to the release:

**macOS (Apple Silicon/M-series only):**
- DMG installer (`.dmg`)
- Portable ZIP archive (`.zip`) - unpacked application bundle

**Linux (x64 & arm64):**
- AppImage (`.AppImage`) - portable executable
- Snap package (`.snap`) - universal Linux package
- DEB package (`.deb`) - Debian/Ubuntu installer

**Note:** Windows packages are not automatically built but can be created manually using `npm run package:win`.

The automated packaging workflow only runs on stable releases (skips alpha/beta tags).

## 🏗️ Project Structure

```
training-generator/
├── src/                    # Source code
│   ├── main.js            # Electron main process
│   ├── preload.js         # IPC bridge between main and renderer
│   ├── bootstrap.js       # Application bootstrap logic
│   ├── renderer/
│   │   └── main.js        # Frontend application logic
│   ├── core/
│   │   └── fileParser.js  # Multi-format document parser
│   ├── styles/
│   │   └── main.css       # Application styles
│   ├── prompts/           # AI prompt templates (multiple languages)
│   └── workers/           # Web workers for background processing
├── assets/                # Application assets (icons, fonts)
├── native-splash/         # Native C++/WinAPI splash screen (Windows)
├── index.html            # Main application window
├── vite.config.js        # Vite build configuration
├── package.json          # Project dependencies and scripts
└── README.md            # This file
```

## ⚙️ Configuration

The application provides extensive configuration options:

### Processing Settings
- **Model Selection**: Choose from available Ollama models
- **Chunk Size**: Adjust text segmentation (500-10000 characters)
- **Temperature**: Control AI creativity (0.0-1.0)
- **Output Format**: JSONL, ChatML, CSV, or Plain Text
- **Language**: Multiple output language options

### Application Preferences
- **Theme**: Auto, Light, or Dark mode
- **Window Behavior**: Remember size/position, start maximized
- **Auto-save**: Automatic preset saving
- **File Size Limits**: Configure maximum file size (10-1000MB)

### System Integration
- **Ollama Auto-detection**: Automatic connection to local Ollama instance
- **Progress Persistence**: Resume interrupted processing sessions
- **Export Location**: Remember last used export directory

## 🔧 Troubleshooting

### Common Issues & Solutions

#### 🚫 Ollama Connection Issues
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama if not running
ollama serve

# Verify service status (Windows)
netstat -ano | findstr :11434
```

#### 📄 File Parsing Problems
- **Scanned PDFs**: Use OCR software first for image-based PDFs
- **Large Files**: Reduce chunk size or split files manually
- **Encoding Issues**: Convert files to UTF-8 text format first

#### ⚡ Performance Optimization
- **GPU Acceleration**: Ensure Ollama is using GPU (check Ollama logs)
- **Memory Management**: Close other GPU-intensive applications
- **Chunk Size**: Adjust based on model context window (2000-4000 tokens optimal)

#### 🐛 Application Errors
```bash
# Clear dependencies and rebuild
npm cache clean --force
npm ci

# Check Node.js version
node --version  # Should be 18+

# Run in debug mode
npm run dev -- --debug
```

### Debug Mode
For advanced troubleshooting, enable debug logging:
```bash
npm run dev -- --debug
```
Logs are available in:
- **Windows**: Application console output
- **macOS/Linux**: `~/.config/Training Generator/logs/`

## 🧪 Testing

The project includes comprehensive test suites:

```bash
# Run all tests
npm test

# Individual test scripts
node test_language_prompts.js  # Language prompt validation
node test-app.js              # Basic application functionality
node test-complete.js         # Complete system integration test
node test-ollama.js           # Ollama connection and model testing
```

## 🛣️ Roadmap & Future Features

### Planned Enhancements
- **🔌 Plugin System**: Extensible processing pipelines
- **🌐 Cloud Integration**: Optional cloud model support (OpenAI, Anthropic, etc.)
- **📈 Advanced Analytics**: Processing statistics and quality metrics
- **🔄 Batch Scheduling**: Automated processing queues
- **🔍 Content Filtering**: Smart filtering of sensitive information

### In Development
- **🧩 Modular Architecture**: Plugin-based file parser system
- **📊 Performance Dashboard**: Real-time processing metrics
- **🔗 API Server Mode**: REST API for headless operation

### Community Requests
- **🗂️ Folder Monitoring**: Watch folders for automatic processing
- **📱 Mobile Companion**: Mobile app for remote monitoring
- **🔐 Enterprise Features**: User management, audit logging, compliance tools

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Run tests**: `npm test`
5. **Submit a pull request**

### Development Setup
```bash
# Install development dependencies
npm install

# Set up pre-commit hooks (if configured)
npm run prepare

# Start development server
npm run dev
```

### Code Style
- Use consistent formatting (Prettier configuration coming soon)
- Add comments for complex logic
- Update documentation for new features
- Include tests for new functionality

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Support

- **Documentation**: [GitHub Wiki](https://github.com/richie-rich90454/training-generator/wiki)
- **Issue Tracker**: [Report Bugs](https://github.com/richie-rich90454/training-generator/issues)
- **Discussions**: [GitHub Discussions](https://github.com/richie-rich90454/training-generator/discussions)
- **Star the Project**: [⭐ on GitHub](https://github.com/richie-rich90454/training-generator)

## 📸 Screenshots

<!--
![Main Application Interface](./screenshots/main-app.png)
*Modern interface with drag & drop file upload*

![Processing Configuration](./screenshots/configuration.png)
*Flexible processing options and model selection*

![Output Preview](./screenshots/output-preview.png)
*Real-time output preview with export options*
-->

*Screenshot placeholders - add actual screenshots to the `screenshots/` directory*

## In Development
- 🟢 Modular Architecture
- 🟡 Performance Dashboard
- 🔴 API Server Mode

---

**🔒 Privacy Note**: This application processes documents locally using your own Ollama instance. No data is sent to external servers unless you configure custom API endpoints.

**⚡ Performance Tip**: For best results, use GPU-accelerated Ollama models and ensure sufficient system memory for large documents.

**🐛 Found a Bug?** Please report it on the [issue tracker](https://github.com/richie-rich90454/training-generator/issues) with detailed steps to reproduce.
