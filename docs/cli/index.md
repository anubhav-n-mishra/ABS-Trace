# CLI Command Reference

The canonical CLI binary is `trace`. Compatibility aliases `abs-trace` and `codebase-map` execute identically.

---

## Commands

### `trace init`
Initializes `.codebase/`, runs full repository scan, builds feature graph, generates `FEATURE_INDEX.md` and agent skills.
```bash
trace init
trace init --force
```

### `trace update`
Incrementally re-indexes added, modified, renamed, and deleted files.
```bash
trace update
```

### `trace rebuild`
Cleanly drops existing index cache and rebuilds from scratch.
```bash
trace rebuild
```

### `trace status`
Checks index freshness and reports working tree drift and Git commit mismatch.
```bash
trace status
trace status --json
```

### `trace features`
Lists all mapped features with confidence ratings, tags, and summary statistics.
```bash
trace features
trace features --json
```

### `trace feature <name>`
Renders the complete surface area of a feature (UI, API, Services, Database, Tests, Consumers).
```bash
trace feature payments
trace feature authentication --json
trace feature checkout --no-evidence
```

### `trace explain <target>`
Explains WHY TRACE created a relationship, including confidence score, provenance, and structured evidence.
```bash
trace explain PaymentService
trace explain /api/auth/login
```

### `trace search <query>`
Local-first semantic and keyword search across features, symbols, and routes.
```bash
trace search "upi payment"
trace search "session expiration" --json
```

### `trace where <concept>`
Finds where a product concept, API, or service is implemented.
```bash
trace where authentication
trace where "user logout"
```

### `trace impact <target>`
Analyzes direct consumers, indirect consumers, affected features, and covering tests.
```bash
trace impact PaymentService
trace impact src/services/payment.ts
```

### `trace context <query>`
Generates high-density, token-budgeted prompt context for AI coding agents.
```bash
trace context "Payments" --tokens 2000
trace context "Checkout errors" --tokens 4000 --json
```

### `trace validate`
Verifies index integrity (detects missing files, stale line ranges, orphaned features).
```bash
trace validate
trace validate --json
```

### `trace doctor`
Diagnostic report of repository configuration, node runtime, and Git integration.
```bash
trace doctor
```

### `trace history <feature>`
Lists recent Git commits affecting files in the specified feature.
```bash
trace history payments
```

### `trace export`
Exports the complete graph representation.
```bash
trace export --format markdown
trace export --format json
```
