# Security Policy

## Supported Versions

Training Generator is actively developed on `main`. Security fixes are applied
to the current release line and backported when practical. Older versions may
not receive fixes.

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Use **GitHub Security Advisories** for private, coordinated disclosure:

1. Go to the repository's **Security** tab.
2. Select **Advisories → New draft security advisory**.
3. Submit the advisory with full details and your disclosure preference
   (private until fixed, or coordinated public disclosure).

Direct link:
[Report a vulnerability](https://github.com/richie-rich90454/training-generator/security/advisories/new)

If GitHub Security Advisories are unavailable, email the maintainer at
`richard@richardsblogs.com` with the subject `Security report: Training Generator`.

### What to include

- A one-line summary of the issue.
- Affected versions (e.g., v2.0.0–v2.0.1).
- Vulnerability type (e.g., RCE, XSS, path traversal, information disclosure).
- Minimal steps to reproduce.
- Proof of concept or sample payload (if safe to share).
- Expected vs actual behavior.
- Suggested mitigation or fix (optional).
- Your contact details and disclosure preference.

## Response Timeline

| Stage                                | Target                  |
| ------------------------------------ | ----------------------- |
| Acknowledge receipt of report        | Within 48 hours         |
| Initial triage and severity rating   | Within 7 days           |
| Mitigation plan / fix ETA            | Within 14 days          |
| Fix for critical/high severity issues| Within 90 days          |

Status updates are provided at least every 7 days while the issue is open. We
coordinate with you on disclosure timing and request a CVE when appropriate.
A public advisory is published once a fixed release is available.

## Scope

**In scope:**

- The Training Generator Electron application (renderer, main process, preload).
- File parsing and processing pipelines under `src/core` and `src/renderer`.
- Local AI provider integrations (e.g., Ollama).
- Encrypted credential storage and the Content Security Policy.
- The build and packaging configuration.
- The published GitHub Actions workflows under `.github/workflows`.

**Out of scope:**

- Vulnerabilities in third-party cloud providers (OpenAI, Anthropic, Google
  Gemini) — report those to the respective provider.
- Issues that require the attacker to already have local code execution on the
  victim's machine.
- Self-XSS or issues only exploitable by the user pasting payloads into their
  own prompts.

## Safe Disclosure

- Do not include passwords, API keys, tokens, or other secrets in public reports.
- If the vulnerability is in a dependency, include the dependency name, version,
  and upstream URL.
- When in doubt about whether a report is sensitive, use private reporting.

Thank you for helping keep Training Generator and its users safe.
