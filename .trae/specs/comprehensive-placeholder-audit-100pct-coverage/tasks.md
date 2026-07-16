# Tasks

This task list is ordered for safe, verifiable progress. Each leaf task is a single focused change committed individually with a human-like `test:` / `chore:` / `refactor:` / `fix:` commit message. Tasks touching the same file MUST be sequential; tasks touching disjoint files MAY run in parallel. Get as many commits as possible

## Section 0 — Baseline & Honest Findings Report

* [x] Task 0.1: Capture the current baseline by running `npm run test:coverage` (or `npm test` if coverage tooling fails) and saving the per-file coverage summary to `.trae/specs/comprehensive-placeholder-audit-100pct-coverage/baseline-coverage.txt`. Do not modify any source code in this task.

* [x] Task 0.2: Write `AUDIT-FINDINGS.md` in the spec directory listing every real placeholder / non-functional / silent-failure finding discovered during the audit (empty catches, console.\* in renderer, missing component tests, DemoMode). For each: file path, line range, snippet, category, disposition, fix, verification. Include an opening "Expectation vs Reality" section explaining that the actual count is far lower than the user's 100–200 estimate.

## Section 1 — Coverage Tooling & Thresholds

* [x] Task 1.1: Update `vitest.config.ts` to expand `coverage.include` to `["src/**/*.ts", "src/**/*.tsx"]`, keep `exclude` for `src/types/**` and test files, and add a `thresholds` block with `lines: 90, functions: 90, branches: 85, statements: 90` and `perFile: true`. Commit as `chore: enforce per-file coverage thresholds`.

* [x] Task 2.1: (Placeholder for threshold-tuning after Section 5 lands — see Task 5.x below.) After component tests are added, re-run coverage and tighten any threshold that is consistently above the actual achieved coverage. Skip if thresholds already pass.

## Section 2 — Empty Catch Triage

* [x] Task 2.1: Triage empty `catch{}` in `src/main.ts` (lines 136, 142, 192, 477, 490, 699, 708, 733, 741, 754, 762, 773, 824, 827, 952, 991, 1142, 1558, 1565, 1566). For each, decide: cleanup-path (keep + add `// intentional: <reason>` comment) OR non-cleanup-path (replace with logged rejection). Commit as one `refactor: triage empty catches in main.ts` commit OR multiple per-area commits if cleaner.

* [x] Task 2.2: Replace `src/cli/index.ts:124` empty `catch { }` (config file load) with `catch (err) { console.warn("Failed to load config file:", err) }`. Commit as `fix: surface config file load errors in CLI`.

* [x] Task 2.3: Triage empty catches in `src/renderer/confirm.ts:70,75` — replace with logged rejections via `logger.warn`. Commit as `refactor: log onConfirm/onCancel errors instead of swallowing`.

* [x] Task 2.4: Triage empty catches in `src/renderer/i18n.ts:2144,2148` — these are localStorage access in environments without it. Add `// intentional: localStorage unavailable in SSR/private mode` comments and keep. Commit as `docs: document intentional empty catches in i18n`.

* [x] Task 2.5: Triage empty catches in `src/renderer/security.ts:43,66` — these are AES-GCM decrypt fallbacks that retry previous keys. Add `// intentional: decrypt fallback retries previous keys` comments and keep. Commit as `docs: document intentional empty catches in security`.

## Section 3 — Renderer Console → Logger Migration

* [x] Task 3.1: Add a thin pass-through wrapper in `src/renderer/logger.ts` if it lacks `log`, `warn`, `error`, `info` aliases (audit first; do not duplicate if already present). Commit as `refactor: expose logger.log/warn/error/info aliases`.

* [x] Task 3.2: Migrate `console.*` calls in `src/renderer/cache.ts` (5 calls) to `logger.*`. Commit as `refactor: route cache.ts logs through logger`.

* [x] Task 3.3: Migrate `console.*` calls in `src/renderer/checkpoint.ts` (3 calls) to `logger.*`. Commit as `refactor: route checkpoint.ts logs through logger`.

