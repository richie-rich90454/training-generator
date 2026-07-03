# Tasks (I want 310 commits, as one bugfix per commit)

Each task is one commit. Commit as you go. Run `npx tsc --noEmit`, `npm test`, and (where relevant) `npm run build` before each commit. Never commit failing tests or lint errors.

## Phase 1 — Critical (data loss, security, broken core)

* [x] Task 1: Fix NDJSON stream parsing in `src/main.ts` `ollama:generateStream`/`ollama:generate`

  * [x] SubTask 1.1: Maintain a persistent `buffer` string across `data` events; split on `\n`; keep trailing partial line in `buffer`

  * [x] SubTask 1.2: Add stream `destroy()` + listener cleanup in a `finally` block; add a body-stream timeout that calls `stream.destroy()`

  * [x] SubTask 1.3: Move `{ ...options, temperature: clamped, top_p: clamped }` so clamped wins (both Ollama handlers)

* [x] Task 2: Fix non-ASCII text destruction in PDF/DOC fallback extraction

  * [x] SubTask 2.1: `src/workers/pdfWorker.ts` — replace `/[^\x20-\x7E\n\r\t]/g` with `/[\x00-\x08\x0B\x0C\x0E-\x1F]/g`

  * [x] SubTask 2.2: Same regex fix in `src/core/fileParser.ts` (lines \~169, 173)

  * [x] SubTask 2.3: Same regex fix in `src/core/fileParserLazy.ts` (lines \~242, 246)

* [x] Task 3: Fix worker pool race condition (`src/renderer/workers/workerPool.ts`)

  * [x] SubTask 3.1: Generate unique `id` per request; pass to worker; have worker echo `id` back

  * [x] SubTask 3.2: Pool handler ignores messages whose `id` doesn't match

  * [x] SubTask 3.3: Add `worker.addEventListener("error", ...)` rejecting all pending; add `messageerror` handler

  * [x] SubTask 3.4: Track pending handlers in a Set; reject+clear them in `terminateWorkers()`

  * [x] SubTask 3.5: Add a per-call timeout (e.g. 60s) that rejects and restarts the worker

  * [x] SubTask 3.6: Echo `id` in `chunk.worker.ts` and `dedup.worker.ts` responses; move destructuring inside `try`

  * [x] SubTask 3.7: Recreate worker after fatal error

