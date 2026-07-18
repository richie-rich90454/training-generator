---
layout: home

hero:
  name: Training Generator
  text: AI Training Data Generator
  tagline: A local-first Electron + SolidJS desktop app that converts documents into instruction, conversation, and custom training datasets using Ollama or cloud LLMs. v2.0.1 adds per-file output mode and ~50 new settings.
  image:
    src: /favicon.svg
    alt: Training Generator
  actions:
    - theme: brand
      text: Quick Start
      link: /getting-started/quick-start
    - theme: alt
      text: Installation
      link: /getting-started/installation
    - theme: alt
      text: What's new in v2.0.1
      link: /configuration/output-mode.md

features:
  - icon: 📄
    title: Multi-format document parsing
    details: Extract text from PDF, DOCX, DOC, RTF, TXT, MD, and HTML. Streaming large-file handling and worker-thread PDF parsing keep the UI responsive.
  - icon: 🧠
    title: Four processing types
    details: Instruction extraction (Q&A), conversation generation, semantic chunking, and custom prompt templates across 8 languages and 32 prompt files.
  - icon: 🌐
    title: Multi-provider LLMs
    details: Switch between Ollama (local), OpenAI, Anthropic, and Google Gemini. Automatic failover to Ollama after repeated cloud failures.
  - icon: 🗂️
    title: Semantic chunking & dedup
    details: Sentence-aware chunking that preserves code blocks, tables, and lists with context overlap. Simhash-based near-duplicate removal.
  - icon: 📦
    title: Multiple export formats
    details: Export to JSONL (Alpaca), ChatML, CSV, JSON, or plain text. Large outputs are automatically split into multiple files.
  - icon: 🗃️
    title: Per-file output mode (v2.0.1)
    details: Group exports by source file with filename templates ({source}, {format}, {date}, {timestamp}, {index}) and per-source splitting. Toggle in the Settings modal or read the Output Mode guide.
  - icon: ⚡
    title: Web Worker offloading
    details: Chunking and deduplication run in background workers. SolidJS fine-grained reactivity keeps updates minimal and memory usage low.
  - icon: 🔐
    title: Secure by default
    details: AES-256-GCM encryption for API keys at rest, path-traversal prevention, CSP headers, and a local-first processing model.
  - icon: 💾
    title: Resilient & observable
    details: Auto-save checkpoints every 30s, resume support, structured JSON logging, audit trail, provenance tracking, and a live dashboard.
  - icon: 🖥️
    title: Headless CLI mode
    details: Batch-process directories from the command line with configurable provider, model, chunk size, concurrency, and proxy support.
---