* [x] Task 3.4: Migrate `console.*` calls in `src/renderer/chunker.ts` (4 calls) to `logger.*`. Commit as `refactor: route chunker.ts logs through logger`.

* [x] Task 3.5: Migrate `console.*` calls in `src/renderer/configProfiles.ts` (4 calls) to `logger.*`. Commit as `refactor: route configProfiles.ts logs through logger`.

* [x] Task 3.6: Migrate `console.*` calls in `src/renderer/autoRegenerator.ts` (1 call) to `logger.*`. Commit as `refactor: route autoRegenerator.ts logs through logger`.

* [x] Task 3.7: Migrate `console.*` calls in `src/renderer/icons.ts` (1 call) to `logger.*`. Commit as `refactor: route icons.ts logs through logger`.

* [x] Task 3.8: Migrate `console.*` calls in `src/renderer/processor.ts` (3 calls) to `logger.*`. Commit as `refactor: route processor.ts logs through logger`.

* [x] Task 3.9: Migrate `console.*` call in `src/renderer/App.tsx:129` to `logger.error`. Commit as `refactor: route App.tsx missing-params error through logger`.

* [x] Task 3.10: Migrate `console.*` call in `src/renderer/components/TemplateEditor.tsx:85` to `logger.error`. Commit as `refactor: route TemplateEditor read error through logger`.

* [x] Task 3.11: Audit `src/core/fileParser.ts` and `src/core/fileParserLazy.ts` `console.log("Large file detected...")` calls — replace with `logger.debug` (or keep as `console.log` if these are main-process-only modules that legitimately use stdout; decide per call). Commit as `refactor: route fileParser large-file logs through logger`.

* [x] Task 3.12: Audit remaining `console.*` calls in `src/core/*` and `src/renderer/**` (excluding `logger.ts` files, `src/cli/**`, `src/main.ts`, `src/workers/pdfWorker.ts`) and migrate any non-legitimate ones to `logger.*`. Commit as one or more `refactor:` commits grouped by file.

## Section 4 — DemoMode Lockdown

* [x] Task 4.1: Add a unit test in `tests/processor-extra.test.ts` (or a new `tests/processor-demo-mode.test.ts`) that asserts `getDemoResponse` returns one of the i18n `demoResponse.*` strings for `instruction` and `conversation` processing types. Commit as `test: lock down DemoMode getDemoResponse`.

* [x] Task 4.2: Add a unit test that asserts `processChunks` with `demoMode === true` does NOT call `provider.generate` and produces items from the demo strings. Commit as `test: assert DemoMode bypasses provider.generate`.

* [x] Task 4.3: Add a unit test that asserts `enableDemoMode` / `disableDemoMode` flip the flag and that `appStore` logs `log.demoModeEnabled` / `log.demoModeDisabled`. Commit as `test: assert DemoMode toggle is logged`.

## Section 5 — Missing Component Tests (Critical for 100% Coverage)

Each task adds a `tests/<Component>.test.tsx` file using `@solidjs/testing-library`. Stub stores via plain signals. Assert rendering + at least one interaction + at least one cleanup path.

* [x] Task 5.1: Add `tests/UploadCard.test.tsx` — cover drag enter/leave/over/drop, file input click, keyboard activation, file list rendering with status, remove button, clear-all button. Commit as `test: cover UploadCard component`.

* [x] Task 5.2: Add `tests/TemplateEditor.test.tsx` — cover template load, edit, save, variable substitution, read-error path (currently `console.error("Failed to read template file")`). Commit as `test: cover TemplateEditor component`.

* [x] Task 5.3: Add `tests/SettingsModal.test.tsx` — cover modal open/close, settings form binding, save, cancel, all toggle switches and dropdowns. Commit as `test: cover SettingsModal component`.

* [x] Task 5.4: Add `tests/ProcessingCard.test.tsx` — cover progress bar binding, start/stop button states, status text reactivity, retry button. Commit as `test: cover ProcessingCard component`.

