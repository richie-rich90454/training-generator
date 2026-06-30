# Tasks

> Commit as you go. Each subtask below maps to one human-like commit unless noted otherwise. Target: ≥78 commits across all workstreams.

## Workstream A: UI/UX Overhaul

* [x] Task A1: Audit current UI and list issues

  * [x] SubTask A1.1: Review `index.html`, `src/styles/main.css`, and renderer modules for visual and interaction bugs

  * [x] SubTask A1.2: Document findings (temperature slider, spacing, focus, modal, responsive, etc.) in a short audit note

* [x] Task A2: Fix temperature slider

  * [x] SubTask A2.1: Move temperature slider logic from inline script into `src/renderer/uiManager.ts` and bind input/change events

  * [x] SubTask A2.2: Correct `--range-fill` calculation so the fill matches the thumb position across 0.0–1.0

  * [x] SubTask A2.3: Ensure the numeric display updates immediately on input and on load

  * [x] SubTask A2.4: Persist temperature value with other settings and restore it on launch

* [x] Task A3: Refine CSS design tokens

  * [x] SubTask A3.1: Audit CSS variables and remove any leftover glassmorphism/blur/backdrop-filter effects

  * [x] SubTask A3.2: Standardize spacing scale to 4/8/12/16/24 and ensure all components use the variables

  * [x] SubTask A3.3: Standardize border-radius tokens and remove arbitrary hardcoded radii

  * [x] SubTask A3.4: Unify shadow scale and ensure shadows are subtle and consistent

* [x] Task A4: Redesign header

  * [x] SubTask A4.1: Improve header alignment, icon sizing, and title/subtitle hierarchy

  * [x] SubTask A4.2: Add clear hover/active states for header icon buttons

  * [x] SubTask A4.3: Ensure header works at 1000×700 without wrapping or clipping

* [x] Task A5: Redesign file upload area

  * [x] SubTask A5.1: Improve drag-over feedback and visual affordance

  * [x] SubTask A5.2: Fix upload area click target so it does not conflict with the browse button

  * [x] SubTask A5.3: Add accessible focus state and keyboard activation (Space/Enter)

* [x] Task A6: Redesign selected-files list

  * [x] SubTask A6.1: Improve file-item spacing, alignment, and remove button hit area

  * [x] SubTask A6.2: Add clear status icons and labels (waiting/processing/completed/failed)

  * [x] SubTask A6.3: Ensure long file names truncate gracefully with tooltips

* [x] Task A7: Redesign processing card

  * [x] SubTask A7.1: Improve progress bar container, label alignment, and percentage display

  * [x] SubTask A7.2: Make processing log more readable with better entry spacing and color contrast

  * [x] SubTask A7.3: Add empty/welcome state and clear processing-stopped state

* [x] Task A8: Redesign output preview card

  * [x] SubTask A8.1: Improve output preview header and action button grouping

  * [x] SubTask A8.2: Style the virtual-list container and item rows consistently

  * [x] SubTask A8.3: Ensure copy/export buttons enable/disable correctly with clear disabled state

* [x] Task A9: Redesign configuration panel

  * [x] SubTask A9.1: Improve form-group spacing, label alignment, and icon consistency

  * [x] SubTask A9.2: Restyle selects/inputs for a professional form look

  * [x] SubTask A9.3: Ensure provider-dependent fields show/hide smoothly without layout jumps

* [x] Task A10: Redesign system status card

  * [x] SubTask A10.1: Improve status indicator layout and color meaning

  * [x] SubTask A10.2: Ensure stats align and update cleanly during processing

* [x] Task A11: Redesign footer

  * [x] SubTask A11.1: Improve footer spacing and link grouping

  * [x] SubTask A11.2: Ensure version/status text is legible and not clipped

* [x] Task A12: Redesign settings modal

  * [x] SubTask A12.1: Improve modal header, close button, and section dividers

  * [x] SubTask A12.2: Fix focus trap so Tab/Shift+Tab cycles correctly within the modal

  * [x] SubTask A12.3: Ensure Escape closes only the top modal and restores focus

* [x] Task A13: Accessibility and interaction polish

  * [x] SubTask A13.1: Add missing `aria-label` attributes to icon-only controls

  * [x] SubTask A13.2: Ensure all interactive elements have visible `:focus-visible` outlines

  * [x] SubTask A13.3: Respect `prefers-reduced-motion` for all transitions and animations

  * [x] SubTask A13.4: Verify color contrast meets WCAG AA for normal text

