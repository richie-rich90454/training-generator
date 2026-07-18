---
title: Testing
description: Test strategy, tooling, and running the 4,868-test suite for Training Generator.
outline: [2, 3]
---

# Testing

Training Generator uses **Vitest** with `@solidjs/testing-library` for component testing. The v2.0.1 suite contains 184 test files and 4,868 tests covering unit, integration, and system-level behavior, with full TypeScript strict-mode type checking.

## Toolchain

| Tool | Role |
| --- | --- |
| [Vitest](https://vitest.dev/) | Test runner, assertions, mocking |
| `@vitest/coverage-v8` | Native V8 coverage |
| `@solidjs/testing-library` | SolidJS component rendering and queries |
| `happy-dom` | DOM environment for renderer tests |
| `tsc --noEmit` | Strict type checking |

Configuration lives in `vitest.config.ts` and the global setup in `tests/setup.ts`.

## Commands

```bash
npm test                # Run the full suite once (4,868 tests across 184 files)
npm run test:watch      # Watch mode for iterative development
npm run test:coverage   # Coverage report via V8
npm run typecheck       # tsc --noEmit (strict mode)
```

::: tip Test before submitting
Always run `npm test` and `npm run typecheck` before opening a pull request. CI runs the same checks and will fail the build on any error.
:::

## Test layout

Tests live in the `tests/` directory and mirror the source structure. Each test file targets a module or component:

| Area | Example files |
| --- | --- |
| Renderer components | `tests/App.test.tsx`, `tests/Dashboard.test.tsx`, `tests/SettingsModal.test.tsx`, `tests/CommandPalette.test.tsx` |
| Core parsers | `tests/file-parser.test.ts`, `tests/file-parser-lazy.test.ts`, `tests/pdf-parser.test.ts` |
| Processing | `tests/chunker.test.ts`, `tests/processor.test.ts`, `tests/orchestrator-crucial.test.ts` |
| Providers | `tests/provider.test.ts`, `tests/provider-adapters.test.ts`, `tests/provider-extra.test.ts` |
| Exporters | `tests/exporters/*.test.ts` |
| Validators | `tests/validators/*.test.ts` |
| CLI | `tests/cli-index.test.ts`, `tests/cli-parsers.test.ts`, `tests/cli-provider.test.ts` |
| Workers | `tests/chunk-worker.test.ts`, `tests/dedup-worker.test.ts` |
| Security & resilience | `tests/security-crucial.test.ts`, `tests/checkpoint-crucial.test.ts`, `tests/rateLimiter-crucial.test.ts` |

The `-crucial` suffix marks tests that cover the most load-bearing behavior of a module; treat failures of these as release blockers.

## Test conventions

- **Renderer components** use `@solidjs/testing-library` to render SolidJS components into a `happy-dom` environment and assert on queried output.
- **Pure modules** (chunker, deduplicator, parsers, exporters) are tested directly with fixtures from `tests/fixtures/`.
- **Fixtures** for the file parser live in `tests/fixtures/file-parser/` and `tests/fixtures/file-parser-lazy/`, covering edge cases such as empty files, CRLF, unicode, path traversal, and unsupported extensions.
- **Integration tests** (`tests/integration.test.ts`, `tests/complete-functionality.test.ts`) exercise the end-to-end pipeline.
- **Memory safety** (`tests/memory-safety.test.ts`) guards against leaks during large jobs.

## Writing tests

When adding a feature:

1. Add a fixture if the feature consumes files.
2. Write a focused unit test alongside the module under test.
3. Cover edge cases (empty input, oversized input, invalid encoding).
4. Run `npm run test:watch` during development for fast feedback.
5. Ensure `npm run typecheck` passes — strict mode is enforced.

```ts
import { describe, it, expect } from 'vitest'
import { semanticChunk } from '../src/renderer/chunker'

describe('semanticChunk', () => {
  it('splits at sentence boundaries and preserves code blocks', () => {
    const text = 'First sentence. Second sentence.\n\n```js\nconst x = 1\n```'
    const chunks = semanticChunk(text, 1000, 0, false)
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.join('')).toContain('const x = 1')
  })
})
```

## CI

Continuous integration runs the full suite and type check on every push and pull request via GitHub Actions (`.github/workflows/ci.yml`). Releases are packaged via `.github/workflows/release.yml`.

<!-- v2.0.1 grew the suite from 3,300+ to 4,868 tests — one test per bug, deliberately. -->

## Next steps

- [Architecture](/architecture/overview.md) — module layout for test targeting.
- [Installation](/getting-started/installation.md) — local dev setup.
- [Troubleshooting](/troubleshooting/common-issues.md) — diagnosing test or runtime failures.
