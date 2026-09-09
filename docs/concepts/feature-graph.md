# The Semantic Feature Graph

Traditional developer tools index code by files or keywords:
$$\text{File} \rightarrow \text{Symbols} \quad \text{or} \quad \text{Keyword} \rightarrow \text{Matching Lines}$$

While valuable, these indexes fail to answer fundamental architectural questions:
- *Where is UPI Payment implemented across frontend, backend, database, and tests?*
- *What other features break if `PaymentService` is changed?*
- *Why is this component part of Checkout?*

---

## Relational Feature Graph

Amvelt TRACE creates a **semantic feature-oriented graph** where product capabilities are first-class nodes connected to:
- **UI Components**: React JSX/TSX components, views, pages.
- **API Endpoints**: Express, Next.js, and Fastify routes.
- **Business Logic Services**: Functions, classes, and methods.
- **Database Models**: Prisma schema entities and ORM tables.
- **External Services**: Third-party APIs (Stripe, Razorpay, Twilio).
- **Tests**: Test suites and test cases.
- **Consumers**: Dependent features and services.

```
                    FEATURE: Payments
                           │
       ┌──────────────┬────┴─────────┬──────────────┐
       ▼              ▼              ▼              ▼
     [UI]           [API]        [Services]     [Database]
  PaymentForm   POST /api/pay  PaymentService    Payment
       │              │              │              │
       └──────────────┴──────────────┴──────────────┘
                             │
                             ▼
                        [Consumers]
                 Checkout, Subscriptions
```

### Many-to-Many Relationships
A single service or function can participate in multiple features. For example, `PaymentService` is utilized by:
- **Checkout** (one-time purchases)
- **Subscriptions** (recurring charges)
- **Invoicing** (enterprise invoice payments)
- **Refunds** (dispute resolution)

Rather than duplicating files, TRACE represents these as multi-feature edges with explicit confidence ratings and evidence.
