# Training Generator

A desktop application built with Electron and Node.js that converts documents (PDF, DOCX, DOC, RTF, TXT, MD, HTML) into AI training data using Ollama-run models to summarize and output the data.

## Features

- **Multi-format Support**: Process PDF, DOCX, DOC, RTF, TXT, MD, and HTML files
- **Ollama Integration**: Uses local Ollama API for AI processing
- **Flexible Output Formats**: Export as JSONL, JSON, CSV, or plain text
- **Smart Chunking**: Automatically splits large documents into manageable chunks
- **Multiple Processing Types**:
  - Instruction extraction (Q&A pairs)
  - Conversation generation
  - Text summarization
  - Custom analysis
- **Modern UI**: Clean, responsive interface with drag & drop support
- **Progress Tracking**: Real-time progress and logging

## Requirements

- **Node.js** 18+ and npm
- **Ollama** (for AI processing) - [Download here](https://ollama.com/)

## Installation

1. **Clone or download the repository**
   ```bash
   git clone https://github.com/richie-rich90454/training-generator.git
   cd training-generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install and run Ollama** (if not already installed)
   ```bash
   # Download from https://ollama.com/
   # Run Ollama in the background
   ollama serve
   
   # Pull a model (example)
   ollama pull llama3.2
   ```

## Usage

### Development Mode
```bash
npm run dev
```
Starts Vite dev server and Electron app with hot reload.

### Production Mode
```bash
npm start
```
Runs the built Electron application.

### Building for Distribution
```bash
npm run build
npm run package
```
Creates distributable packages for Windows, macOS, and Linux.

## How It Works

1. **Add Files**: Drag & drop or browse for documents
2. **Configure**: Select model, processing type, and output format
3. **Process**: App extracts text, chunks it, sends to Ollama for processing
4. **Export**: Save results in your preferred format for model training

### Supported File Formats
- **PDF**: Using pdf-parse library
- **DOCX**: Using mammoth library  
- **DOC**: Using officeparser library
- **RTF**: Using rtf-parser-fixes library
- **TXT/MD**: Plain text extraction
- **HTML**: HTML to text conversion

### Output Formats
- **JSONL**: Standard format for AI training (Alpaca style)
- **JSON**: Structured JSON data
- **CSV**: Comma-separated values
- **Text**: Plain text output

## Project Structure

```
training-generator/
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # IPC bridge
│   ├── renderer/
│   │   └── main.js          # Frontend application logic
│   ├── core/
│   │   └── fileParser.js    # Multi-format file parser
│   ├── styles/
│   │   └── main.css         # Application styles
│   └── workers/             # (Optional) Web workers
├── index.html               # Main HTML file
├── vite.config.js           # Vite configuration
├── package.json             # Project dependencies
└── README.md               # This file
```

## Configuration

The application saves your preferences automatically:
- Selected model
- Processing type
- Output format
- Chunk size

Settings are stored in localStorage and persist between sessions.

## Troubleshooting

### Ollama Not Detected
1. Ensure Ollama is installed and running: `ollama serve`
2. Check if Ollama API is accessible: `curl http://localhost:11434/api/tags`
3. Restart the application after starting Ollama
4. On Windows, make sure Ollama is running as a service or in the background
5. Check firewall settings - Ollama uses port 11434

### File Parsing Issues
- Some complex PDFs may not extract text perfectly (especially scanned/image-based PDFs)
- Try converting problematic files to TXT format first
- Check file permissions and paths
- For large PDFs (>20MB), processing may take longer
- Ensure you have read permissions for the files you're trying to process

### Performance Tips
- Start with smaller files to test the workflow
- Adjust chunk size based on your model's context window (2000-4000 tokens is typical)
- Use lighter models (like llama3.2) for faster processing
- Close other GPU-intensive applications when processing large files
- Monitor GPU memory usage with tools like NVIDIA System Monitor

### Common Errors and Solutions

**"Ollama is not running"**
- Start Ollama: `ollama serve`
- Check if port 11434 is in use: `netstat -ano | findstr :11434` (Windows) or `lsof -i :11434` (macOS/Linux)
- Restart Ollama service

**"Failed to extract text from PDF"**
- The PDF might be scanned or image-based
- Use OCR software to convert to text first
- Try a different PDF file to test

**"Processing takes too long"**
- Reduce chunk size in settings
- Use a smaller model
- Check if Ollama is using GPU acceleration (should show GPU usage in Ollama logs)

**"Application crashes on startup"**
- Check Node.js version (requires 18+)
- Reinstall dependencies: `npm ci`
- Clear npm cache: `npm cache clean --force`

**"No models found in Ollama"**
- Pull a model: `ollama pull llama3.2`
- Check available models: `ollama list`
- Restart Ollama after pulling models

### Debug Mode
For advanced troubleshooting, you can run the application with debug logging:

```bash
# Development mode with debug
npm run dev -- --debug

# Check application logs
# On Windows: Check console output
# On macOS/Linux: Check ~/.config/Training Generator/logs/
```

### Testing Your Setup
Run the included test scripts to verify your installation:

```bash
# Basic functionality test
node test-app.js

# Complete system test
node test-complete.js

# Ollama connection test
node test-ollama.js
```

### Getting Help
If issues persist:
1. Check the console output for error messages
2. Run the test scripts to identify specific problems
3. Check the GitHub repository for known issues
4. Create a new issue with detailed error messages and system information

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For issues and feature requests, please use the GitHub issue tracker.

---

**Note**: This application processes documents locally. No data is sent to external servers unless you configure custom Ollama endpoints.