* [x] Task 5.5: Add `tests/OutputCard.test.tsx` — cover output rendering, live stream `<Show>` block, copy button, export button, auto-scroll on stream update. Commit as `test: cover OutputCard component`.

* [x] Task 5.6: Add `tests/Dashboard.test.tsx` — cover every `DashboardMetrics` field rendering, reactivity to `uiStore.dashboardMetrics()`, zero-state, large-number formatting. Commit as `test: cover Dashboard component`.

* [x] Task 5.7: Add `tests/ConfigPanel.test.tsx` — cover provider switching, model combobox binding, API key/base URL/ollama host inputs, custom prompt textarea, two-way binding to `settingsStore`. Commit as `test: cover ConfigPanel component`.

* [x] Task 5.8: Add `tests/Footer.test.tsx` — cover status text and version display reactivity. Commit as `test: cover Footer component`.
* [x] Task 5.9: Add `tests/ContentGrid.test.tsx` — cover splitter drag start/move/end, mousemove/mouseup listener cleanup, `splitter-active` class toggle. Commit as `test: cover ContentGrid component`.
* [x] Task 5.10: Add `tests/Devtools.test.tsx` — cover devtools panel rendering and state. Commit as `test: cover Devtools component`.
* [x] Task 5.11: Add `tests/Icon.test.tsx` — cover icon rendering, SVG sanitization, missing-icon fallback. Commit as `test: cover Icon component`.
* [x] Task 5.12: Add `tests/StatusPanel.test.tsx` — cover Ollama status display, model list rendering, refresh button click handler. Commit as `test: cover StatusPanel component`.
* [x] Task 5.13: Add `tests/TitleBar.test.tsx` — cover window controls (minimize/maximize/close) wired to IPC. Commit as `test: cover TitleBar component`.
* [x] Task 5.14: Add `tests/App.test.tsx` — cover app initialization, store wiring, lifecycle, error boundary for missing required parameters. Commit as `test: cover App component`.

## Section 6 — Edge-Case & Branch-Coverage Expansion

Each task targets an existing test file and adds the missing branches. Run `npm run test:coverage` after each to confirm the targeted file's coverage increased.

* [x] Task 6.1: Expand `tests/processor-extra.test.ts` with abort-mid-flight, batch-failure-fallback, concurrency-limit, and cached-result branches in `src/renderer/processor.ts`. Commit as `test: cover processor abort/batch/concurrency branches`.

* [x] Task 6.2: Expand `tests/provider-extra.test.ts` with retry/backoff, abort propagation, streaming token assembly, and base-URL construction branches in `src/renderer/provider.ts`. Commit as `test: cover provider retry/abort/streaming branches`.

* [x] Task 6.3: Expand `tests/appStore-crucial.test.ts` with reset-between-runs, Ollama-offline warning (non-block), custom-model-allowed, staging-clear, and abort-in-finally branches in `src/renderer/stores/appStore.ts`. Commit as `test: cover appStore reset/warn/abort branches`.

* [x] Task 6.4: Expand `tests/uiStore-crucial.test.ts` with `tickDashboard` derived-field computation, `previewTimer` cleanup, `dashboardInterval` cleanup, and `liveStreamText` 5000-char rolling buffer branches in `src/renderer/stores/uiStore.ts`. Commit as `test: cover uiStore tick/cleanup/buffer branches`.

* [x] Task 6.5: Expand `tests/outputStore-crucial.test.ts` with `appendOutput` clears staging, `stageItems` dedup, `exportOutput` format dispatch, `copyOutput` clipboard-failure path in `src/renderer/stores/outputStore.ts`. Commit as `test: cover outputStore staging/export/copy branches`.

* [x] Task 6.6: Expand `tests/main-ipc.test.ts` and `tests/main-stream-handler.test.ts` with custom host/port forwarding, stream cleanup on abort, no-data timer teardown, and sender.send-when-destroyed branches in `src/main.ts`. Commit as `test: cover main IPC/stream cleanup branches`.

