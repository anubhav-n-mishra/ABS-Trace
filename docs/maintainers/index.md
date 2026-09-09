# Maintainer Guide

This guide describes operational procedures for maintaining and releasing **Amvelt TRACE**.

---

## Repository Architecture

```
packages/
├── trace/        # Canonical implementation (@anubhavm/trace)
└── amvelt-trace/ # Branded secondary distribution (@amvelt/trace)
```

The canonical package contains the core graph engine, AST analyzers, CLI commands, and renderers. The secondary distribution is a thin re-export wrapper declaring a direct dependency on `@anubhavm/trace`.

---

## Release Process

Releases are fully automated via GitHub Actions using OIDC Trusted Publishing.

### Steps to Release:
1. Ensure all tests and hygiene checks pass locally:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run test:fixtures
   npm run check:hygiene
   ```
2. Update `CHANGELOG.md` with release notes under a new version heading (e.g. `## [0.2.0] - YYYY-MM-DD`).
3. Bump versions in `packages/trace/package.json` and `packages/amvelt-trace/package.json`.
4. Commit and push:
   ```bash
   git commit -am "chore: release v0.2.0"
   git tag v0.2.0
   git push origin main --tags
   ```
5. GitHub Actions workflow `.github/workflows/release.yml` will:
   - Run all CI tests across Linux, macOS, and Windows.
   - Run `check:hygiene`.
   - Publish `@anubhavm/trace` and `@amvelt/trace` with npm provenance.
   - Create the official GitHub release.
