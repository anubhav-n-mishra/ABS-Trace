# Changelog

All notable changes to **Amvelt TRACE** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-09-09

### Added
- **Core Graph Engine**: Directed feature-oriented graph modeling components, functions, APIs, database models, tests, consumers, and exact source code locations.
- **Stable URNs**: Node identities decoupled from derived line numbers with lifecycle states (`active`, `aliased`, `retired`) and historical alias tracking.
- **Evidence Model**: First-class structured evidence objects on every edge recording confidence scores, provenance, and rationale.
- **Dual Package Distribution**: Canonical implementation in `@anubhavm/trace` with branded secondary distribution in `@amvelt/trace`.
- **AST Analyzers**: Fault-tolerant Babel parser extracting functions, classes, interfaces, imports, calls, Express/Next.js/Fastify routes, Prisma schemas, and test suites.
- **Feature Detection**: Heuristic clustering across directories, routes, models, and symbols, alongside explicit definitions via `.codebase/features/*.yaml`.
- **Incremental Indexer**: Multi-tier rename detection (Git porcelain + AST token similarity fallback) and surgical graph reconciliation.
- **Drift Detection**: Status reporting distinguishing working tree changes from Git commit mismatch (`INDEX: CURRENT` vs `INDEX: STALE`).
- **Token-Budget Guarantee**: LLM context generation strictly respecting user token ceilings via knapsack packing and output validation.
- **Unified CLI (`trace`)**: Complete command suite (`init`, `update`, `rebuild`, `status`, `features`, `feature`, `explain`, `search`, `where`, `impact`, `context`, `validate`, `doctor`, `history`, `export`) with compatibility aliases `abs-trace` and `codebase-map`.
- **AI Agent Skill**: Generated `.agents/skills/trace/SKILL.md` enforcing the 10-step AI navigation discipline.
- **11 Realistic Fixtures**: Diverse test repositories covering JS, TS, React, Node, Prisma fullstack, vibe-coded spaghetti, monorepos, and ambiguous code.
