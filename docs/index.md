---
layout: home

hero:
  name: Training Generator
  text: AI Training Data Generator
  tagline: A local-first Electron and SolidJS desktop app that converts documents into instruction, conversation, and custom training datasets using Ollama or cloud LLMs. Version 2.0.1 adds per-file output mode and roughly 50 new settings.
  image:
    src: /favicon.svg
    alt: Training Generator logo
  actions:
    - theme: brand
      text: Quick Start
      link: /getting-started/quick-start
    - theme: alt
      text: Installation
      link: /getting-started/installation
    - theme: alt
      text: What Is New in v2.0.1
      link: /configuration/output-mode

features:
  - icon:
      src: /favicon.svg
      alt: Documents
    title: Multi-format document parsing
    details: Extract text from PDF, DOCX, DOC, RTF, TXT, MD, and HTML. Streaming large-file handling and worker-thread PDF parsing keep the UI responsive.
  - icon:
      src: /favicon.svg
      alt: Processing
    title: Four processing types
    details: Instruction extraction, conversation generation, semantic chunking, and custom prompt templates across eight languages and 32 prompt files.
  - icon:
      src: /favicon.svg
      alt: Providers
    title: Multi-provider LLMs
    details: Switch between Ollama local inference, OpenAI, Anthropic, and Google Gemini. Automatic failover to Ollama after repeated cloud failures.
  - icon:
      src: /favicon.svg
      alt: Chunking
    title: Semantic chunking and deduplication
    details: Sentence-aware chunking preserves code blocks, tables, and lists with context overlap. Simhash-based near-duplicate removal cleans the dataset.
  - icon:
      src: /favicon.svg
      alt: Export
    title: Multiple export formats
    details: Export to JSONL Alpaca, ChatML, CSV, JSON, or plain text. Large outputs split automatically into multiple files.
  - icon:
      src: /favicon.svg
      alt: Per-file output
    title: Per-file output mode
    details: Group exports by source file with filename templates and per-source splitting. Toggle it in the Settings modal or read the Output Mode guide.
  - icon:
      src: /favicon.svg
      alt: Performance
    title: Web Worker offloading
    details: Chunking and deduplication run in background workers. SolidJS fine-grained reactivity keeps updates minimal and memory usage low.
  - icon:
      src: /favicon.svg
      alt: Security
    title: Secure by default
    details: AES-256-GCM encryption for API keys at rest, path-traversal prevention, renderer sandboxing, and a local-first processing model.
  - icon:
      src: /favicon.svg
      alt: Resilience
    title: Resilient and observable
    details: Auto-save checkpoints every 30 seconds, resume support, structured JSON logging, audit trail, provenance tracking, and a live dashboard.
  - icon:
      src: /favicon.svg
      alt: CLI
    title: Headless CLI mode
    details: Batch-process directories from the command line with configurable provider, model, chunk size, concurrency, and proxy support.
---