* [x] Task 4: Fix CLI providers (`src/cli/provider.ts`, `src/cli/index.ts`)

  * [x] SubTask 4.1: Implement `CliAnthropicProvider` (POST `/v1/messages`, `x-api-key` header, `anthropic-version`)

  * [x] SubTask 4.2: Implement `CliGeminiProvider` (POST `/v1beta/models/{model}:generateContent?key=...`)

  * [x] SubTask 4.3: `createCliProvider` returns the correct provider per `type`

  * [ ] SubTask 4.4: Fall back to `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`GEMINI_API_KEY`/`GOOGLE_API_KEY` env vars

  * [ ] SubTask 4.5: Accept `--api-key` and `--language` CLI flags

  * [ ] SubTask 4.6: Throw in `CliOpenAIProvider` constructor if `apiKey` is empty

  * [ ] SubTask 4.7: Validate `--type` and `--provider` against allow-lists

  * [ ] SubTask 4.8: Add `--help`/`-h`; error on unknown flags

  * [ ] SubTask 4.9: Fix `parseInt(...) || default` to reject `0`; use `Number.isFinite(n) && n>0`

  * [ ] SubTask 4.10: Apply config first, then let CLI flags override (track which flags were set)

  * [ ] SubTask 4.11: Add `--dedup-threshold` flag (default 0.9)

  * [ ] SubTask 4.12: Replace `__dirname` with `fileURLToPath(import.meta.url)` + `path.dirname`

  * [ ] SubTask 4.13: Add SIGINT/SIGTERM handler that aborts in-flight requests (AbortController)

  * [ ] SubTask 4.14: Move `rateLimiter.acquire()` inside the retry callback; add max-delay cap + jitter to `retryWithBackoff`; parse HTTP-date `Retry-After`; inspect `error.response.status` for 401/403 (not string match)

  * [ ] SubTask 4.15: Default `lastError = new Error("Unknown error")`

  * [ ] SubTask 4.16: Add `--input=foo` equals-sign syntax; treat `--input -` as stdin

  * [ ] SubTask 4.17: Send all status/progress to stderr; reserve stdout for data

* [x] Task 5: Fix `vite.config.ts` `glob.sync` (removed in glob v10+)

  * [x] SubTask 5.1: Change `import{glob}from "glob"` + `glob.sync(...)` to `import{globSync}from "glob"` + `globSync(...)`

  * [x] SubTask 5.2: Add `external:["electron"]` to `build.rollupOptions`; explicit fallback chunk for unmatched `src/**`

* [x] Task 6: Fix `dev` script on Windows (`package.json`)

  * [x] SubTask 6.1: Use `concurrently` (add to devDependencies): `"dev":"concurrently \"vite\" \"cross-env NODE_ENV=development node --import tsx/esm node_modules/electron/cli.js .\""`

  * [x] SubTask 6.2: Fix `index.html` footer version to `v2.0.0` (or inject dynamically)

  * [x] SubTask 6.3: Set `"types":"src/types/index.ts"`; remove unused devDependencies (`vite-plugin-copy`, `esbuild`; `happy-dom` only if env stays node)

  * [x] SubTask 6.4: Set `vitest.config.ts` `environment:"happy-dom"`; add `resolve.alias` matching `vite.config.ts`; add `setupFiles`; add `coverage` config; align `include` with `.tsx`

* [x] Task 7: Fix `confirm.ts` overlapping-call race (`src/renderer/confirm.ts`)

  * [x] SubTask 7.1: Track current `resolve` ref; force-resolve pending as `false` before attaching new listeners

  * [x] SubTask 7.2: Add Escape key handler; add `role="dialog"`/`aria-modal="true"`/`aria-labelledby="confirm-title"`

  * [x] SubTask 7.3: Add focus trap (Tab between Cancel/OK) + save/restore `document.activeElement`

  * [x] SubTask 7.4: Accept optional `title` parameter; export `closeConfirm()` that resolves with `false`

* [x] Task 8: Fix cache `warmCache` and weak hash (`src/renderer/cache.ts`)

  * [x] SubTask 8.1: `warmCache` accepts real `model`/`prompt` (or remove the feature)

  * [x] SubTask 8.2: Replace DJP 32-bit hash with SHA-256 (or store raw key prefix and verify on lookup)

  * [x] SubTask 8.3: Cache the in-flight `loadCache` promise (singleton)

  * [x] SubTask 8.4: Debounce/throttle full-cache writes; persist only new entry on `setCachedResult`

  * [x] SubTask 8.5: Add TTL/max-size eviction using `timestamp`

  * [x] SubTask 8.6: Reset `cacheLoaded=false` in `clearCache`; validate loaded entries

* [x] Task 9: Replace deduplicator DJP+Hamming with SimHash or actual similarity (`src/renderer/deduplicator.ts`)

  * [x] SubTask 9.1: Use SimHash (64-bit) for near-duplicate detection; or use Jaccard on shingles for verification

  * [x] SubTask 9.2: Verify candidate duplicates with real text comparison before merging

  * [x] SubTask 9.3: Clamp `threshold` to `[0,1]`

  * [x] SubTask 9.4: Add blocking/LSH bucketing to avoid O(n²)

  * [x] SubTask 9.5: Clone input array before mutating in `mergeProvenance`

* [x] Task 10: Move AES key out of localStorage (`src/renderer/security.ts`)

  * [x] SubTask 10.1: Add main-process IPC handlers using Electron `safeStorage` for key storage/retrieval

  * [x] SubTask 10.2: Update `preload.ts` to expose `secureKey:*` channels; update `electron.d.ts`

  * [x] SubTask 10.3: `getOrCreateKey` calls IPC; falls back to in-memory key on failure

  * [x] SubTask 10.4: Wrap `localStorage` (where still used during migration) in try/catch

  * [x] SubTask 10.5: Recover from corrupt stored key (delete + regenerate)

  * [x] SubTask 10.6: `decryptKey` returns `null` on failure (not ciphertext); callers handle null

  * [x] SubTask 10.7: Chunk `String.fromCharCode(...combined)` for large inputs

  * [x] SubTask 10.8: Re-import key as non-extractable after export

* [x] Task 11: Fix `bootstrap.ts` dead code

  * [x] SubTask 11.1: Move `app.commandLine.appendSwitch("disable-features","TranslateUI")` and `ignore-gpu-blocklist` into `main.ts` before `whenReady`

  * [x] SubTask 11.2: Either make `bootstrap.ts` the entry (`"main":"src/bootstrap.ts"`) or delete it and update tests

* [x] Task 12: Fix preload listener leak (`src/preload.ts`)

  * [x] SubTask 12.1: Store handler reference; pass same fn to `removeListener`

  * [x] SubTask 12.2: Remove the outer `()=>` wrapper in `onOllamaStatusUpdate` so it returns cleanup directly

  * [x] SubTask 12.3: Either emit `ollama:status-update` from main (e.g. after `ollama:check`) or remove the API

  * [x] SubTask 12.4: Remove redundant `appConsole` (renderer already has `console`)

* [x] Task 13: Fix `file:parse`/`file:save` security (`src/main.ts`)

  * [x] SubTask 13.1: Restrict `file:parse` to paths returned by `dialog:openFile` (tracked in main) or an allowlist

  * [x] SubTask 13.2: Restrict `file:save` to app data dirs or `dialog:saveFile` paths

  * [x] SubTask 13.3: Apply `isPathSafeForWrite` to `dialog:saveFile`

  * [x] SubTask 13.4: Make `isPathWithin` case-insensitive on win32/darwin

  * [x] SubTask 13.5: Drop the `..` substring check (rely on `path.resolve` + `isPathWithin`)

  * [x] SubTask 13.6: Surface a clear error in `dialog:openFile` when a file is rejected (don't silently filter)

  * [x] SubTask 13.7: Validate `openai:generate` `baseUrl` is non-empty http(s); block SSRF ranges

  * [x] SubTask 13.8: Add file-size limit to `file:read` (e.g. 10 MB)

  * [x] SubTask 13.9: `file:save` accept empty-string content (use `content==null` check)

  * [x] SubTask 13.10: Normalize prompts-path detection for `\\` separators on Windows

  * [x] SubTask 13.11: Guard `process.resourcesPath` usage

  * [x] SubTask 13.12: Default `payload={}` and `options??{}` in `ollama:generate`/`generateStream`/`openai:generate`

  * [x] SubTask 13.13: Set `sandbox:true` for main window preload

## Phase 2 — High (functional defects, leaks)

* [x] Task 14: Fix splash/main window lifecycle (`src/main.ts`)

  * [x] SubTask 14.1: Attach `splashProcess.on("error",...)` and `splashProcess.on("exit",()=>{splashProcess=null})`

  * [x] SubTask 14.2: Guard `splashWindow!`/`mainWindow!` with `isDestroyed()` checks in async callbacks

  * [x] SubTask 14.3: Register deferred IPC handlers in `whenReady` (or fallback) not only `dom-ready`

  * [x] SubTask 14.4: `before-quit` uses `event.preventDefault()` for async work then `app.exit()`; close `splashWindow`; destroy `httpAgent`/`httpsAgent`

  * [x] SubTask 14.5: Call `app.requestSingleInstanceLock()`; handle `second-instance` to focus existing window

  * [x] SubTask 14.6: Add `.catch` to `whenReady().then(...)`

  * [x] SubTask 14.7: `uncaughtException`/`unhandledRejection` log + `app.quit()` (or show dialog)

  * [x] SubTask 14.8: Pass `mainWindow ?? undefined` to `dialog.show*Dialog`

  * [x] SubTask 14.9: Guard `did-fail-load` to main-frame only; check `validatedURL` defined

  * [x] SubTask 14.10: Serialize concurrent `write-log` with a promise queue; use `fsp` async equivalents

  * [x] SubTask 14.11: Validate `cache:save`/`progress:save`/`save-checkpoint` data size/type; reject `null` in `write-log`

* [x] Task 15: Fix settings persistence (`src/renderer/uiManager.ts`)

  * [x] SubTask 15.1: Align `smartSizing` ↔ `smart-sizing` DOM id in load/save arrays

  * [x] SubTask 15.2: Save `maxOutputItems` and `maxChunks` in `saveAppSettings`

  * [x] SubTask 15.3: Capture `modelSelect.value` before rebuilding; restore if model still exists

  * [x] SubTask 15.4: Track scroll handler in `virtualList.ts`; remove at start of `createVirtualList` (or return `destroy()`)

  * [x] SubTask 15.5: Use `{text}` consistently (not `{{text}}`); align `templateEditor` and `savePreset`

  * [x] SubTask 15.6: Add `destroy()` to `UIManager` that clears `intervals`/`timeouts`

* [x] Task 16: Fix devtools log memory leak (`src/renderer/devtools.ts`)

  * [x] SubTask 16.1: Cap `logEntries` (e.g. 1000) as ring buffer

  * [x] SubTask 16.2: Append single DOM node per log (throttle/batch via `requestAnimationFrame`)

  * [x] SubTask 16.3: Escape `time` and `level`; validate `level` against allow-list before use as CSS class

  * [x] SubTask 16.4: Null references in `dispose()`; validate `tabName` against allow-list

  * [x] SubTask 16.5: Use explicit locale (`en-US`) for number formatting

* [x] Task 17: Fix CSV export injection (`src/renderer/exportFormats.ts`, `src/renderer/uiManager.ts`)

  * [x] SubTask 17.1: `csvEscape` quotes fields containing `,`, `"`, `\n`, `\r`, or formula-leading char; prefix `=`,`+`,`-`,`@`,tab,CR with `'`

  * [x] SubTask 17.2: Reconcile `escapeCsvField` (uiManager) with `csvEscape` (exportFormats) — single helper

  * [x] SubTask 17.3: Add UTF-8 BOM to CSV export

  * [x] SubTask 17.4: Append trailing newline to JSONL

  * [x] SubTask 17.5: Use `item.instruction != null ? String(item.instruction) : ""` (not `|| ""`)

  * [x] SubTask 17.6: Filter null/undefined items; choose header appropriate to dominant item shape

* [x] Task 18: Fix file parser memory + encoding (`src/core/fileParser.ts`, `src/core/fileParserLazy.ts`)

  * [x] SubTask 18.1: Add `maxSize` to `streamTextFile` (lazy already has 50MB); `destroy()` on overflow

  * [x] SubTask 18.2: Strip UTF-8 BOM after `toString("utf-8")` in `parseText`/`parseHTML`/`parseRTF` (both files)

  * [x] SubTask 18.3: Set `settle` guard on `streamTextFile` to prevent double-resolve/reject

  * [x] SubTask 18.4: `fileParserLazy.parsePDFWithWorker` — use `pdfWorker.js` path + `{type:"module"}`

  * [x] SubTask 18.5: `fileParserLazy.parsePDFWithWorker` — use `crypto.randomUUID()` for `id`; `===` for comparison; always reject on exit regardless of code

  * [x] SubTask 18.6: Cache in-flight promise in `loadDependency`; check `isDisposed` before assigning

  * [x] SubTask 18.7: Use real streaming PDF extractor or rename "Large file detected" log to "parsing in memory"

  * [x] SubTask 18.8: Use `RtfParser` consistently; only fall back to careful regex that decodes `\uN`/`\'hh`

  * [x] SubTask 18.9: Add `"htm"` to `supportedFormats`; normalize `htm`→`html`

  * [x] SubTask 18.10: Keep full Error on result object (include stack); `dispose()` cancels pending `loadDependency`

  * [x] SubTask 18.11: Lower PDF worker threshold to 1 MB or always use worker

  * [x] SubTask 18.12: Transfer buffer to worker when no fallback needed (or re-read on fallback)

* [x] Task 19: Fix virtual list (`src/renderer/virtualList.ts`)

  * [x] SubTask 19.1: Return `destroy()` that removes scroll listener; caller destroys previous instance

  * [x] SubTask 19.2: Add `ResizeObserver` to re-render when container becomes visible

  * [x] SubTask 19.3: Re-snapshot `items.length` inside `render` defensively

  * [x] SubTask 19.4: Cap spacer height (cluster/buffer for >1.2M items)

* [x] Task 20: Fix chunker data loss (`src/renderer/chunker.ts`)

  * [x] SubTask 20.1: Capture tail `currentChunk.slice(wsIdx)` and prepend to next chunk (don't drop text)

  * [x] SubTask 20.2: Use either `contextPrefix` or `overlap`, not both

  * [x] SubTask 20.3: Treat CJK punctuation as hard boundary (no whitespace requirement)

  * [x] SubTask 20.4: Fix table-row detection (`split('|').length >= 3`)

  * [x] SubTask 20.5: Mirror row predicate between `detectSemanticUnits` and `splitUnitAtRowBoundary`

  * [x] SubTask 20.6: Advance `i` past any sentence whose `start` is within the unit

  * [x] SubTask 20.7: Apply `overlap` in oversized-unit path

  * [x] SubTask 20.8: Early return on `text.trim().length===0`; `simpleChunk` splits oversized units

  * [x] SubTask 20.9: Add abbreviation guardlist to `splitSentences` fallback

* [ ] Task 21: Fix types/config consistency

  * [ ] SubTask 21.1: `src/types/ipc.ts` — fix `ollama:generateStream` response to `OllamaGenerateResult`; align `ollama:check` models/version; fix `file:parseBatch` request/response; add `docs:openUserGuide` and `ollama:status-update`; align `options` types; use `LogEntry`; replace `any` with `unknown`

  * [ ] SubTask 21.2: `src/types/ipc.ts` — import `FileObj` from `./interfaces` instead of redeclaring

  * [ ] SubTask 21.3: `src/types/interfaces.ts` — type `chunkSize`/`concurrency`/`temperature` as `number`; unify `FullAppSettings` key naming; `maxParallelFiles` as `number`; `messages[].role` as union; `TrainingItem` as discriminated union

  * [ ] SubTask 21.4: `src/types/electron.d.ts` — make `electronAPI`/`appConsole`/`app` optional; align import path; align `parseFilesBatch` param type

  * [ ] SubTask 21.5: `src/types/modules.d.ts` — verify `pdf-parse` v2 return shape; add typed `on` overloads for `rtf-parser-fixes`; remove dead `node-fetch` declaration; use real `HtmlToTextOptions`; add `vite/client` reference; remove manual `*.css`

  * [ ] SubTask 21.6: `tsconfig.json` — add `"types":["vitest/globals","node"]`; remove `declaration`/`outDir`/`rootDir` (noEmit); consider split tsconfig (DOM for renderer, Node for main); align `target` with Vite; remove trailing comma

  * [ ] SubTask 21.7: Create typed `invoke`/`handle` wrappers in `ipc.ts`; refactor preload/main to use them

## Phase 3 — Medium (UI sync, leaks, validation)

* [ ] Task 22: Fix UI manager remaining issues (`src/renderer/uiManager.ts`)

  * [ ] SubTask 22.1: Parse CSS `transitionDuration` for `ms` unit; or use `transitionend`

  * [ ] SubTask 22.2: Use `getHelpContent()` in `showHelp`; escape `<model-name>` as `&lt;model-name&gt;`

  * [ ] SubTask 22.3: Add `settings.profileSelect.default` key to all locales in `i18n.ts`

  * [ ] SubTask 22.4: Track sequence counter in `applyProfile` to ignore stale results

  * [ ] SubTask 22.5: Cache status `<span>` reference with null check

  * [ ] SubTask 22.6: Add null checks in `cacheElements`; scope `modalClose` to `settingsModal`

  * [ ] SubTask 22.7: Add `:not([disabled])` to `trapFocus` selector

  * [ ] SubTask 22.8: Route help through `trapFocus`/`restoreFocus`; add Escape handler

  * [ ] SubTask 22.9: Fix missing space `${settings.language} uses`

  * [ ] SubTask 22.10: Don't pre-escape prompt preview (let `addLog` do it)

  * [ ] SubTask 22.11: Add `matchMedia` listener for `applyTheme("auto")`

  * [ ] SubTask 22.12: Validate provider/baseUrl against option lists

  * [ ] SubTask 22.13: Reset `logCount` to actual `children.length` on external clear

  * [ ] SubTask 22.14: Guard `max===min` in `updateTemperatureDisplay`

  * [ ] SubTask 22.15: Use `showConfirm` in `deleteCurrentProfile` (not `window.confirm`)

* [ ] Task 23: Fix dashboard (`src/renderer/dashboard.ts`)

  * [ ] SubTask 23.1: Clear previous interval in `start()`

  * [ ] SubTask 23.2: Compute tokens/s from actual token count; remove `chunksTotal` gate; drop redundant ternary

  * [ ] SubTask 23.3: Round `ms` to integer; branch on `Math.round(ms)`; carry into minutes

  * [ ] SubTask 23.4: Add `role="dialog"`/`aria-modal`/Escape/focus trap

  * [ ] SubTask 23.5: Hide panel on `stop()` or document behavior

  * [ ] SubTask 23.6: Early-return in `tick` if `!this.visible`

* [ ] Task 24: Fix toast (`src/renderer/toast.ts`)

  * [ ] SubTask 24.1: Set `role="status"` + `aria-live="polite"` on container (assertive for error)

  * [ ] SubTask 24.2: Track "animating out" flag on element; short-circuit if set

  * [ ] SubTask 24.3: Read `transition-duration` from computed style for fallback timer

  * [ ] SubTask 24.4: Return `id` from `show`; export `dismissToast(id)`

  * [ ] SubTask 24.5: Disable pointer events on shifted toast

* [ ] Task 25: Fix template editor (`src/renderer/templateEditor.ts`)

  * [ ] SubTask 25.1: Add `dispose()` removing global `keydown` listener

  * [ ] SubTask 25.2: Guard `<style>` injection with id check

  * [ ] SubTask 25.3: Check for any `.modal.active` with higher z-index in Escape handler

  * [ ] SubTask 25.4: Add focus trap + save/restore

  * [ ] SubTask 25.5: Append file input to DOM before `click()`; remove in `change` handler

  * [ ] SubTask 25.6: Defer `URL.revokeObjectURL` with `setTimeout(...,1000)`

  * [ ] SubTask 25.7: Show toast on empty-template save

  * [ ] SubTask 25.8: Document/escape consistently between two preview paths

* [x] Task 26: Fix config profiles (`src/renderer/configProfiles.ts`)

  * [x] SubTask 26.1: Validate `Array.isArray(parsed)` in `listProfiles`

  * [x] SubTask 26.2: Wrap `localStorage.setItem` in try/catch in `saveProfile`/`deleteProfile`

  * [x] SubTask 26.3: Deep-clone on insert

  * [x] SubTask 26.4: Preserve `createdAt` on update

  * [x] SubTask 26.5: Drop `async` (or document why)

  * [x] SubTask 26.6: Add `version` field + migration in `listProfiles`

* [ ] Task 27: Fix i18n (`src/renderer/i18n.ts`)

  * [ ] SubTask 27.1: Add missing `fr` keys for `maxOutputItems`/`maxChunks`

  * [ ] SubTask 27.2: Add `settings.profileSelect.default` to all locales

  * [ ] SubTask 27.3: Translate only child text node (don't destroy button icons)

  * [ ] SubTask 27.4: Use `??` instead of `||` in `t`

  * [ ] SubTask 27.5: Detect locale via `navigator.language` on first run

  * [ ] SubTask 27.6: Call `applyLanguage(currentLang)` after rebuilding dynamic content

  * [ ] SubTask 27.7: Add interpolation support `t(key, lang, params)`

  * [ ] SubTask 27.8: Quote all locale keys consistently

* [x] Task 28: Fix checkpoint, rate limiter, stats, audit, logger, provenance, qualityValidator

  * [x] SubTask 28.1: `checkpoint.ts` — validate loaded shape; re-throw/save-failure signal; document `completedChunks` semantics; auto-clear on completion

  * [ ] SubTask 28.2: `rateLimiter.ts` — guard `tokensPerMinute>0`; treat `<=0` retry-after as default; re-cap tokens on `setRate`; add max-wait/AbortSignal; set `lastRefill=Date.now()` not `pausedUntil`

  * [ ] SubTask 28.3: `statsTracker.ts` — fix `formatDuration` 60s rollover; return 0 when `startTime===0`; return 0 (or null) `successRate` when `totalChunks===0`; require `elapsed>=100ms` for tokens/sec

  * [ ] SubTask 28.4: `audit.ts` — cap `entries` (ring buffer); maintain running `operations` counter

  * [ ] SubTask 28.5: `logger.ts` — cap `entries`; iterate snapshot of listeners; return deep copies from `getEntriesByLevel`/`getEntriesByModule`; add `setLevel`

  * [ ] SubTask 28.6: `provenance.ts` — accept surviving item's source as parameter; dedup `_mergedFrom`; refuse to overwrite existing `_provenance` in `tagItem`

  * [ ] SubTask 28.7: `qualityValidator.ts` — remove dead `if(!item.text)` branch; drop or implement `sourceText`; make `answer_too_short`/`missing_answer` mutually exclusive; expand CJK range to include Kana/Hangul; apply `language_mismatch` to messages/text formats

* [ ] Task 29: Fix fileManager, outputManager, promptManager

  * [ ] SubTask 29.1: `fileManager.ts` — null-check DOM lookups; use `data-id` not `data-name`; fix missing spaces in log messages; format "1 Byte"; guard `e.dataTransfer`/`e.target.files`; optional-chain `uiManager?.ollamaStatus`; partial-add on cap

  * [ ] SubTask 29.2: `outputManager.ts` — pre-choose directory for multi-part export; default `format` to "jsonl"; push partial QA pairs with warning; require regex labels at line start; size-guard `copyOutput`; fall back to `input`/`instruction` in `getItemText`

  * [ ] SubTask 29.3: `promptManager.ts` — remove `fallbackCache` or wire it; resolve prompts via main IPC in packaged app; cache negative results; de-dupe concurrent `getPrompt` calls

* [ ] Task 30: Fix splash.html (`src/splash.html`)

  * [ ] SubTask 30.1: Use `navigator.userAgentData?.platform` with fallback

  * [ ] SubTask 30.2: Inline critical CSS + embed font via `data:` URL (or absolute asset paths)

  * [ ] SubTask 30.3: Move inline script to external `.js`; drop `'unsafe-inline'` from CSP

  * [ ] SubTask 30.4: Inject version dynamically from `app.getVersion()`

  * [ ] SubTask 30.5: Store `setTimeout` handles; clear on `pagehide`; remove unused keyframe

  * [ ] SubTask 30.6: Use `currentStep/totalSteps*100` so bar reaches 100% only in "ready" branch

* [ ] Task 31: Fix index.html (`index.html`)

  * [ ] SubTask 31.1: Add `ws://localhost:*` to CSP `connect-src` (dev only)

  * [ ] SubTask 31.2: Remove unused `https://cdnjs.cloudflare.com` from CSP

  * [ ] SubTask 31.3: Add `.markdown` to file `accept`

  * [ ] SubTask 31.4: Update `document.documentElement.lang` on language change

  * [ ] SubTask 31.5: Show real JSONL example in placeholder

## Phase 4 — Low (cosmetic, edge-cases, accessibility)

* [ ] Task 32: Low-severity cleanup

  * [ ] SubTask 32.1: Replace `==` with `===` in `src/main.ts` (lines 16, 17, 258, 652)

  * [ ] SubTask 32.2: Remove dead `lastError` in `ollama:generate`; remove dead pre-check or branch on result

  * [ ] SubTask 32.3: Remove unnecessary `as any` for `"cache"` path

  * [ ] SubTask 32.4: Remove `D5` unused keyframe; fix `D6` progress 100% twice

  * [ ] SubTask 32.5: Fix `helpContent.ts` unescaped `&` in "Drag & drop"

  * [ ] SubTask 32.6: `tsconfig.json` — remove `skipLibCheck` (or validate separately)

  * [ ] SubTask 32.7: Use `const` (or workspace `let`) consistently for non-reassigned bindings in config files

  * [ ] SubTask 32.8: Fix `glob.sync` `__dirname` polyfill inconsistency

  * [ ] SubTask 32.9: Verify pinned package versions exist on npm (`electron@^42.3.3`, `typescript@^6.0.3`, `vite@^8.0.16`, `vitest@^4.1.8`)

  * [ ] SubTask 32.10: Add `postinstall` guard or document CI requirements

  * [ ] SubTask 32.11: Verify `pdf-parse` v2 asarUnpack necessity

  * [ ] SubTask 32.12: Fix `pdfWorker.ts` `parentPort` null check; post `success:false` on invalid buffer immediately; validate `message.id`

  * [ ] SubTask 32.13: `pdfWorker.ts` — post `success:false` to parent on `uncaughtException` then `process.exit(1)`

  * [ ] SubTask 32.14: Fix `parseQAPairs` regex (require colon); handle orphan questions

  * [ ] SubTask 32.15: `CliOllamaProvider` — construct a `RateLimiter`; use `result.eval_count` if present

  * [ ] SubTask 32.16: Remove dead `appConsole` from preload (already in Task 12.4)

  * [ ] SubTask 32.17: Fix `toast.ts` shifted-toast close button still clickable

  * [ ] SubTask 32.18: Add ARIA to toast container (already in Task 24.1)

  * [ ] SubTask 32.19: Fix `deduplicator.ts` `preFilterCheck` cross-script skip (make configurable)

  * [ ] SubTask 32.20: Fix `cache.ts` cost-saved rounding precision

  * [ ] SubTask 32.21: Fix `chunker.ts` `splitSentences` abbreviation guardlist (already in 20.9)

  * [ ] SubTask 32.22: Fix `fileManager.ts` `formatFileSize` "1 Byte"

  * [ ] SubTask 32.23: Fix `statsTracker.ts` `tokensPerSecond` clamping (already in 28.3)

  * [ ] SubTask 32.24: Fix `security.ts` AES-GCM IV usage counter / rekey

  * [ ] SubTask 32.25: Fix `provenance.ts` `_mergedFrom` dedup (already in 28.6)

## Phase 5 — Verification

* [ ] Task 33: Run full test suite + typecheck + build

  * [ ] SubTask 33.1: `npx tsc --noEmit` passes

  * [ ] SubTask 33.2: `npm test` passes (update existing tests where behavior intentionally changed; add new tests for fixed bugs)

  * [ ] SubTask 33.3: `npm run build` succeeds (no `glob.sync` error; `pdfWorker.js` resolves; `dev` script works on Windows)

  * [ ] SubTask 33.4: `cargo test --all`, `cargo clippy --all -- -D warnings` (N/A — no Rust in this project)

  * [ ] SubTask 33.5: Manual smoke test: open non-English PDF; switch language; toggle smartSizing/maxOutputItems; export CSV with formula-leading values; rapid confirm dialogs; concurrent worker calls

# Task Dependencies

* Task 3 depends on Task 3.6 (workers must echo `id` before pool can match)

* Task 10 depends on Task 12 (preload must expose `secureKey:*` channels)

* Task 17 depends on nothing (independent)

* Task 21.7 depends on Task 21.1-21.5 (ipc.ts shapes must be correct before wrappers)

* Tasks 1-13 (Phase 1) should be done first; Phase 2 builds on Phase 1; Phase 3-4 are largely independent within their phase

* Task 33 (verification) depends on all other tasks