* [x] Task A14: Responsive and platform polish

  * [x] SubTask A14.1: Fix responsive breakpoints so the layout never requires horizontal scrolling

  * [x] SubTask A14.2: Adjust platform-specific Windows overrides to match the new professional style

  * [x] SubTask A14.3: Verify minimum window size (1000×700) usability

* [x] Task A15: UI verification

  * [x] SubTask A15.1: Run the app in development and visually inspect every section

  * [x] SubTask A15.2: Run `npx tsc --noEmit` and fix any type regressions introduced by DOM changes

## Workstream B: Native Splash Screen

* [x] Task B1: Diagnose splash screen failure

  * [x] SubTask B1.1: Trace `startSplash` and `stopSplash` calls in `src/main.ts`

  * [x] SubTask B1.2: Verify `native-splash/splash.exe` exists and is executable

  * [x] SubTask B1.3: Identify why the splash does not appear in dev or packaged builds

* [x] Task B2: Fix splash lifecycle in main process

  * [x] SubTask B2.1: Call `startSplash()` immediately in `app.whenReady()` before heavy initialization

  * [x] SubTask B2.2: Ensure `stopSplash()` is called reliably when the main window finishes loading

  * [x] SubTask B2.3: Add guards so `stopSplash()` is safe to call multiple times

* [x] Task B3: Fix splash executable resolution

  * [x] SubTask B3.1: Correct `splash.exe` path lookup for development (`native-splash/splash.exe`)

  * [x] SubTask B3.2: Correct `splash.exe` path lookup for packaged ASAR builds (`resources/native-splash/splash.exe`)

  * [x] SubTask B3.3: Add logging when splash cannot be found for debugging

* [x] Task B4: Improve splash implementation

  * [x] SubTask B4.1: Review `native-splash/splash.cpp` for resource leaks or centering issues

  * [x] SubTask B4.2: Recompile `splash.exe` with `g++ splash.cpp -O2 -std=c++11 -mwindows -lgdiplus -o splash.exe`

  * [x] SubTask B4.3: Ensure the compiled binary is tracked in git

* [x] Task B5: Verify splash behavior

  * [x] SubTask B5.1: Verify splash shows during `npm run dev` on Windows

  * [x] SubTask B5.2: Verify splash shows in packaged Windows build

  * [x] SubTask B5.3: Confirm splash process exits when the main window loads

## Workstream C: Vitest Migration & Test Expansion

* [x] Task C1: Remove Jest artifacts

  * [x] SubTask C1.1: Delete `jest.config.ts`

  * [x] SubTask C1.2: Remove any Jest/ts-jest dependencies from `package.json`

  * [x] SubTask C1.3: Audit `tests/` for Jest-specific APIs (`jest.fn`, `describe`/`it` globals) and convert if necessary

  * [x] SubTask C1.4: Run `npm test` to confirm Vitest-only execution

* [x] Task C2: Expand chunker tests

  * [x] SubTask C2.1: Add boundary tests for `semanticChunk` and `simpleChunk`

  * [x] SubTask C2.2: Add tests for overlap behavior, empty input, and very long input

  * [x] SubTask C2.3: Add tests for sentence boundary preservation

* [x] Task C3: Expand deduplicator tests

  * [x] SubTask C3.1: Add tests for exact duplicates

  * [x] SubTask C3.2: Add tests for near-duplicates above/below threshold

  * [x] SubTask C3.3: Add tests for empty input and unique items

* [x] Task C4: Expand output manager tests

  * [x] SubTask C4.1: Add tests for each export format (jsonl, json, csv, text, chatml)

  * [x] SubTask C4.2: Add tests for `createTrainingItem` across output formats

  * [x] SubTask C4.3: Add tests for copy and escape logic

* [x] Task C5: Expand file manager tests

  * [x] SubTask C5.1: Add tests for file selection, duplicate detection, and removal

  * [x] SubTask C5.2: Add tests for drag-and-drop event handling

  * [x] SubTask C5.3: Add tests for process button enablement logic

* [x] Task C6: Expand UI manager helper tests

  * [x] SubTask C6.1: Add tests for `escapeHtml`, `sanitizeText`, `escapeCsvField`

  * [x] SubTask C6.2: Add tests for log icon selection and progress clamping

  * [x] SubTask C6.3: Add tests for settings persistence helpers

* [x] Task C7: Expand provider tests

  * [x] SubTask C7.1: Add tests for Ollama provider request shaping and error handling

  * [x] SubTask C7.2: Add tests for OpenAI-compatible provider request shaping and error handling

  * [x] SubTask C7.3: Add tests for provider factory and health checks

