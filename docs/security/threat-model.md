# Security & Threat Model

Amvelt TRACE operates on arbitrary, untrusted repositories. This document outlines our security architecture, threat model, and defensive controls.

---

## 1. Local-First & Air-Gapped Philosophy

- **Zero Cloud Dependence**: TRACE requires no account, no API key, and no cloud server.
- **Zero Source Code Transmission**: TRACE does NOT upload source code, ASTs, or metadata across the network.
- **Zero Telemetry by Default**: If analytics or telemetry are ever introduced, they will be strictly opt-in.

---

## 2. Threat Analysis & Mitigations

### Untrusted Code Execution
- **Threat**: A repository contains malicious JavaScript/TypeScript files designed to execute code when imported or analyzed.
- **Mitigation**: TRACE never executes repository code. Analysis is performed strictly using static AST parsing via `@babel/parser`. Code is never evaluated using `eval()`, `vm.runInContext()`, or dynamic `import()`.

### Subprocess Injection
- **Threat**: A repository with malicious branch names or commit messages executes arbitrary commands via shell interpolation.
- **Mitigation**: TRACE invokes system binaries (such as `git`) using `execFileSync` with explicit argument arrays. Shell string interpolation is strictly prohibited.

### Path Traversal & Symlink Escapes
- **Threat**: Malicious symlinks or paths containing `../` escape the repository root and read sensitive system files.
- **Mitigation**: All file paths are strictly resolved, validated to reside within `repoRoot`, and normalized to POSIX format.

### Resource Exhaustion (DoS Repositories)
- **Threat**: Deeply nested ASTs, gigantic binary files, or circular symlinks exhaust memory or CPU.
- **Mitigation**:
  - Configurable `maxFileSize` (default 2 MB) skips oversized files.
  - Fault-tolerant parser with error recovery logs warnings on malformed syntax without crashing the process.

### Secret Leakage
- **Threat**: Credentials, `.env` files, or private keys are accidentally indexed into `.codebase/` and committed to Git.
- **Mitigation**: Built-in `SecretFilter` automatically excludes `.env*`, `*.pem`, `*.key`, `id_rsa*`, and patterns defined in `.gitignore`. Secrets are never emitted in generated maps or error messages.