* [x] Task 6.7: Expand `tests/chunker-extra.test.ts` with MAX\_CHUNKS early-exit, MAX\_CHUNK\_ITERATIONS early-exit, oversized-chunk split, and overlap-edge branches in `src/renderer/chunker.ts`. Commit as `test: cover chunker early-exit/overlap branches`.

* [x] Task 6.8: Expand `tests/cache.test.ts` with load-failure, save-failure, clear-failure, and warm-failure branches in `src/renderer/cache.ts`. Commit as `test: cover cache error branches`.

* [x] Task 6.9: Expand `tests/security-crucial.test.ts` with rekey threshold, previous-key fallback, localStorage fallback, and decrypt-failure branches in `src/renderer/security.ts`. Commit as `test: cover security rekey/fallback branches`.

* [x] Task 6.10: Expand `tests/i18n-renderer-crucial.test.ts` with `applyLanguage` localStorage-missing branch, missing-key fallback, and RTL detection branches in `src/renderer/i18n.ts`. Commit as `test: cover i18n fallback branches`.

* [x] Task 6.11: Expand `tests/cliRunner.test.ts` with DI-default-throws, profile load, override-merge, and dry-run branches in `src/core/cliRunner.ts`. Commit as `test: cover cliRunner DI/profile/override branches`.

* [x] Task 6.12: Expand `tests/validators/toxicityValidator.test.ts` with `TensorFlowToxicityScorer` module-missing branch and `RuleBasedToxicityScorer` word-list override branch. Commit as `test: cover toxicity scorer fallback branches`.

* [x] Task 6.13: Audit coverage report for any remaining source file below 90% line coverage and add targeted tests. Commit as `test: close remaining coverage gaps`.

## Section 7 — Verification

* [x] Task 7.1: Run `npm run lint` (typecheck) and fix any new type errors introduced by the logger migration or test additions. Commit as `fix: resolve typecheck errors from audit`.

* [x] Task 7.2: Run `npm test` and ensure all previously-passing tests still pass (4,176+ baseline). Commit fixes for any regressions as `fix(test): <regression>`.

* [x] Task 7.3: Run `npm run test:coverage` and confirm the per-file thresholds (lines 90 / functions 90 / branches 85 / statements 90) pass across `src/**/*.ts` and `src/**/*.tsx`. Save the final coverage summary to `.trae/specs/comprehensive-placeholder-audit-100pct-coverage/final-coverage.txt`. Commit the summary as `docs: add final coverage summary`.

* [x] Task 7.4: Run `npm run build` and verify no build warnings or errors. Commit fixes as `fix(build): <issue>`.

* [x] Task 7.5: Verify each code/audit change is a single commit with a descriptive message following the existing repo style (`fix:` / `refactor:` / `test:` / `chore:` / `docs:`). No batch commits across unrelated areas.

* [x] Task 7.6: Update `AUDIT-FINDINGS.md` with the verification status of every finding (pass/fail) and the commit SHA that resolved it. Commit as `docs: mark audit findings resolved`.

# Task Dependencies

* Task 0.1 (baseline coverage) MUST run first to capture the starting point.

* Task 0.2 (AUDIT-FINDINGS.md) depends on the initial audit pass and SHOULD be written early; it is updated by Task 7.6.

* Section 1 (tooling) SHOULD land before Section 5/6 so the coverage gate is in place while tests are added — but if the thresholds are too high to start, loosen them in Task 1.1 and tighten in Task 2.1.

* Section 2 (empty catch triage) is independent of Sections 3–6 and MAY be parallelized.

* Section 3 (logger migration) is independent of Sections 2, 4, 5, 6 and MAY be parallelized — but Task 3.1 (logger API) MUST land before Tasks 3.2–3.12.

* Section 4 (DemoMode lockdown) is independent and MAY be parallelized.

* Section 5 (component tests) is independent per component — all 14 tasks MAY be parallelized across sub-agents (each touches a disjoint new test file).

* Section 6 (edge-case expansion) touches existing test files; tasks within the same test file MUST be sequential, but different test files MAY be parallelized.

* Section 7 (verification) depends on all other sections.

