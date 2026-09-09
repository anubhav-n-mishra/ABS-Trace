# Configuration Reference

Amvelt TRACE works with sensible defaults out of the box. You can customize behavior using `.trace.config.json` in your repository root.

---

## Example `.trace.config.json`

```json
{
  "ignoredDirectories": [
    "node_modules",
    ".git",
    "dist",
    "build",
    "coverage",
    ".codebase",
    ".next",
    ".turbo"
  ],
  "ignoredFiles": [
    "FEATURE_INDEX.md",
    ".env",
    ".env.*",
    "*.pem",
    "*.key",
    "*.log"
  ],
  "maxFileSize": 2097152,
  "defaultTokenBudget": 4000,
  "confidenceScores": {
    "explicit": 1.0,
    "detected": 0.85,
    "inferred": 0.50,
    "unknown": 0.10
  }
}
```

---

## Explicit Feature Definitions (`.codebase/features/`)

You can define explicit feature manifests in `.codebase/features/*.yaml` to establish ground-truth feature boundaries:

```yaml
feature: payments.upi
name: UPI Payments
description: Complete UPI payments flow and verification
tags:
  - billing
  - payment
  - upi

components:
  - PaymentForm

services:
  - PaymentService
  - processUPIPayment

routes:
  - /api/payment/upi

tests:
  - upi.test.ts
```
Features defined explicitly receive `confidence: EXPLICIT` (100% score).
