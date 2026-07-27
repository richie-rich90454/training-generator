# Changelog

All notable changes to Training Generator are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-07-18

v2.0.1 is a polish-and-polish release. It ships one new user-facing feature
(per-file output mode), expands the settings surface by roughly fifty
user-adjustable fields, and lands more than one thousand bug-fix commits across
the UI, i18n, runtime, generation, parsing, exporters, stores, IPC, workers,
and core modules. The release is purely additive relative to v2.0.0 — no
existing behavior is removed.

### Added

#### Features
- **Per-file output mode.** A new `outputFileMode` setting
  (`'combined' | 'perFile'`) lets the user choose between one combined export
  file for the entire work queue (the v2.0.0 default) or one export file per
  source file. In `perFile` mode, each input file produces its own export named
  after the source (for example `report.pdf` becomes `report.jsonl`), and
  sources that produced zero items are skipped with a logged warning instead of
  writing empty files.
- **Filename template for per-file mode.** The `outputFilenameTemplate` setting
  accepts the placeholders `{source}`, `{format}`, `{date}`, `{timestamp}`, and
  `{index}`. The default template is `{source}`. Invalid path characters are
  sanitized automatically.
- **Output mode toggle in the UI.** The ConfigPanel and the SettingsModal both
  expose `outputFileMode` with two-way binding to `settingsStore`. The choice
  takes effect immediately, with no restart required.
- **Comprehensive settings panel expansion.** The SettingsModal now exposes
  every field in `FullAppSettings` in logically grouped, searchable sections:
  Appearance, Processing, Export, Output Mode, Generation, Validation,
  Providers, Telemetry and Privacy, Advanced, and Experimental. Each setting
  has a help tooltip, a default reset button, and inline validation.

#### Settings (new fields in `AppSettings` and `FullAppSettings`)
- Output mode and export controls: `outputFileMode`, `outputFilenameTemplate`,
  `confirmBeforeExport`, `autoExportOnCompletion`, `maxItemsPerFile`,
  `stripPiiBeforeExport`, `includeSourceMetadata`.
- Appearance and accessibility: `fontScale`, `compactMode`, `reducedMotion`,
  `highContrast`, `customCssPath`, `verboseDashboard`.
- Telemetry and updates: `disableTelemetry`, `disableCrashReports`,
  `disableAutoUpdate`, `updateCheckIntervalHours`.
- System and window: `gpuAcceleration`, `sendToTrayOnClose`, `startOnLogin`.
- Cache: `cacheDir`, `cacheMaxSizeMB`, `cacheTtlSeconds`, `clearCacheOnExit`.
- Generation tuning: `retryCount`, `retryBackoffStrategy`, `requestTimeoutMs`,
  `streamTimeoutMs`, `abortOnError`, `topP`, `topK`, `repeatPenalty`, `seed`,
  `systemPromptOverride`, `stopSequences`, `bannedPhrases`, `requiredPhrases`.
- Chunking: `minChunkLength`, `maxChunkLength`, `chunkOverlap`,
  `sentenceAwareChunking`, `preserveCodeBlocks`, `languageDetection`,
  `outputLanguageOverride`.
- Validation: `skipDedup`, `dedupSimilarityThreshold`, `minQaPairsPerFile`,
  `maxQaPairsPerFile`, `validationStrictness`, `autoRegenerateOnLowQuality`,
  `regenerateThreshold`, `maxRegenerationAttempts`.
- Logging: `logToFile`, `logFilePath`.

#### Documentation
- New `docs/configuration/output-mode.md` reference for per-file output mode.
- New `docs/configuration/settings-reference.md` documenting every setting
  field, type, default, and the version it was introduced.
- New `docs/development.md` developer guide.
- README overhaul with badges, feature table, quick-start, roadmap, FAQ,
  star call-to-action, social-share buttons, and SEO keywords.
- CONTRIBUTING modernization with quick-start, code style, testing, PR
  checklist, and recognition.
- Every doc under `docs/` audited and updated for v2.0.1 accuracy.

#### Output item metadata
- Every `TrainingItem` now carries `sourceFile` metadata (the originating input
  file path or name) so per-file export can group items. The metadata is
  present in combined exports only when `includeSourceMetadata` is true; per-file
  mode always uses it for grouping but strips it from output unless the setting
  is on.

### Changed
- `package.json` version bumped from `2.0.0` to `2.0.1`.
- `exportOutput` in `outputStore.ts` now branches on
  `settingsStore.outputFileMode()`. When `perFile`, it groups items by their
  `sourceFile` metadata and writes one file per source using the filename
  template. When `combined`, behavior is unchanged from v2.0.0.
