<div align="center">

# Amvelt TRACE

### The Living Codebase Map for Humans and AI Agents
*Trace a feature, bug, dependency, or behavior from product concept to the exact code implementing it.*

[![CI](https://github.com/anubhav-n-mishra/ABS-Trace/actions/workflows/ci.yml/badge.svg)](https://github.com/anubhav-n-mishra/ABS-Trace/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## 1. What is TRACE?

**Amvelt TRACE** is a production-grade, local-first developer infrastructure tool that maintains a living, machine-readable and human-readable map of a software repository organized around **features and capabilities**, not merely files.

$$\text{Feature} \rightarrow \text{Implementation} \rightarrow \text{Dependencies} \rightarrow \text{Consumers} \rightarrow \text{APIs} \rightarrow \text{Data} \rightarrow \text{Tests} \rightarrow \text{Exact Locations}$$

---

## 2. What Problem Does It Solve?

AI coding tools and vibe-coded applications allow developers to build software faster than ever. But as codebases grow, understanding them becomes increasingly difficult.

Developers and AI agents waste hours:
- Rediscovering where a capability is implemented.
- Grepping across hundreds of files to find which services participate in a feature.
- Guessing what will break when modifying a shared dependency.
- Wasting LLM context tokens reading entire unrelated files.

TRACE eliminates this by constructing a persistent, semantic feature graph.

---

## 3. Why Does This Matter?

| Scenario | Traditional Grep / File Index | Amvelt TRACE |
| :--- | :--- | :--- |
| **Bug Investigation** | Search `"logout"`, inspect 45 random matches | `trace feature authentication` $\rightarrow$ exact session, token, and API locations in seconds |
| **Refactoring Impact** | Guess what breaks when editing `PaymentService` | `trace impact PaymentService` $\rightarrow$ reveals direct consumers, dependent features, and tests |
| **AI Agent Context** | Feed entire files into context window | `trace context "Payments" --tokens 2000` $\rightarrow$ high-density, token-bounded context |
| **Understanding Why** | Pure guesswork from symbol names | `trace explain <symbol>` $\rightarrow$ reveals evidence chains and confidence ratings |

---

## 4. How Does It Work?

TRACE enforces a strict, directional pipeline that prevents conceptual corruption:

```
SOURCE CODE (Authoritative ground truth)
    │
    ▼
STRUCTURAL GRAPH (What TRACE can prove: AST, imports, routes, models, tests)
    │
    ▼
EVIDENCE (Why connections exist: AST call sites, route prefixes, model refs)
    │
    ▼
FEATURE HYPOTHESES (What TRACE infers or what developers explicitly declare)
    │
    ▼
FEATURE GRAPH (What TRACE believes: features, relationships, confidence)
    │
    ▼
PROJECTIONS (Non-canonical views)
    ├── CLI (trace feature, trace explain, trace impact)
    ├── FEATURE_INDEX.md (@generated human-readable projection)
    ├── JSON (--json output)
    └── AI CONTEXT (Token-bounded LLM context prompt)
```

---

---

## 5. Quick Start

Run TRACE on-demand without global installation:

```bash
# 1. Initialize TRACE in your repository
npx @amvelt/trace init

# 2. Open the interactive visual codebase graph
npx @amvelt/trace graph

# 3. View all mapped features
npx @amvelt/trace features

# 4. Explore a specific feature
npx @amvelt/trace feature payments

# 5. Understand why a relationship exists
npx @amvelt/trace explain PaymentService

# 6. Check blast radius & impact before making changes
npx @amvelt/trace impact PaymentService

# 7. Check architectural coupling hotspots and cycles
npx @amvelt/trace hotspots
npx @amvelt/trace cycles

# 8. Review changes before committing
npx @amvelt/trace diff
npx @amvelt/trace review

# 9. Map tasks and generate implementation plans
npx @amvelt/trace task "Add Google OAuth login"
npx @amvelt/trace plan "refactor payment service"

# 10. Check index health and status
npx @amvelt/trace status
npx @amvelt/trace validate
```

Or install globally:
```bash
npm install -g @amvelt/trace
trace graph
```

---

## 6. Complete CLI Command Reference

| Command | Category | Description |
| :--- | :--- | :--- |
| `trace init` | Core | Initialize `.codebase/` index and map features |
| `trace update` | Core | Incrementally update index with recent modifications & renames |
| `trace rebuild` | Core | Cleanly delete existing index and rebuild from scratch |
| `trace status` | Health | Check if index is current or has drifted from filesystem/git |
| `trace validate` | Health | Verify index health (stale line ranges, broken links, orphan nodes) |
| `trace graph` | Visual | Launch local-first interactive visual codebase graph |
| `trace features` | Navigation | List all mapped features with confidence ratings |
| `trace feature <name>` | Navigation | Display complete implementation surface area for a feature |
| `trace where <concept>` | Navigation | Find where a feature, route, or concept is implemented |
| `trace explain <target>` | Evidence | Explain WHY a relationship exists with evidence chains |
| `trace search <query>` | Search | Semantic and keyword search across features, symbols, and routes |
| `trace impact <target>` | Impact | Compute direct & indirect consumers and affected tests |
| `trace hotspots` | Intelligence | Identify highly coupled architectural nodes with documented formulas |
| `trace cycles` | Intelligence | Detect circular dependencies at symbol and file levels |
| `trace dead` / `orphan` | Intelligence | Detect unreferenced symbols, unconsumed files, and orphan nodes |
| `trace diff [ref]` | Review | Architectural interpretation of Git diff or working tree changes |
| `trace review [ref]` | Review | Review proposed changes against features, APIs, models, and tests |
| `trace task <query>` | AI Planning | Map likely architecture, files, and reference patterns for a task |
| `trace plan <query>` | AI Planning | Generate evidence-backed implementation plan (phases & risks) |
| `trace context <query>` | AI Context | Generate compact, token-budgeted markdown context (hard ceiling) |
| `trace coverage [name]` | Governance | Evaluate feature architectural traceability across 6 dimensions |
| `trace check` | Governance | Validate architecture rules (import boundaries, required tests) |
| `trace watch` | Live | Watch repository filesystem and incrementally re-index on changes |
| `trace usage` | Telemetry | View local token telemetry ledger and session usage (zero phone-home) |
| `trace doctor` | Diagnostic | Diagnostic check of repository setup, parsers, and git integration |
| `trace history <feat>` | History | Show recent Git commits affecting this feature |
| `trace export` | Export | Export full graph projection as JSON or Markdown |

---

## 7. Interactive Visual Codebase Graph (`trace graph`)

TRACE features an embedded, 100% offline interactive visualization server:
- **Zero Cloud / Zero CDN**: Runs on a local Node HTTP server (`127.0.0.1:4321`) with no third-party network requests.
- **Clickable Nodes**: Feature, API Route, Database Model, Core Service, UI Component, Test, and File.
- **Details Drawer**: Reveals exact file locations, line numbers, connected features, structured evidence, blast radius, consumers, and `vscode://` editor links.
- **Dynamic Physics & Modes**: Force simulation with pan, zoom, real-time search, category filters, Focus Mode, and Impact Mode.

Run:
```bash
trace graph
trace graph --feature payments
trace graph --symbol PaymentService
trace graph --impact PaymentService
```

---

## 8. Architectural Intelligence & Review

### Architectural Diff (`trace diff`)
Rather than viewing line-by-line git diffs, TRACE interprets changes architecturally:
```text
TRACE ARCHITECTURAL DIFF

Target Ref:     working-tree
Potential Risk: [MEDIUM] - Moderate blast radius affecting 1 feature(s) and 0 API(s).

Changed Files & Symbols:
  Files modified:   2
  Symbols modified: 4
    - processPayment (src/services/payment.ts:45)

Affected Features:
  - Payments

Tests Impacted:
  - processes valid UPI payments (tests/payment.test.ts)
```

### Hotspots & Cycle Detection
- `trace hotspots`: Identifies architectural bottlenecks using a deterministic formula:
  $$\text{Score} = (2 \times \text{in}) + (1 \times \text{out}) + (3 \times \text{features}) + (2 \times \text{consumers}) + (2 \times \text{apis})$$
- `trace cycles`: Uncovers circular dependencies across symbols and modules to prevent tangled spaghetti architectures.

---

## 9. Example Feature Output

### `trace feature payments`
```text
PAYMENTS [Confidence: DETECTED (85%)]

Implementation
├── UI
│   └── src/components/PaymentForm.jsx:4-26 PaymentForm (component)
│       [Evidence: Symbol 'PaymentForm' matches 'payment' domain vocabulary]
├── API
│   ├── src/routes/payment.js:6 POST /api/payment/upi
│   │   [Evidence: Route path '/api/payment/upi' matches domain 'payment']
│   └── src/routes/payment.js:16 GET /api/payment/status
│       [Evidence: Route path '/api/payment/status' matches domain 'payment']
├── Services
│   ├── src/services/payment.js:2-17 PaymentService (class)
│   │   [Evidence: Symbol 'PaymentService' matches 'payment' domain vocabulary]
│   └── src/services/payment.js:3-12 processUPIPayment (method)
│       [Evidence: Symbol 'processUPIPayment' matches 'payment' domain vocabulary]
└── Tests
    ├── tests/payment.test.js:3 Payments
    │   [Evidence: Test suite/case 'Payments' targets 'Payments' functionality]
    └── tests/payment.test.js:4 processes valid UPI payments
        [Evidence: Test suite/case 'processes valid UPI payments' targets 'Payments' functionality]

Consumers
├── Checkout
└── Subscriptions
```

---

## 7. How Does It Help AI Coding Agents?

TRACE provides a dedicated AI agent skill in `.agents/skills/trace/SKILL.md` that instructs agents to:
1. Query TRACE before reading files (`trace feature <name>`).
2. Narrow context using returned line ranges.
3. Retrieve token-bounded prompts (`trace context <feature> --tokens 2000`).
4. Inspect actual source code before modifying anything.
5. Re-index after code modifications (`trace update`).
6. Validate the index (`trace validate`).

> **Primary Safety Rule:** The TRACE index is navigation infrastructure, NOT a substitute for reading source code. The compiler, tests, and actual source code are the ultimate authorities.

---

## 8. Supported Languages & Ecosystems

- **v1 Production**: JavaScript & TypeScript (`.js`, `.jsx`, `.ts`, `.tsx`, ESM, CommonJS).
  - Routes: Express, Next.js (App & Pages router), Fastify.
  - Database: Prisma schemas, TypeORM, Drizzle, Mongoose.
  - Tests: Jest, Vitest, Mocha (`describe`, `test`, `it`).
- **Extensible Architecture**: Language analyzer interface designed for future language plugins (Python, Go, Rust, Java).

---

## 9. Security & Privacy

- **100% Local-First**: No mandatory cloud account, no required API key, no source code upload.
- **Air-Gapped Capable**: Operates with zero network connectivity by default.
- **Secret Protection**: Automatically ignores `.env*`, `*.pem`, `*.key`, and `.gitignore` patterns.
- **Untrusted Code Execution Prevention**: TRACE never executes repository code; analysis is performed strictly via AST static parsing.

---

## 10. Limitations

- TRACE does not replace IDEs, compilers, or language servers; it complements them.
- Inferred relationships carry confidence ratings (`INFERRED` vs `DETECTED` vs `EXPLICIT`) and must be verified against source code.

---

## 11. Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

```bash
# Run tests
npm test
npm run test:fixtures
npm run typecheck
npm run lint
```

---

## 12. License & Attribution

- **License**: [Apache License 2.0](LICENSE)
- **Copyright**: Copyright 2026 Anubhav Mishra and Amvelt
- **SPDX-License-Identifier**: `Apache-2.0`
