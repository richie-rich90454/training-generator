---
title: Settings Reference
description: Every field in AppSettings and FullAppSettings with type, default, description, and the version it was introduced.
outline: [2, 3]
---

# Settings Reference

This page documents every field in the `AppSettings` and `FullAppSettings` interfaces (defined in `src/types/interfaces.ts`). Use it as the authoritative reference when configuring Training Generator from the Settings modal, configuration profiles, or the CLI config file.

::: tip How settings are stored
- The configuration panel state is persisted under `train-generator-settings` in `localStorage`.
- The Settings modal state is persisted under `training-generator-app-settings`.
- Named profiles are persisted under `train-generator-profiles`.
All v2.0.1 fields seed sensible defaults so existing persisted settings remain backward-compatible.
:::

## Legend

- **Type** — the TypeScript type as declared on the interface.
- **Default** — the value used when the field is absent or `undefined`.
- **Since** — the version the field was introduced. Fields marked `2.0.0` existed before v2.0.1. Fields marked `2.0.1` are new in this release.
- **Control** — where the field is exposed in the UI (ConfigPanel = right column, Modal = Settings modal, CLI = config file only).

---

## Output mode and export controls

These fields control how generated items are grouped and written during export. See [Output Mode](/configuration/output-mode.md) for the full feature guide.

| Field | Type | Default | Since | Control | Description |
| --- | --- | --- | --- | --- | --- |
| `outputFileMode` | `'combined' \| 'perFile'` | `'combined'` | 2.0.1 | ConfigPanel, Modal | `combined` writes all items to one file (v2.0.0 behavior). `perFile` writes one file per source document. |
| `outputFilenameTemplate` | `string` | `'{source}'` | 2.0.1 | Modal | Filename template for per-file exports. Placeholders: `{source}`, `{format}`, `{date}`, `{timestamp}`, `{index}`. |
| `confirmBeforeExport` | `boolean` | `false` | 2.0.1 | Modal | When true, shows a confirmation dialog before writing exports. |
| `autoExportOnCompletion` | `boolean` | `false` | 2.0.1 | Modal | When true, triggers export automatically after a run completes. |
| `maxItemsPerFile` | `number` | `50000` | 2.0.1 | Modal | Maximum items per output file. Per-source outputs exceeding this are split into numbered parts. |
| `stripPiiBeforeExport` | `boolean` | `false` | 2.0.1 | Modal | Tags items for PII stripping by the exporter pipeline before writing. |
| `includeSourceMetadata` | `boolean` | `false` | 2.0.1 | Modal | When true, includes `sourceFile`, `sourceFileIndex`, and `generatedAt` in exported items. Per-file mode always uses `sourceFile` for grouping but strips it unless this is true. |

---

## Appearance and accessibility

| Field | Type | Default | Since | Control | Description |
| --- | --- | --- | --- | --- | --- |
| `theme` | `string` | `'auto'` | 2.0.0 | Modal | Color scheme: `'auto'` (system), `'light'`, or `'dark'`. |
| `fontSize` | `string` | `'medium'` | 2.0.0 | Modal | UI font size: `'small'`, `'medium'`, or `'large'`. |
| `fontScale` | `number` | `100` | 2.0.1 | Modal | Font scale percentage (for example `90` for 90%, `110` for 110%). Overrides `fontSize` when set away from 100. |
| `compactMode` | `boolean` | `false` | 2.0.1 | Modal | Tightens spacing and padding throughout the UI for denser layouts. |
| `reducedMotion` | `boolean` | `false` | 2.0.1 | Modal | Disables non-essential animations. Respects the OS `prefers-reduced-motion` preference when left at default. |
| `highContrast` | `boolean` | `false` | 2.0.1 | Modal | Enables the high-contrast theme for improved legibility. |
| `customCssPath` | `string` | `''` | 2.0.1 | Modal | Path to a custom CSS file injected into the renderer for advanced theming. |
| `verboseDashboard` | `boolean` | `false` | 2.0.1 | Modal | Surfaces additional metrics (token rates, cache hit ratio, worker queue depth) in the dashboard. |
| `density` | `'compact' \| 'normal' \| 'spacious'` | `'normal'` | 2.0.0 | Modal | Layout density preset. `compactMode` is a convenience toggle that sets this to `compact`. |