* [x] Task C8: Expand processor tests

  * [x] SubTask C8.1: Add tests for chunk processing with mocked providers

  * [x] SubTask C8.2: Add tests for abort behavior

  * [x] SubTask C8.3: Add tests for demo mode

* [x] Task C9: Expand cache tests

  * [x] SubTask C9.1: Add tests for cache hit/miss behavior

  * [x] SubTask C9.2: Add tests for cache clearing and stats

* [x] Task C10: Expand stats tracker tests

  * [x] SubTask C10.1: Add tests for token counting and timing

  * [x] SubTask C10.2: Add tests for warning thresholds

* [x] Task C11: Expand utility tests

  * [x] SubTask C11.1: Add tests for security helpers (encrypt/decrypt roundtrip)

  * [x] SubTask C11.2: Add tests for logger formatting and level filtering

  * [x] SubTask C11.3: Add tests for i18n key resolution and fallback

  * [x] SubTask C11.4: Add tests for quality validator rules

* [x] Task C12: Add integration tests

  * [x] SubTask C12.1: Add end-to-end processing flow test with mocked provider

  * [x] SubTask C12.2: Add checkpoint save/load flow test

  * [x] SubTask C12.3: Add export/copy integration test

* [x] Task C13: Verify coverage target

  * [x] SubTask C13.1: Count total test cases and verify the suite approaches 1000 cases

  * [x] SubTask C13.2: Run `npm run test:unit` and ensure all tests pass

  * [x] SubTask C13.3: Run `npm run typecheck` and fix any test-related type errors

## Workstream D: Documentation

* [x] Task D1: Create documentation structure

  * [x] SubTask D1.1: Create `docs/` folder

  * [x] SubTask D1.2: Add a `docs/README.md` index linking to all guides

* [x] Task D2: Write user guide

  * [x] SubTask D2.1: Document installation, first launch, file upload, configuration, processing, and export

  * [x] SubTask D2.2: Include screenshots or UI descriptions where helpful

* [x] Task D3: Write configuration guide

  * [x] SubTask D3.1: Document every setting in the configuration panel

  * [x] SubTask D3.2: Document saved profiles and presets

* [x] Task D4: Write provider guide

  * [x] SubTask D4.1: Document Ollama setup and model selection

  * [x] SubTask D4.2: Document OpenAI, Anthropic, and Gemini configuration

* [x] Task D5: Write architecture guide

  * [x] SubTask D5.1: Document main vs renderer process split

  * [x] SubTask D5.2: Document key modules and data flow

* [x] Task D6: Write development guide

  * [x] SubTask D6.1: Document dev setup, scripts, testing, and build/packaging

  * [x] SubTask D6.2: Document code style and formatting rules from `AGENTS.md`

* [x] Task D7: Write troubleshooting guide

  * [x] SubTask D7.1: Document common Ollama, PDF, and export issues

  * [x] SubTask D7.2: Document how to collect logs and report issues

* [x] Task D8: Write keyboard shortcuts guide

  * [x] SubTask D8.1: List all supported shortcuts with context and action

* [x] Task D9: Link documentation

  * [x] SubTask D9.1: Update root `README.md` to point to `docs/`

  * [x] SubTask D9.2: Update footer documentation link to open local `docs/user-guide.md` when available

## Workstream E: Final Verification

* [x] Task E1: Quality gates

  * [x] SubTask E1.1: Run `npm run typecheck` and fix all errors

  * [x] SubTask E1.2: Run `npm test` and fix all failures

  * [x] SubTask E1.3: Run `npm run build` and fix all build errors

* [ ] Task E2: Packaging verification

  * [ ] SubTask E2.1: Run `npm run package:win` and confirm the portable `.exe` launches

  * [ ] SubTask E2.2: Confirm splash screen appears and exits correctly in the packaged build

  * [ ] SubTask E2.3: Confirm the new UI renders correctly in the packaged build

# Task Dependencies

* Workstreams A, B, C, and D are independent and can run in parallel.

* Task A15 depends on Tasks A2–A14.

* Task B5 depends on Tasks B2–B4.

* Task C13 depends on Tasks C1–C12.

* Task D9 depends on Tasks D2–D8.

* Task E1 depends on Tasks A15, B5, C13, and D9.

* Task E2 depends on Task E1.

after all tasks are done, add the tag of v1.4.0 to the last commit

