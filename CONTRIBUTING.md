# Contributing to Training Generator

Thank you for your interest in contributing! This document explains how to get the project running locally, how to propose changes, and the standards we follow so contributions are easy to review and land.

Table of contents
- Where to start
- Reporting issues
- Proposing changes (PR flow)
- Development setup
- Tests & CI
- Linting & formatting
- Commit messages & branch naming
- Pull request checklist
- Labels and "good first issue"
- Code of conduct & reporting security issues
- Contact

Where to start
- Read the README first to understand the app goals and usage.
- Check open issues for tasks that match your interests or skill level.
- Look for issues tagged `good first issue` or `help wanted` to get started.

Reporting issues
- Search existing issues before opening a new one.
- When opening a new issue, include:
  - A short descriptive title
  - A clear description of the problem or feature request
  - Steps to reproduce (for bugs)
  - Expected vs actual behavior
  - Environment details (OS, Node version, Ollama running? model used)
  - Attach logs/screenshots where helpful

Proposing changes (PR flow)
1. Fork the repository and create a feature branch from `main`:
   - git checkout -b feat/short-description
2. Make your changes, add tests where applicable, and ensure linting passes.
3. Push your branch to your fork and open a Pull Request against `richie-rich90454:main`.
4. Fill the PR description with:
   - What you changed and why
   - Any implementation notes
   - How to test the change locally
5. Address review comments; maintainers will request changes if needed.
6. Once approved, a maintainer will merge the PR.

Development setup
Prerequisites
- Node.js 18+ and npm (or compatible Yarn)
- (Optional) [Ollama](https://ollama.com) running locally if you want to exercise model-related flows

Quick start
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
- Ensure Ollama is installed and running.
- Pull any model you want to test with, e.g.:
  - ollama pull <model-name>

Tests & CI
- We use Vitest for all tests, including renderer components with `@solidjs/testing-library`. Run tests with:
  - npm test
- TypeScript strict mode is enforced. Run the type checker with:
  - npm run typecheck
- CI runs on push/PR and will run install, typecheck, lint, tests, and an optional headless build.

Linting & formatting
- The project uses ESLint and Prettier (if configured). Run:
  - npm run lint
  - npm run format
  - npm run typecheck
- Please run linters, formatters, and the type checker before opening a PR.
- If a pre-commit hook is in place (husky), it will run lint/format automatically — keep changes small and focused.

Commit messages & branch naming
- Branch names:
  - feat/short-description
  - fix/short-description
  - docs/short-description
  - ci/short-description
- Commit style:
  - Use clear, imperative messages (e.g., "Add PDF parsing tests" not "Added...")
  - Conventional Commits are recommended:
    - feat: add export to JSONL
    - fix: handle corrupted PDF gracefully
    - chore: update deps
  - Squash or rebase commits before merge if requested by reviewers.

Pull request checklist
Before requesting a review:
- [ ] The change is small and focused
- [ ] Tests added or updated for new behavior
- [ ] `npm run typecheck` passes locally
- [ ] Linting passes locally
- [ ] README or docs updated if public behavior changes
- [ ] PR description explains *why* and *how* to test
- [ ] No sensitive data in commits
- [ ] Any new or changed user-facing string is added to `src/renderer/i18n.ts` for all supported languages
- [ ] SolidJS components use signals/stores/effects instead of React/Vue patterns; CSS classes in JSX match the existing design tokens

Labels and "good first issue"
- We welcome new contributors. Issues labeled `good first issue` are intended to be approachable starting points.
- If you take an issue, comment to let others know you're working on it.
- If you need help, ask in the issue thread and a maintainer will assist.

Code of conduct & reporting security issues
- This project follows a Code of Conduct (see CODE_OF_CONDUCT.md). Be respectful and constructive.
- For security-sensitive reports, please contact the repository owner privately (via the security feature on GitHub or email listed in the profile). Do not open a public issue.

File structure & where to add things
- /src - core app code
  - /src/renderer - SolidJS UI, stores, and framework-agnostic processing modules
  - /src/main.ts - Electron main process (kept untouched unless you are intentionally changing native behavior)
  - /src/core - shared business logic (parsers, types, utilities)
- /cli - command-line helpers (if used)
- /tests or /__tests__ - test suites
- /assets - images, demo GIFs, icons
- /examples - sample input files + generated outputs (see issue #1)

Frontend architecture notes
- The renderer is built with SolidJS and fine-grained reactivity.
- UI state lives in Solid stores under `src/renderer/stores/`.
- Components import plain vanilla CSS Modules (`*.module.css`) scoped with global class names so the rendered DOM stays identical to the original design.
- Business logic that does not need reactivity is kept in framework-agnostic modules such as `src/renderer/processing/orchestrator.ts`.

Adding examples, tests, or docs
- Add tests for parsers (PDF/DOCX/MD) in `tests/`.
- Add renderer component tests with `@solidjs/testing-library` in `tests/`.
- Add sample fixtures under `tests/fixtures/` or `/examples/` and include attribution if not created by you.
- Update README with usage examples or new flags.

Maintainers & reviewers
- The repo owner(s) will review PRs. Please be patient; reviews may take time.
- Small changes (docs, minor fixes) may be merged more quickly once CI passes.

Thanks!
Thanks for taking the time to improve Training Generator. Contributions of all kinds — code, docs, tests, discussion — are appreciated.
