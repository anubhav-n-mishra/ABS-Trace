# Confidence & Provenance Model

Amvelt TRACE strictly rejects "forced certainty". In real-world software, some connections are indisputable facts, while others are inferred hypotheses.

TRACE explicitly classifies every node and relationship with **Confidence Scores** and **Provenance Tracking**.

---

## Confidence Levels

| Level | Score | Definition | Example Evidence |
| :--- | :--- | :--- | :--- |
| **`EXPLICIT`** | `1.0` | Explicitly declared by developer in `.codebase/features/*.yaml` | Declared in `.codebase/features/payments.yaml` |
| **`DETECTED`** | `0.85` | Direct structural proof from code topology | Route `/api/payment/*`, Prisma `Payment` model, directory `src/components/payment/` |
| **`INFERRED`** | `0.50` | Semantic or vocabulary similarity | Symbol name `verifyPayment` matching `payment` vocabulary |
| **`UNKNOWN`** | `0.10` | Ambiguous connection | Shared generic helper function (`tokenHelper.js`) |

> **Critical Principle:** Confidence scores are ranking metrics, not statistical probabilities.

---

## Provenance Tracking

Every edge records its provenance origin:
- `ast`: Directly extracted by AST parser (imports, call sites, route declarations).
- `git`: Inferred from commit history co-change patterns.
- `explicit`: Declared by humans or configuration files.
- `ai`: Corrected or proposed by AI coding agents.
- `inferred`: Derived from semantic or vocabulary clustering.

---

## The `trace explain` Command

To expose the reasoning behind any relationship:
```bash
trace explain PaymentService
```
Output:
```text
EXPLANATION FOR: PaymentService (symbol)
Path: src/services/payment.ts

Related Features:

  Payments
  Confidence: DETECTED (85%)
  Evidence:
    - Route /api/payment/* calls PaymentService.processUPIPayment()
    - Database model 'Payment' referenced in methods
```
