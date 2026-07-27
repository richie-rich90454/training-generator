# Contributing to Training Generator

Thank you for your interest in contributing. This document explains how to get the project running locally, how to propose changes, and the standards we follow so contributions are easy to review and land.

## Table of contents

- [Where to start](#where-to-start)
- [Reporting issues](#reporting-issues)
- [Proposing changes (PR flow)](#proposing-changes-pr-flow)
- [Development setup](#development-setup)
- [Tests and CI](#tests-and-ci)
- [Type checking and linting](#type-checking-and-linting)
- [Commit messages and branch naming](#commit-messages-and-branch-naming)
- [Pull request checklist](#pull-request-checklist)
- [Internationalization](#internationalization)
- [Labels and good first issues](#labels-and-good-first-issues)
- [Code of conduct and security reports](#code-of-conduct-and-security-reports)
- [Recognition](#recognition)

## Where to start

- Read the [README](README.md) first to understand the app goals and usage.
- Check open issues for tasks that match your interests or skill level.
- Look for issues tagged `good first issue` or `help wanted` to get started.
- If you want to work on an issue, comment on it so others know and a maintainer can assign it to you.

## Reporting issues

- Search existing issues before opening a new one.
- When opening a new issue, include:
  - A short, descriptive title.
  - A clear description of the problem or feature request.
  - Steps to reproduce (for bugs).
  - Expected vs. actual behavior.
  - Environment details: OS, Node version, Ollama version, and the model used.
  - Attach logs or screenshots where helpful. Redact API keys and confidential content first.

## Proposing changes (PR flow)

1. Fork the repository and create a feature branch from `main`:
   ```bash
   git checkout -b feat/short-description
   ```
2. Make your changes, add or update tests, and ensure type checking and tests pass locally.
3. Push the branch to your fork and open a Pull Request against `richie-rich90454:main`.
4. Fill in the PR description with:
   - What you changed and why.
   - Any implementation notes or trade-offs.
   - How to test the change locally.
5. Address review comments. Maintainers may request changes before merging.
6. Once approved and CI is green, a maintainer will merge the PR.

Small, focused PRs land faster. If a change spans multiple concerns, split it into stacked PRs.

## Development setup

### Prerequisites

| Requirement | Minimum | Recommended |
| --- | --- | --- |
| Node.js | 20+ | 24 LTS |
| npm | 9+ | 10+ |
| Git | any | latest |
| Ollama | — | latest (optional, for model-related flows) |

CI matrix-tests against Node.js 20 and 22, so anything in that range is safe for local development.

### Quick start

```bash
# clone and install
git clone https://github.com/richie-rich90454/training-generator.git
cd training-generator
npm install

# start the app in development (Electron + Vite + SolidJS HMR)
npm run dev
```

To smoke-test the production renderer without packaging:

```bash
npm start
```

If you rely on Ollama locally:

- Ensure Ollama is installed and running (`ollama serve`).
- Pull any model you want to test with, for example `ollama pull llama3.2`.

See [Installation](docs/getting-started/installation.md) for native-module build dependencies and platform-specific notes.

## Tests and CI

- Tests run on [Vitest](https://vitest.dev/) with `@solidjs/testing-library` for renderer components. The v2.0.1 suite contains 4,868 tests across 184 files.
- Run the full suite once:
  ```bash
  npm test
  ```
- Watch mode for iterative development:
  ```bash
  npm run test:watch
  ```
- Coverage report (V8 native):
  ```bash
  npm run test:coverage
  ```
- Tests live in `tests/` and mirror the source structure. Files suffixed `-crucial.test.ts` cover the most load-bearing behavior of a module; treat their failures as release blockers.
- CI runs install, typecheck, lint, tests, and a build on every push and pull request via `.github/workflows/ci.yml`.

## Type checking and linting

The project does **not** use ESLint or Prettier. Linting is performed by the TypeScript compiler in strict mode:

```bash
npm run typecheck     # tsc --noEmit (strict mode)
npm run lint          # alias for tsc --noEmit
```

Both scripts are identical and must pass before a PR can merge. There is no `npm run format` script and no pre-commit hook configured; please run the type checker manually before pushing.

When adding code:

- Follow the formatting conventions already present in the file you are editing (4-space indent, braces on their own lines, no blank lines inside function bodies).
- Prefer readable code over clever code.
- Keep functions focused on a single responsibility.
- Avoid `any`; use `unknown` and narrow with type guards when the shape is genuinely dynamic.

## Commit messages and branch naming

### Branch names

Use a Conventional Commit prefix followed by a short kebab-case description:

- `feat/short-description`
- `fix/short-description`
- `docs/short-description`
- `refactor/short-description`
- `ci/short-description`
- `chore/short-description`

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/). The commit type must match the change:

| Type | When to use |
| --- | --- |
| `feat` | A new user-facing feature. |
| `fix` | A bug fix. |
| `docs` | Documentation-only changes. |
| `refactor` | Code restructuring with no behavior change. |
| `perf` | Performance improvement. |
| `style` | Formatting or whitespace only. |
| `test` | Adding or correcting tests. |
| `chore` | Tooling, dependencies, or config. |
| `ci` | CI workflow changes. |

Examples:

```
feat: add per-source filename template support
fix: prevent config panel overflow on small viewports
docs: document per-file output mode in user guide
```

Prefer many small, atomic commits over large ones. Each commit should compile and test green on its own so bisecting stays possible. Use the imperative mood in the subject line ("Add" not "Added"). Reference the issue number in the body when applicable (`Closes #123`).

## Pull request checklist

Before requesting a review:

- [ ] The change is small and focused.
- [ ] Tests added or updated for new behavior.
- [ ] `npm run typecheck` passes locally.
- [ ] `npm test` passes locally.
- [ ] `npm run build` succeeds.
- [ ] README or docs updated when public behavior changes.
- [ ] PR description explains *why* and *how* to test.
- [ ] No secrets, API keys, or sensitive data in commits, logs, or screenshots.
- [ ] Any new or changed user-facing string is added to `src/renderer/i18n.ts` for **all eight supported locales** (`en`, `zh-Hans`, `zh-Hant`, `ja`, `ko`, `es`, `fr`, `de`).
- [ ] SolidJS components use signals/stores/effects rather than React or Vue patterns.
- [ ] CSS classes match the existing design tokens; no inline styles unless unavoidable.

## Internationalization

Every user-facing string must be routed through the `t()` helper in `src/renderer/i18n.ts` and translated for all eight locales: `en`, `zh-Hans`, `zh-Hant`, `ja`, `ko`, `es`, `fr`, `de`. The locale code maps to a key in the translations object; missing keys fall back to English, which is treated as a bug, not a graceful degradation.

When adding a locale:

1. Add the locale code to the `Locale` type and the `translations` record.
2. Provide translations for every key used by `t()`.
3. Add a corresponding entry in the UI language selector.
4. Add RTL support tests if the locale is right-to-left.

## Labels and good first issues

- `good first issue` — approachable starting points for new contributors.
- `help wanted` — issues where community contributions are welcome.
- `bug` — confirmed defects.
- `enhancement` — feature requests accepted for development.
- `docs` — documentation improvements.
- `ci` — CI and release automation.

If you take an issue, comment to let others know you are working on it. If you need help, ask in the issue thread and a maintainer will assist.

## Code of conduct and security reports

- This project follows a Code of Conduct (see `CODE_OF_CONDUCT.md`). Be respectful and constructive.
- For security-sensitive reports, do **not** open a public issue. Use GitHub's private security advisory feature or contact the repository owner privately. See `SECURITY.md` for the disclosure process.

## Recognition

Contributors are recognized in the release notes for every release they influenced. Significant or repeated contributions may be acknowledged in the README acknowledgements section at the contributor's request. All contributions — code, docs, tests, issues, discussion — are valued.

---

Thanks for taking the time to improve Training Generator.
