# Security Policy

## Supported Versions

We release patches and security fixes for the following versions of Amvelt TRACE:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

---

## Reporting a Vulnerability

The Amvelt TRACE team takes the security of our developer tools and the repositories they inspect very seriously.

**Do NOT report security vulnerabilities via public GitHub issues.**

If you believe you have discovered a vulnerability, please report it through one of the following channels:
1. **GitHub Private Vulnerability Reporting**: Use the "Report a vulnerability" button under the **Security** tab of the [ABS-Trace repository](https://github.com/anubhav-n-mishra/ABS-Trace/security/advisories/new).
2. **Email**: If GitHub reporting is unavailable, send an email to **anubhav09.work@gmail.com** with the subject `[SECURITY] Amvelt TRACE Vulnerability Report`.

### What to Include in Your Report
To help us triage and resolve the issue quickly, please provide:
- A description of the vulnerability and its potential impact.
- Step-by-step instructions or a minimal reproduction script.
- The version of TRACE, Node.js runtime, and Operating System.
- Any potential mitigations you have identified.

---

## Response & Disclosure Process

1. **Acknowledgment**: We aim to acknowledge reports within 48 hours.
2. **Investigation**: We will investigate the issue and provide regular status updates.
3. **Patch & Advisory**: Once confirmed, a fix will be developed and released along with a GitHub Security Advisory.
4. **Attribution**: Reporters will be credited in the release notes and advisory (unless anonymity is requested).

---

## Security Guarantees & Threat Model

- **Local-First & Air-Gapped**: TRACE executes strictly locally. By default, zero source code, metadata, or telemetry is transmitted across the network.
- **Untrusted Code**: TRACE treats repository files as untrusted data. It does NOT evaluate or execute code from the repositories it scans; analysis is performed strictly via AST static parsing.
- **Secret Filtering**: TRACE automatically excludes `.env*`, private keys, and credential patterns from index generation.
- **Subprocess Safety**: TRACE invokes system binaries (such as `git`) with explicit argument vectors rather than shell string interpolation, mitigating command injection vulnerabilities.

For full architectural details, see [docs/security/threat-model.md](docs/security/threat-model.md).
