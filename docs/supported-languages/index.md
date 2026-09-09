# Supported Languages & Frameworks

## Production Support (v1)

In v1, Amvelt TRACE provides full AST-based parsing and extraction for the **JavaScript and TypeScript ecosystem**:

- **Languages**: TypeScript (`.ts`, `.tsx`), JavaScript (`.js`, `.jsx`, `.mjs`, `.cjs`).
- **Framework Routes**:
  - Express (`app.get`, `router.post`, `router.use`, etc.)
  - Next.js App Router (`app/**/route.ts` with HTTP methods)
  - Next.js Pages Router (`pages/api/**`)
  - Fastify / Koa
- **Database & ORM Models**:
  - Prisma schemas (`schema.prisma` with models and relations)
  - TypeORM / Drizzle / Mongoose
- **Test Frameworks**:
  - Jest, Vitest, Mocha (`describe`, `test`, `it`)
- **UI Components**:
  - React components (JSX, TSX, hooks, functional & class components)

---

## Language Extension Interface

Adding support for Python, Go, Rust, or Java does not require modifying core graph logic. Simply implement the `LanguageAnalyzer` interface:

```typescript
export interface LanguageAnalyzer {
  readonly id: string;
  readonly name: string;
  readonly supportedExtensions: string[];

  canAnalyze(filePath: string): boolean;
  extractStructuralFacts(fileContent: string, filePath: string): Promise<StructuralFacts>;
}
```

---

## Roadmap

- **v1.1**: Python (FastAPI, Django, SQLAlchemy, pytest)
- **v1.2**: Go (Gin, Fiber, Chi, GORM)
- **v1.3**: Rust (Axum, Actix, Diesel)
- **v1.4**: Java (Spring Boot, Hibernate, JUnit)
