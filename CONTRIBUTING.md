# Contributing to Amvelt TRACE

Thank you for your interest in contributing to **Amvelt TRACE**! TRACE is an open-source, local-first developer tool that creates a living, semantic feature-oriented map of software codebases for human developers and AI coding agents.

We welcome contributions of all kinds: bug fixes, documentation improvements, new analyzers, test fixtures, performance optimizations, and CLI enhancements. You do not need to understand the entire codebase before making a contribution.

---

## Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating.

---

## Development Workflow

### 1. Prerequisites
- **Node.js**: v18.0.0 or later (Node 20+ recommended)
- **npm**: v9.0.0 or later
- **Git**: v2.30.0 or later

### 2. Fork and Clone
```bash
# Clone your fork
git clone https://github.com/<your-username>/ABS-Trace.git
cd ABS-Trace

# Add upstream remote
git remote add upstream https://github.com/anubhav-n-mishra/ABS-Trace.git
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Build the Project
```bash
npm run build
```

### 5. Running Tests
```bash
# Run unit tests
npm test

# Run tests against realistic fixtures
npm run test:fixtures

# Run all tests
npm run test:all
```

### 6. Type Checking and Linting
```bash
# Strict TypeScript validation
npm run typecheck

# Code quality check
npm run lint
```

---

## Repository Structure

TRACE is organized as a lightweight npm workspace:
- `packages/trace/`: The canonical implementation (`@anubhavm/trace`), containing:
  - `src/core/`: Stable URNs, Graph data structures, Store persistence, Token budgeting.
  - `src/analyzer/`: Babel AST parsing, route detection, database models, test mapping.
  - `src/detector/`: Automatic clustering, explicit feature loading, confidence scoring, evidence generation.
  - `src/indexer/`: Incremental hash diffing, multi-tier rename detection, drift calculation, validation.
  - `src/renderers/`: Terminal unicode tree, `FEATURE_INDEX.md` markdown generator, AI context formatting.
  - `src/cli/`: Unified Commander CLI entry points (`trace`, `abs-trace`, `codebase-map`).
  - `src/agent/`: Official AI agent skill generator (`.agents/skills/trace/SKILL.md`).
- `packages/amvelt-trace/`: The secondary branded distribution package (`@amvelt/trace`).
- `fixtures/`: 11 realistic test repositories (JavaScript, TypeScript, React, Node, Fullstack, Monorepo, Vibe-coded, etc.).
- `docs/`: Comprehensive architecture, concepts, CLI guides, and threat models.

---

## Contribution Guidelines

### Branching
Create a topic branch from `main`:
```bash
git checkout -b feat/my-new-feature
# or
git checkout -b fix/issue-description
```

### Commit Convention
We follow Conventional Commits:
- `feat:` A new user-facing feature
- `fix:` A bug fix
- `docs:` Documentation updates
- `test:` Adding or improving tests and fixtures
- `perf:` Performance improvements
- `refactor:` Code refactoring without behavioral changes
- `chore:` Build scripts, dependencies, or repository tooling

### Testing Expectations
- Every PR that modifies analyzer logic, graph structures, or CLI commands must include corresponding unit tests or fixture tests.
- Fixture-based testing is strongly encouraged for parser edge cases.

### PR Submission Checklist
Before opening a pull request, please verify:
- [ ] `npm test` passes completely.
- [ ] `npm run typecheck` passes without errors.
- [ ] `npm run lint` passes without warnings.
- [ ] New functionality is documented where applicable.
- [ ] No secrets, tokens, or environment files are included.
- [ ] PR description clearly describes WHAT changed, WHY, and HOW it was tested.

---

## Good First Issues

Looking for a place to start? Look for issues tagged:
- `good first issue`: Accessible tasks ideal for new contributors.
- `help wanted`: Specific features or improvements where community input is requested.
- `documentation`: Clarifying guides, adding examples, or improving docstrings.
- `parser`: Enhancing AST extraction or adding support for new framework routes/models.

---

## License Notice
By contributing to Amvelt TRACE, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