- The settings store migration logic now seeds sensible defaults for all new
  v2.0.1 fields so existing persisted settings remain backward-compatible.
- Documentation test counts updated to reflect the current 4,868-test suite.

### Fixed

v2.0.1 lands more than one thousand individual bug-fix commits. The categories
below summarize the scope; the commit history contains the per-bug detail.

#### UI and UX
- Visual coherence: spacing, alignment, color tokens, focus rings, and
  scrollbars unified through a single design-token system.
- Accessibility: ARIA labels on every icon-only button, keyboard navigation for
  every interactive element, visible focus rings, screen-reader labels, and
  contrast ratios brought up to WCAG AA.
- Responsiveness: viewport overflow fixed at narrow widths down to 1024x600.
- Animation jank, z-index stacking, modal and dialog focus trapping, toast
  stacking, empty and loading and error states, skeleton loaders, and microcopy
  clarity addressed across the renderer.
- Dark-mode parity with light mode, high-contrast theme support, reduced-motion
  support, and RTL layout correctness verified.

#### Internationalization
- All eight locales (en, zh-Hans, zh-Hant, ja, ko, es, fr, de) audited for
  missing keys, mismatched placeholders, and hardcoded strings in components.
- Pluralization, number and date formatting, locale fallback chain, and i18n
  key consistency across `.tsx` files verified. The i18n test suite asserts
  100% key coverage across all locales.

#### Runtime
- Crash-on-startup, out-of-memory, unhandled promise rejection, IPC deadlock,
  worker leak, timer and listener leak, race condition, file-handle leak,
  memory-heap growth, renderer freeze, and main-process hang defects resolved.

#### Generation
- Prompt construction, stream token assembly, abort correctness, retry storms,
  partial-output corruption, model-list drift, provider-switching state leaks,
  concurrency-limit violations, checkpoint resume correctness, and incremental
  processing correctness addressed.
- Ensemble, chain-of-thought, tree-of-thought, multi-hop, and self-consistency
  generation paths verified.

#### Parsing
- Empty files, very large files, BOM, CRLF, mixed encodings (UTF-8, UTF-16,
  Shift-JIS, GB18030), corrupt PDFs, password-protected files, scanned PDFs,
  nested archives, epub with broken manifests, pptx with embedded media, xlsx
  with merged cells, code files with mixed CJK, HTML with scripts, Markdown
  with frontmatter, JSON with nested arrays, and CSV with embedded newlines
  handled robustly.
- YouTube transcript fetching, web fetcher timeout and retry, and audio and
  video transcription fallback hardened.

#### Exporters and validators
- All exporters (JSONL, ChatML, CSV, TXT, MD, Alpaca, ShareGPT, OpenAI
  fine-tune, HuggingFace, AutoML, JSON Schema, spreadsheet, document) audited
  for serialization correctness, escaping, encoding, empty-input handling,
  large-output streaming, and format-spec compliance.
- All validators audited for error reporting, threshold correctness, and
  false-positive and false-negative reduction.

#### Stores and state
- `appStore`, `uiStore`, `outputStore`, `settingsStore`, and `fileStore`
  audited for reactivity, persistence, migration, defaults, race conditions,
  polling cleanup, and signal disposal.

#### IPC and main process
- Channel consistency, error forwarding, stream cleanup, security hardening
  (CSP, context isolation, sandbox, preload exposure surface), single-instance
  lock, exception handlers, file-dialog correctness, and save-file atomicity
  verified.

#### Workers and chunker
- Worker pool lifecycle, restart rate limiting, transferable correctness,
  chunk boundary correctness, sentence splitting, overlap handling, and dedup
  correctness addressed.

#### Core modules
- Every file under `src/core/` audited for error handling, edge cases,
  security, and performance.

### Performance
- Lazy loading of non-critical modules to reduce startup time.
- Debounced and throttled UI updates to prevent renderer freeze during
  generation.
- Virtualized long lists in the output preview.
- File streaming and cache tuning to keep memory bounded during large jobs.
- Memoization and reduced re-render scope to lower memory usage.
- Worker offloading for chunking and deduplication.
- Bundle-size reduction.

### Stability
- Error boundaries and graceful degradation across the renderer.
- Retry and circuit-breaker behavior for provider requests.
- Resource caps and backpressure for long-running jobs.
- Dead-letter queues, health checks, and bounded concurrency.

## [2.0.0] - 2026-01-15

Initial public release of the comprehensive bug-audit pass. See the v2.0.0
release notes for the full changelog.

[2.0.1]: https://github.com/richie-rich90454/training-generator/releases/tag/v2.0.1
[2.0.0]: https://github.com/richie-rich90454/training-generator/releases/tag/v2.0.0
