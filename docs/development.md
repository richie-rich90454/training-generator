# Development Guide

This guide explains how to set up, develop, test, and package Training Generator.

## Prerequisites

- **Node.js** and **npm** installed on your system.
- **Ollama** running locally on port `11434` if you want to generate real training data (the app checks `http://localhost:11434/api/tags`).
- A Windows, macOS, or Linux development machine. The app detects the platform at runtime and adjusts UI attributes accordingly.

## Installation

Clone the repository and install dependencies:

```bash
npm install
```

The `postinstall` script runs `electron-builder install-app-deps` to install native dependencies for the current Electron version.

## Running in Development

Start the Vite dev server and the Electron main process concurrently:

```bash
npm run dev
```

This command:

1. Starts the Vite frontend dev server (typically on `http://localhost:5173`).
2. Launches Electron in development mode, loading the app from the Vite dev server.

In development mode, the main window automatically opens the Chrome DevTools.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Runs the production build with `tsx/esm` and Electron. |
| `npm run dev` | Starts Vite and Electron in development mode. |
| `npm run build` | Builds the main process and bundles the renderer with Vite. |
| `npm run build:main` | Compiles only the Electron main process using `scripts/build-main.mjs`. |
| `npm run preview` | Serves the production Vite bundle for preview. |
| `npm test` | Runs the full Vitest suite once. |
| `npm run test:unit` | Runs Vitest with verbose reporter output. |
| `npm run test:watch` | Runs Vitest in watch mode. |
| `npm run typecheck` | Runs TypeScript compilation without emitting files. |
| `npm run package:win` | Builds and packages the app for Windows. |
| `npm run package:mac` | Builds and packages the app for macOS. |
| `npm run package:linux` | Builds and packages the app for Linux. |

## Testing

Tests are written with **Vitest** and live in the `tests/` directory. The configuration in `vitest.config.ts` runs tests matching `tests/**/*.test.ts` in a Node environment with a 30-second default timeout.

Run the standard test suite:

```bash
npm test
```

For more detailed output:

```bash
npm run test:unit
```

To keep tests running while you develop:

```bash
npm run test:watch
```

## Type Checking

Before committing, verify that the TypeScript code compiles:

```bash
npm run typecheck
```

This runs `tsc --noEmit` and reports type errors without generating output files.

## Building and Packaging

### Production Build

Build both the main process and the renderer bundle:

```bash
npm run build
```

Output:

- `dist/` contains the bundled renderer frontend.
- `dist-main/` contains the compiled main process.

### Windows Packaging

Create an NSIS installer and a portable executable for Windows:

```bash
npm run package:win
```

Packaged artifacts are written to the `release/` directory by `electron-builder`.

## Code Style and Formatting

All source files in this project follow a dense, consistent formatting style defined in `AGENTS.md`. When contributing, please keep the following rules in mind:

1. **No blank lines** — remove empty lines between imports, functions, variables, and within code blocks.
2. **Indentation** — use four spaces per nesting level.
3. **Brace placement** — opening braces stay on the same line as the preceding keyword; closing braces start on a new line aligned with the opening statement.
4. **Conditionals** — write `if (condition){` on one line, and put `else if` and `else` on separate lines with their own opening braces.
5. **Operator spacing** — do not add spaces around `=`, arithmetic, or comparison operators. Add one space after colons in type annotations, after commas in argument lists, and around the `as` keyword.
6. **Function declarations and calls** — no space between the function name and the opening parenthesis.
7. **Variable declarations** — prefer `let`, with one declaration per line.
8. **Object literals** — keep opening braces on the same line; use a space after colons in key-value pairs.
9. **String concatenation** — preserve existing `+`-based concatenation style.
10. **Semicolons** — end statements with semicolons.
11. **Switch statements** — `switch (value){` on one line; indent `case` labels one level and case bodies another level.
12. **Comments** — keep `//` comments as they appear; preserve multi-line `/* ... */` comments.
13. **Imports** — list imports at the top, each on its own line, with no blank lines between them.
14. **No trailing spaces** — ensure every line ends cleanly.

Following these conventions keeps the codebase uniform and matches the formatting applied to the existing TypeScript files.
