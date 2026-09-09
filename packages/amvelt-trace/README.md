<div align="center">

# Amvelt TRACE

### The Living Codebase Map for Humans and AI Agents
**Trace a feature, bug, dependency, or behavior from product concept to the exact code implementing it.**

[![CI](https://github.com/anubhav-n-mishra/ABS-Trace/actions/workflows/ci.yml/badge.svg)](https://github.com/anubhav-n-mishra/ABS-Trace/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## 1. What is Amvelt TRACE?

**Amvelt TRACE** is a developer infrastructure tool that maintains an active, AST-deterministic map of your software repository. Instead of organizing your project merely as a flat list of files or folders, TRACE structures your codebase around **features, capabilities, and system boundaries**:

$$\text{Feature} \longrightarrow \text{APIs} \longrightarrow \text{Services} \longrightarrow \text{Components} \longrightarrow \text{Database Models} \longrightarrow \text{Tests} \longrightarrow \text{Exact Lines}$$

It provides **humans** with instant architectural clarity, zero-guesswork blast radius analysis, and an offline interactive 2D visual map.

It provides **AI coding agents** (Cursor, Claude Code, Antigravity, GitHub Copilot) with token-bounded, hallucination-free context slices, preventing context window bloat and eliminating accidental boundary violations.

---

## 2. Why Does TRACE Exist? (The Problem)

Modern software teams and AI vibe-coders ship code faster than ever. But as codebases grow, understanding and safely modifying them becomes a nightmare:

* **Grepping is blind:** Searching for `"checkout"` returns 85 matches across comments, mock data, tests, and logs. You still don't know which service actually handles payments.
* **Refactoring is terrifying:** Changing a shared utility or function signature risks silently breaking downstream consumers five layers away.
* **AI agents waste context and hallucinate:** Shoveling 40 whole files into an LLM prompt burns thousands of tokens, exceeds context budgets, and causes models to hallucinate imports or file structures.
* **Architecture decays in secret:** Team conventions ("UI components must not import database models directly") rot because linters don't understand architectural layer boundaries.

TRACE solves this with **deterministic AST truth**: it parses your code, tracks Git commits, detects drift, and keeps documentation and graphs synchronized with reality.

| Scenario | Traditional Workflow | With Amvelt TRACE |
| :--- | :--- | :--- |
| **Investigating a Bug** | Grep keywords, wander through 30 files | `trace feature authentication` $\rightarrow$ exact API routes, services, models, and test line ranges in 50ms |
| **Refactoring Shared Code** | Hope TypeScript catches errors | `trace impact PaymentService` $\rightarrow$ lists every direct consumer, affected feature, and impacted test suite |
| **Feeding Context to AI** | Dump entire directories into prompt | `trace context <feature> --tokens 2000` $\rightarrow$ high-density, line-accurate slice under hard token budget |
| **Architecture Governance** | Manual PR review comments | `trace check` in CI $\rightarrow$ blocks forbidden imports and flags uncovered services automatically |
| **Codebase Onboarding** | Read stale 6-month-old READMEs | `trace graph` $\rightarrow$ explore an interactive 2D constellation map with live inspector drawers |

---

## 3. Quick Start (Set Up in 30 Seconds)

You can run TRACE on-demand with `npx` (no global installation required):

```bash
# 1. Initialize TRACE in your repository root
npx @amvelt/trace init

# 2. Launch the interactive visual codebase map
npx @amvelt/trace graph

# 3. Check if your codebase map is synchronized with Git
npx @amvelt/trace status
```

Or install it globally for instant access:

```bash
npm install -g @amvelt/trace

# Or using the core package:
npm install -g @anubhavm/trace
```

Once installed, the `trace` command is available everywhere.

---

## 4. Where TRACE Helps Like a Real Product

### Use Case 1: Refactoring with Zero Fear (`trace impact`)
Before modifying or deleting a symbol, function, or file, run impact analysis to see its blast radius:

```bash
trace impact HomeLoanEmiCalculator
```

**Output:**
```text
IMPACT ANALYSIS FOR: HomeLoanEmiCalculator (src/components/tools/HomeLoanEmiCalculator.tsx)

Direct Consumers:
  - PresetToolClient.tsx [src/app/tools/[slug]/[preset]/PresetToolClient.tsx]
  - ToolPageClient.tsx [src/components/ToolPageClient.tsx]

Affected Tests:
  - Tool Page Client Integration [tests/tools.test.ts]
```
You immediately know exactly which files consume that component and which test suites must be verified before merging.

---

### Use Case 2: AI Coding Agents with Zero Context Bloat (`trace context`)
AI agents shouldn't read 10,000 lines of code just to implement a small feature. TRACE generates compact, line-accurate Markdown slices under strict token budgets:

```bash
trace context Authentication --tokens 1500
```

**Output:**
```markdown
# Feature Context: Authentication [Confidence: DETECTED (85%)]

## API Endpoints
- POST /api/auth/login [src/routes/auth.ts:14]
- GET  /api/auth/session [src/routes/session.ts:8]

## Core Services & Functions
- AuthService (class) in src/services/auth.ts:10-45
- verifyToken (function) in src/lib/jwt.ts:22-38

## Related Tests
- authenticates valid credentials [tests/auth.test.ts:12]
```

#### Dedicated AI Agent Skill Protocol
When you run `trace init`, TRACE automatically writes `.agents/skills/trace/SKILL.md`. AI tools like **Cursor**, **Claude Code**, and **Antigravity** automatically discover this skill and follow the 10-step protocol:
1. Query `trace feature <name>` before touching files.
2. Read only the targeted line ranges.
3. Make surgical edits.
4. Run `trace update` to reconcile the index.
5. Run `trace validate` to ensure zero broken links.

---

### Use Case 3: Preventing Architectural Decay in CI (`trace check`)
Define deterministic architecture rules in `.codebase/rules.yaml`:

```yaml
rules:
  # Prevent presentation components from directly importing database schemas
  - name: No DB in UI Layer
    from: "src/components/**"
    cannotImport: "prisma/**"

  # Enforce test coverage on all core services
  - name: Core Services Require Tests
    target: "src/services/**"
    requiresTests: true

  # Prevent god-objects with runaway coupling
  - name: Prevent Runaway Coupling
    maxCoupling: 80
```

Run in CI (GitHub Actions, GitLab CI, local pre-commit hook):

```bash
trace check
```

**Output:**
```text
ARCHITECTURE RULES VALIDATION

FAILED: 1 rule violation(s) detected.

1. [ERROR] No DB in UI Layer
   Forbidden architectural dependency: 'src/components/UserCard.tsx' imports 'prisma/schema.prisma'
   File:     src/components/UserCard.tsx:4
   Evidence: AST import of 'prisma' from '../../prisma/client'
```

---

### Use Case 4: Human Visual Codebase Exploration (`trace graph`)
Explore your architecture visually in a fast, 100% local, offline web interface:

```bash
trace graph
```

* **Zero-Overlap Label Engine**: Guaranteed zero colliding text badges at any zoom level.
* **Cohesive Constellation Layout**: Features form central island clusters surrounded by their implementing code and endpoints.
* **Noise-Free Clean Defaults**: Tests, models, and low-level symbols are filtered by default so you see the architectural blueprint first.
* **Instant Search Autocomplete**: Search features, APIs, and symbols with camera fly-to and inspector drawer.
* **Deep Inspector Drawer**: Inspect direct callers, consumers, structured AST evidence, and 1-click `vscode://` links.

---

### Use Case 5: Dead Code & Orphan Node Cleanup (`trace dead`)
Identify dead functions, unreferenced symbols, and unused files across your repository:

```bash
trace dead
```

**Output:**
```text
DEAD & ORPHAN CODE DETECTION

Note: Static analysis cannot verify dynamic dispatch; findings are marked POSSIBLY DEAD.

Unreferenced Symbols (3):
  - [POSSIBLY DEAD] legacyHashPassword in src/utils/crypto.ts
    No incoming calls, imports, or feature links detected in the graph for 'legacyHashPassword'

Unconsumed Files (1):
  - [POSSIBLY DEAD] src/services/deprecatedBilling.ts
    No files in the repository import or call symbols from 'src/services/deprecatedBilling.ts'
```

---

### Use Case 6: Continuous Git Drift Sync (`trace status` & `trace update`)
Unlike static documentation that decays, TRACE tracks your Git working tree and commits:

```bash
# Check if code has drifted from the map
trace status
```

When files are edited, renamed, or deleted:
```text
TRACE STATUS

INDEX: STALE
Working tree:
  Modified: 2 file(s)
    - src/services/checkout.ts
    - src/api/payment.ts

Recommended Action:
  Run 'trace update' to reconcile recent changes with the feature map.
```

Running `trace update` reconciles the AST in milliseconds incrementally without rebuilding the entire graph.

---

## 5. Complete CLI Command Reference

| Command | Category | Description |
| :--- | :--- | :--- |
| `trace init` | **Core** | Initialize `.codebase/` index and map features |
| `trace update` | **Core** | Incrementally reconcile modified, added, or renamed files |
| `trace rebuild` | **Core** | Cleanly wipe and rebuild the entire index from scratch |
| `trace status` | **Health** | Check if index is `CURRENT` or `STALE` relative to working tree and Git HEAD |
| `trace validate` | **Health** | Verify index integrity (no orphan edges, broken URNs, or stale line hashes) |
| `trace doctor` | **Health** | Diagnostic check of Node.js runtime, parsers, and Git integration |
| `trace graph` | **Visual** | Launch local-first interactive visual codebase map on `http://127.0.0.1:4321` |
| `trace features` | **Navigation** | List all mapped product features with confidence scores |
| `trace feature <name>` | **Navigation** | Display complete implementation surface area (UI, API, Services, Tests) |
| `trace where <concept>` | **Navigation** | Find where a capability, route, or concept is implemented |
| `trace explain <target>` | **Evidence** | Explain WHY a relationship exists with structured evidence chains |
| `trace search <query>` | **Search** | Search across features, symbols, and routes with relevance ranking |
| `trace impact <target>` | **Impact** | Compute direct/indirect consumers and affected tests for a symbol or file |
| `trace dead` | **Intelligence**| Detect unreferenced symbols, unconsumed files, and orphan graph nodes |
| `trace hotspots` | **Intelligence**| Identify highly coupled architectural bottleneck nodes with coupling formulas |
| `trace cycles` | **Intelligence**| Detect circular dependency loops across files and symbols |
| `trace diff [ref]` | **Review** | Architectural interpretation of Git diff or working tree changes |
| `trace review [ref]` | **Review** | Review proposed PR changes against features, APIs, models, and tests |
| `trace task <query>` | **AI Planning** | Map likely architecture, files, and reference patterns for a task |
| `trace plan <query>` | **AI Planning** | Generate structured implementation sequence (DB $\rightarrow$ Service $\rightarrow$ API $\rightarrow$ UI $\rightarrow$ Tests) |
| `trace context <query>` | **AI Context** | Generate compact, token-budgeted Markdown prompt context for AI agents |
| `trace check` | **Governance** | Validate architecture rules (`rules.yaml`) against import boundaries |
| `trace coverage [name]` | **Governance** | Evaluate feature architectural traceability across 6 dimensions |
| `trace watch` | **Live** | Watch filesystem in real time and incrementally re-index on file saves |
| `trace usage` | **Telemetry** | View local token usage ledger and session telemetry (100% offline) |
| `trace export` | **Export** | Export full graph projection as JSON or Markdown |

---

## 6. Configuration & Customization

### Explicit Feature Definitions (`.codebase/features/*.yaml`)
While TRACE automatically discovers features from route paths, directory structures, and AST symbols, you can declare explicit ground truth for critical domains:

```yaml
# .codebase/features/checkout.yaml
feature: checkout
displayName: Checkout Flow
description: End-to-end purchasing workflow from cart review to payment confirmation
tags:
  - ecommerce
  - checkout
  - payments

components:
  - CheckoutButton
  - CartSummary

services:
  - CheckoutService
  - TaxCalculator

routes:
  - POST /api/checkout/process

models:
  - Order
  - OrderItem

tests:
  - Checkout Flow
```

Explicit features receive **`EXPLICIT (1.0)`** confidence ratings and take precedence over heuristic inferences.

---

## 7. Architecture & Core Design Principles

1. **Source Code is Canonical Truth:** TRACE never treats documentation or AI summaries as authoritative. Code ASTs, routes, Prisma schemas, and imports are the ground truth.
2. **Deterministic & Zero Hallucination:** Graph edges are backed by structured evidence (`ast_import`, `ast_call`, `route_match`, `directory_cluster`) with verifiable line numbers.
3. **Local-First & Zero Telemetry:** TRACE runs 100% locally on your machine. No code is uploaded to the cloud. No analytics phone home.
4. **Token-Budgeted Context:** Context generation guarantees a hard token ceiling to prevent agent context blowouts.
5. **Acyclic & Clean Import Resolution:** Standard library and runtime built-in methods (`filter`, `map`, `slice`, `path`) are filtered from call graphs to prevent phantom cycles and false hotspots.

---

## 8. Contributing & Community

We welcome contributions from developers, architects, and AI researchers!
* Read our [Contributing Guidelines](CONTRIBUTING.md).
* Review our [Code of Conduct](CODE_OF_CONDUCT.md).
* Report vulnerabilities according to [SECURITY.md](SECURITY.md) to **`anubhav09.work@gmail.com`**.

---

## 9. License

Amvelt TRACE is licensed under the **[Apache-2.0 License](LICENSE)**.

Copyright © 2026 Anubhav Mishra and Amvelt Contributors.
