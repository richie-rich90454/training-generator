# Security Policy

## Supported Versions

This project maintains security fixes for released versions. Update this table when publishing releases or changing support policy.

| Version | Supported          |
| ------- | ------------------ |
| main (current) | :white_check_mark: |
| < main | :x: |

(Replace the table above with specific semver ranges for your project.)

## Reporting a Vulnerability

Preferred: Use GitHub Security Advisories for private coordinated disclosure:
1. In this repository, go to Security → Advisories → New draft security advisory.
2. Submit the advisory with details and indicate your disclosure preference (private until fixed or coordinated disclosure).

If GitHub Security Advisories are not available, email a report to: security@richie-rich90454.dev
- Include the details requested in the Report template section below.
- If you prefer encrypted email, include a PGP public key in the report; see the PGP section.

If neither option is available, open a public issue marked clearly as a security report (not recommended).

### What to expect after reporting
- Acknowledgement within 72 hours.
- Regular status updates at least every 7 days while the issue is being assessed and fixed.
- Coordination on remediation and disclosure; an advisory will be published once a fix is available.

## Report template

Please include as much of the following as possible:

- Summary (one-line)
- Affected versions (e.g., v1.2.3)
- Vulnerability type (e.g., RCE, XSS, information disclosure)
- Steps to reproduce (minimal repro)
- Proof-of-concept or sample payload (if safe to share)
- Expected vs actual behavior
- Suggested mitigations or fixes (optional)
- Contact information and disclosure preference (private/coordinated/public)
- Environment details (OS, Node.js version, Ollama running locally? model used?)

Example:

Summary: Arbitrary file read via path traversal in import routine  
Affected versions: v1.0.0 — v1.2.0  
Steps to reproduce:
1. Open the app and import a filename such as "../../../etc/passwd"
2. The app returns contents of the file  
Proof-of-concept: [paste minimal PoC]  
Expected behavior: Import should be restricted to allowed paths only.  
Contact: yourname@example.com  
Disclosure preference: coordinate privately until fix is available

## Response & remediation timeline

- Acknowledge receipt: within 72 hours.
- Initial triage and severity assessment: within 7 days.
- Provide an ETA for a fix or mitigation plan: within 14 days when feasible.
- Target fix timeframe for critical/high severity issues: within 90 days depending on complexity and coordination requirements.

We will coordinate on disclosure timing and request a CVE if appropriate.

## CVE and public advisory

When appropriate we will work with the reporter to request a CVE and publish a public advisory describing the issue, affected versions, remediation steps, and the fixed release.

## Reporting encrypted data (PGP)

If you prefer encrypted reports, include your PGP public key or fingerprint and we will use it to encrypt sensitive information. You may also provide an encrypted payload using the maintainer's public key if available.

PGP public key (optional):

-----BEGIN PGP PUBLIC KEY BLOCK-----
<replace-with-key-or-remove-section>
-----END PGP PUBLIC KEY BLOCK-----

## Other notes

- Do not include passwords, API keys, or other sensitive credentials in public reports.
- If the vulnerability is in a dependency, include dependency coordinates (name + version + URL).
- If you are unsure whether a report is sensitive, use the GitHub Security Advisory or the security email above.

## Enabling security settings on GitHub

To enable this policy in the repository UI:
- Add this file as SECURITY.md in the repository root.
- In Repository Settings → Security & analysis, enable "Security policy" and "Dependabot alerts" as desired.

Thank you for helping keep Training Generator secure.
