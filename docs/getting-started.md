# Getting Started with Amvelt TRACE

> **TRACE** — The living codebase map for humans and AI agents.  
> *Trace a feature, bug, dependency, or behavior from product concept to the exact code implementing it.*

---

## What is TRACE?

AI coding tools and vibe-coding enable developers to produce large applications in days. However, as applications grow, discovering where features are implemented, which APIs participate, what database models are touched, and what tests exist becomes increasingly painful.

**Amvelt TRACE** solves this by maintaining a persistent, semantic, feature-oriented graph of your repository:
$$\text{Feature} \rightarrow \text{Implementation} \rightarrow \text{Dependencies} \rightarrow \text{Consumers} \rightarrow \text{APIs} \rightarrow \text{Data} \rightarrow \text{Tests} \rightarrow \text{Exact Locations}$$

---

## 5-Minute Quick Start

### 1. Initialize TRACE in Your Repository
Navigate to your repository root and run:
```bash
npx @amvelt/trace init
# or if installed globally:
trace init
```
TRACE will:
- Parse all JavaScript and TypeScript files using fault-tolerant AST parsing.
- Extract functions, classes, interfaces, routes, database models, and tests.
- Automatically infer product features and cluster components.
- Persist the authoritative graph into `.codebase/`.
- Generate `FEATURE_INDEX.md` and `.agents/skills/trace/SKILL.md`.

### 2. View All Detected Features
```bash
trace features
```
Output:
```text
Mapped Features (3):
- Authentication [DETECTED (85%)] (Tags: security, session)
- Payments [DETECTED (85%)] (Tags: billing, checkout, upi)
- Checkout [DETECTED (85%)] (Tags: order, ecommerce)
```

### 3. Inspect a Feature Surface Area
```bash
trace feature payments
```
Shows the complete hierarchical tree across UI, APIs, business logic services, database models, tests, and dependent consumers, including line ranges and evidence.

### 4. Understand Why Connections Exist
```bash
trace explain PaymentService
```
Reveals the confidence score, provenance source, and exact evidence (e.g. AST imports, route prefixes, model references).

### 5. Check Impact Before Refactoring
```bash
trace impact PaymentService
```
Instantly lists all direct consumers, indirect consumers, affected features, and covering tests.

### 6. Verify Index Health
```bash
trace status
trace validate
```
Checks whether the filesystem has drifted from the index and confirms zero broken links or stale references.
