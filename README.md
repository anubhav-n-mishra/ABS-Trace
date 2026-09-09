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

## 5. Quick Start

Run TRACE on-demand without global installation:

```bash
# 1. Initialize TRACE in your repository
npx @amvelt/trace init

# 2. View all mapped features
npx @amvelt/trace features

# 3. Explore a specific feature
npx @amvelt/trace feature payments

# 4. Understand why a relationship exists
npx @amvelt/trace explain PaymentService

# 5. Check impact before making changes
npx @amvelt/trace impact PaymentService

# 6. Check index health
npx @amvelt/trace status
npx @amvelt/trace validate
```

Or install globally:
```bash
npm install -g @amvelt/trace
trace init
```

---

## 6. Example Output

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

### `trace status`
```text
TRACE STATUS

INDEX: STALE

Working tree:
  Modified: 1 file(s)
    - src/services/payment.js

Git:
  Indexed commit: abc1234
  HEAD commit:    def5678

Recommended Action:
  Run 'trace update' to reconcile recent changes with the feature map.
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