---

## Processing

These fields control document parsing, chunking, and run limits.

| Field | Type | Default | Since | Control | Description |
| --- | --- | --- | --- | --- | --- |
| `model` | `string` | _(from Ollama)_ | 2.0.0 | ConfigPanel | The model used for generation. Populated from the running Ollama instance or typed for cloud providers. |
| `processingType` | `string` | `'instruction'` | 2.0.0 | ConfigPanel | Processing mode: `'instruction'`, `'conversation'`, `'chunking'`, or `'custom'`. |
| `provider` | `string` | `'ollama'` | 2.0.0 | ConfigPanel | AI backend: `'ollama'`, `'openai'`, `'anthropic'`, or `'gemini'`. |
| `apiKey` | `string` | `''` | 2.0.0 | ConfigPanel | API key for the selected cloud provider. Encrypted with AES-256-GCM at rest. |
| `baseUrl` | `string` | `''` | 2.0.0 | ConfigPanel | Custom API endpoint. Defaults are applied per provider when left blank. |
| `temperature` | `number` | `0.7` | 2.0.0 | ConfigPanel | Sampling temperature. Range `0.0`–`1.0`. |
| `customPrompt` | `string` | `''` | 2.0.0 | ConfigPanel | Custom prompt template used when `processingType` is `'custom'`. |
| `language` | `string` | `'en'` | 2.0.0 | ConfigPanel | Output language code. Selects the prompt template from `src/prompts/<lang>_<type>.txt`. |
| `outputLanguageOverride` | `string` | `''` | 2.0.1 | Modal | Overrides the output language without changing the prompt template language. Empty disables the override. |
| `chunkSize` | `number` | `2000` | 2.0.0 | ConfigPanel | Maximum characters per text chunk. Range `500`–`10,000`. |
| `minChunkLength` | `number` | `200` | 2.0.1 | Modal | Minimum chunk length. Chunks shorter than this are merged with neighbors when possible. |
| `maxChunkLength` | `number` | `8000` | 2.0.1 | Modal | Hard cap on chunk length. |
| `chunkOverlap` | `number` | `100` | 2.0.1 | Modal | Number of characters of overlap between adjacent chunks to preserve context. |
| `sentenceAwareChunking` | `boolean` | `true` | 2.0.1 | Modal | When true, chunk boundaries snap to sentence endings. |
| `preserveCodeBlocks` | `boolean` | `true` | 2.0.1 | Modal | When true, fenced code blocks are never split across chunks. |
| `languageDetection` | `boolean` | `false` | 2.0.1 | Modal | When true, detects the dominant language of each chunk and may override `language` for that chunk. |
| `concurrency` | `number` | `3` | 2.0.0 | ConfigPanel | Parallel chunk requests per file. Range `1`–`5`. |
| `smartSizing` | `boolean` | `true` | 2.0.0 | Modal | When true, chunk boundaries adapt to content density instead of strictly enforcing `chunkSize`. |
| `maxParallelFiles` | `number` | `1` | 2.0.0 | Modal | Number of files processed simultaneously. Range `1`–`10`. |
| `maxFileSize` | `number` | `100` | 2.0.0 | Modal | Maximum accepted file size in MB. Range `10`–`1000`. |
| `maxOutputItems` | `number` | `100000` | 2.0.0 | Modal | Caps items produced per file. `0` means unlimited. |
| `maxChunks` | `number` | `500` | 2.0.0 | Modal | Caps chunks sent to the model per file. `0` means unlimited. |
| `incremental` | `boolean` | `false` | 2.0.0 | Modal | When true, processes only new or changed chunks since the last run. |
| `enableThinking` | `boolean` | `false` | 2.0.0 | Modal | Enables extended thinking traces for models that support them. |

---

## Export

| Field | Type | Default | Since | Control | Description |
| --- | --- | --- | --- | --- | --- |
| `outputFormat` | `string` | `'jsonl'` | 2.0.0 | ConfigPanel | Serialization format: `'jsonl'`, `'chatml'`, `'text'`, or `'csv'`. The export menu also offers a pretty-printed JSON array. |

Output mode and export control fields are listed in the [Output mode and export controls](#output-mode-and-export-controls) section above.

---

## Generation tuning

These fields control how the model is prompted and how failures are retried.

| Field | Type | Default | Since | Control | Description |
| --- | --- | --- | --- | --- | --- |
| `retryCount` | `number` | `3` | 2.0.1 | Modal | Maximum retry attempts per chunk on failure. |
| `retryBackoffStrategy` | `'fixed' \| 'linear' \| 'exponential'` | `'exponential'` | 2.0.1 | Modal | Backoff curve between retries. |
| `requestTimeoutMs` | `number` | `60000` | 2.0.1 | Modal | Total request timeout in milliseconds. Defaults to 1 minute. |
| `streamTimeoutMs` | `number` | `600000` | 2.0.1 | Modal | Inactivity timeout for streaming responses. Defaults to 10 minutes. |
| `abortOnError` | `boolean` | `false` | 2.0.1 | Modal | When true, aborts the entire run on the first unrecoverable error instead of continuing. |
| `topP` | `number` | `0.9` | 2.0.1 | Modal | Nucleus sampling probability mass. |
| `topK` | `number` | `40` | 2.0.1 | Modal | Top-K sampling. |
| `repeatPenalty` | `number` | `1.1` | 2.0.1 | Modal | Penalty applied to repeated tokens. |
| `seed` | `number` | `-1` | 2.0.1 | Modal | Random seed for reproducible generation. Negative values disable deterministic seeding. |
| `systemPromptOverride` | `string` | `''` | 2.0.1 | Modal | Replaces the built-in system prompt. Empty uses the default. |
| `stopSequences` | `string[]` | `[]` | 2.0.1 | Modal | Generation stops when any sequence is emitted. |
| `bannedPhrases` | `string[]` | `[]` | 2.0.1 | Modal | Items containing any banned phrase are flagged by the validator. |
| `requiredPhrases` | `string[]` | `[]` | 2.0.1 | Modal | Items missing all required phrases are flagged by the validator. |

---

## Validation

| Field | Type | Default | Since | Control | Description |
| --- | --- | --- | --- | --- | --- |
| `skipDedup` | `boolean` | `false` | 2.0.1 | Modal | When true, disables simhash near-duplicate removal. |
| `dedupSimilarityThreshold` | `number` | `0.92` | 2.0.1 | Modal | Hamming-distance ratio above which two items are considered duplicates. |
| `minQaPairsPerFile` | `number` | `1` | 2.0.1 | Modal | Minimum Q&A pairs expected per file. Files below this trigger a warning. |
| `maxQaPairsPerFile` | `number` | `1000` | 2.0.1 | Modal | Maximum Q&A pairs retained per file. |
| `validationStrictness` | `'lenient' \| 'normal' \| 'strict'` | `'normal'` | 2.0.1 | Modal | Controls validator threshold sensitivity and reporting verbosity. |
| `autoRegenerateOnLowQuality` | `boolean` | `false` | 2.0.1 | Modal | When true, regenerates chunks whose items score below `regenerateThreshold`. |
| `regenerateThreshold` | `number` | `0.6` | 2.0.1 | Modal | Quality score below which `autoRegenerateOnLowQuality` triggers a retry. |
| `maxRegenerationAttempts` | `number` | `2` | 2.0.1 | Modal | Caps how many times a single chunk is regenerated. |
| `qualityThreshold` | `number` | `0` | 2.0.0 | Modal | Overall quality gate. Items below this score are flagged. Zero disables the gate. |
| `validators` | `ValidatorConfig[]` | `[]` | 2.0.0 | Modal | Per-validator enablement and thresholds. |
| `refinementPasses` | `number` | `0` | 2.0.0 | Modal | Additional self-critique passes over generated items. |

---

## Providers

| Field | Type | Default | Since | Control | Description |
| --- | --- | --- | --- | --- | --- |
| `ollamaHost` | `string` | `'localhost'` | 2.0.0 | Modal | Ollama server host. |
| `ollamaPort` | `number` | `11434` | 2.0.0 | Modal | Ollama server port. |
| `providers` | `ProviderConfig[]` | `[]` | 2.0.0 | Modal | Registered provider configurations with id, type, name, apiKey, baseUrl, model, priority, enabled, scopes, and region. |
| `failoverPriority` | `string[]` | `[]` | 2.0.0 | Modal | Ordered provider ids tried on failure. |
| `ensembleModels` | `string[]` | `[]` | 2.0.0 | Modal | Models whose outputs are merged for ensemble generation. |

---

## Telemetry and privacy

| Field | Type | Default | Since | Control | Description |
| --- | --- | --- | --- | --- | --- |
| `telemetryEnabled` | `boolean` | `false` | 2.0.0 | Modal | Master toggle for anonymous usage telemetry. Off by default. |
| `disableTelemetry` | `boolean` | `false` | 2.0.1 | Modal | Hard disable for telemetry that overrides `telemetryEnabled`. Use this when telemetry must never start. |
| `crashReportsEnabled` | `boolean` | `false` | 2.0.0 | Modal | Allows crash reports to be sent on a crash. Off by default. |
| `disableCrashReports` | `boolean` | `false` | 2.0.1 | Modal | Hard disable for crash reporting that overrides `crashReportsEnabled`. |
| `autoUpdate` | `boolean` | `true` | 2.0.0 | Modal | Allows the app to check for and install updates. |
| `disableAutoUpdate` | `boolean` | `false` | 2.0.1 | Modal | Hard disable for auto-update that overrides `autoUpdate`. |
| `updateCheckIntervalHours` | `number` | `24` | 2.0.1 | Modal | Hours between update checks. |
| `dataResidency` | `string` | `''` | 2.0.0 | Modal | Constrains where data may be processed or stored. Empty means no constraint. |
| `retentionDays` | `number` | `30` | 2.0.0 | Modal | Days to retain cached and intermediate artifacts before automatic cleanup. |
| `otlpEndpoint` | `string` | `''` | 2.0.0 | Modal | OpenTelemetry OTLP endpoint for exporting traces and metrics. |

---

## System and window

| Field | Type | Default | Since | Control | Description |
| --- | --- | --- | --- | --- | --- |
| `startMaximized` | `boolean` | `false` | 2.0.0 | Modal | Opens the window maximized on launch. |
| `rememberWindowSize` | `boolean` | `true` | 2.0.0 | Modal | Restores the last window size on launch. |
| `gpuAcceleration` | `boolean` | `true` | 2.0.1 | Modal | Enables GPU acceleration for the Electron renderer and Ollama where supported. |
| `sendToTrayOnClose` | `boolean` | `false` | 2.0.1 | Modal | When true, closing the window minimizes to the system tray instead of quitting. |
| `startOnLogin` | `boolean` | `false` | 2.0.1 | Modal | When true, launches the app on operating system login. |
| `maxSessionTokens` | `number` | `0` | 2.0.0 | Modal | Caps total tokens consumed in a session. Zero means unlimited. |
| `appLock` | `{ enabled: boolean; totpSecret?: string }` | `{ enabled: false }` | 2.0.0 | Modal | When enabled, requires a TOTP code to unlock the app. |

---

## Cache

| Field | Type | Default | Since | Control | Description |
| --- | --- | --- | --- | --- | --- |
| `cacheDir` | `string` | `''` | 2.0.1 | Modal | Overrides the default cache directory. Empty uses the platform default. |
| `cacheMaxSizeMB` | `number` | `500` | 2.0.1 | Modal | Maximum cache size in MB. Oldest entries are evicted when the cap is reached. |
| `cacheTtlSeconds` | `number` | `604800` | 2.0.1 | Modal | Time-to-live for cache entries in seconds. Default is 7 days. |
| `clearCacheOnExit` | `boolean` | `false` | 2.0.1 | Modal | When true, clears the cache when the app quits. |

---

## Logging

| Field | Type | Default | Since | Control | Description |
| --- | --- | --- | --- | --- | --- |
| `logToFile` | `boolean` | `true` | 2.0.1 | Modal | When true, writes structured logs to rotating files on disk. |
| `logFilePath` | `string` | `''` | 2.0.1 | Modal | Overrides the default log file directory. Empty uses the platform default under `Documents/TrainingGenerator/logs/`. |

---

## Window and autosave (Settings modal)

| Field | Type | Default | Since | Control | Description |
| --- | --- | --- | --- | --- | --- |
| `autoSave` | `boolean` | `true` | 2.0.0 | Modal | When true, changes to Settings modal controls are saved automatically. |
| `autoCheckOllama` | `boolean` | `true` | 2.0.0 | Modal | When true, periodically polls Ollama to refresh the model list and status. |

---

## Advanced and experimental

| Field | Type | Default | Since | Control | Description |
| --- | --- | --- | --- | --- | --- |
| `proxy` | `string` | `''` | 2.0.0 | Modal, CLI | Outbound proxy URL for provider requests. |
| `apiServer` | `{ enabled: boolean; port: number; auth?: string }` | `{ enabled: false, port: 0 }` | 2.0.0 | Modal | Experimental local REST API server. |
| `pluginPaths` | `string[]` | `[]` | 2.0.0 | Modal | Paths to experimental plugin modules. |
| `watchFolders` | `string[]` | `[]` | 2.0.0 | Modal | Folders watched for new files to process automatically. |
| `webhooks` | `WebhookConfig[]` | `[]` | 2.0.0 | Modal | Outbound webhooks fired on run events. |
| `workspaceId` | `string` | `''` | 2.0.0 | Modal | Active workspace identifier for multi-workspace mode. |

---

## Saved profile fields

Named profiles (stored under `train-generator-profiles`) capture a snapshot of the configuration panel. Each profile contains:

- `name`, `model`, `processingType`, `outputFormat`, `language`, `chunkSize`, `concurrency`, `provider`, `baseUrl`, `smartSizing`, `createdAt`

Profiles do not include the full `FullAppSettings` surface; they cover the panel-only subset. Use the Settings modal for the rest.

---

## Quick reference by section

| Section | Field count | New in 2.0.1 |
| --- | --- | --- |
| Output mode and export controls | 7 | 7 |
| Appearance and accessibility | 9 | 6 |
| Processing | 23 | 7 |
| Generation tuning | 13 | 13 |
| Validation | 11 | 8 |
| Providers | 5 | 0 |
| Telemetry and privacy | 10 | 4 |
| System and window | 7 | 3 |
| Cache | 4 | 4 |
| Logging | 2 | 2 |
| Window and autosave | 2 | 0 |
| Advanced and experimental | 6 | 0 |

The v2.0.1 release adds roughly fifty new user-adjustable fields on top of the v2.0.0 surface.

---

<!--
  Easter egg: the `seed` field is the only deterministic knob in an otherwise
  stochastic pipeline. Set it to a memorable integer and you can reproduce a
  full dataset run byte-for-byte — useful for regression testing or for proving
  to a reviewer that your fine-tuning data did not change between submissions.
-->

## Next steps

- [Output Mode](/configuration/output-mode.md) — the per-file export feature guide.
- [Model Settings](/configuration/model-settings.md) — provider, temperature, chunk size, concurrency.
- [Output Settings](/configuration/output-settings.md) — format and language selection.
- [Configuration Guide](/configuration.md) — the configuration panel and Settings modal walkthrough.
