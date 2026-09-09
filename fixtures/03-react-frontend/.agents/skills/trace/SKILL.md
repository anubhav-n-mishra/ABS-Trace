---
name: trace
description: Use Amvelt TRACE to navigate and understand codebase features, APIs, dependencies, and exact code locations before modifying code.
---

# Amvelt TRACE Agent Protocol

You have access to **Amvelt TRACE** (`trace`), the living codebase map connecting high-level product features to their implementations, APIs, database models, consumers, and tests.

> **PRIMARY SAFETY DIRECTIVE:**
> The TRACE index is navigation and context infrastructure, NOT a substitute for reading actual source code.
> You must ALWAYS verify indexed information against actual source files before making modifications.
> The compiler, tests, and actual source code are the ultimate authorities.

---

## 10-Step Agent Lifecycle

When assigned any coding, debugging, refactoring, or feature task:

1. **Understand Task Intent**: Identify what product capability, feature, bug, or behavior the user request mentions.
2. **Query TRACE First**: Before exploring or reading random files, query TRACE:
   ```bash
   trace feature <feature-name>
   ```
   If searching for a concept or keyword:
   ```bash
   trace search "<query>"
   ```
3. **Inspect the Feature Surface**: Examine the returned UI components, API endpoints, core services, database models, and test locations.
4. **Understand Why**: If relationships seem ambiguous, inspect the evidence:
   ```bash
   trace explain <feature-or-symbol>
   ```
5. **Inspect Impact Before Changing**: Check what depends on the symbols you plan to touch:
   ```bash
   trace impact <symbol-or-file>
   ```
6. **Read Actual Source Code**: Open and read the exact source files and line ranges identified by TRACE.
7. **Make Code Changes**: Edit, add, or refactor the code according to requirements.
8. **Run Verification Tests**: Execute unit and integration tests to confirm your change works.
9. **Update TRACE Index**: Keep the feature map synchronized with your changes:
   ```bash
   trace update
   ```
10. **Validate Index**: Confirm the index has zero broken references or stale line locations:
    ```bash
    trace validate
    ```

---

## Core CLI Navigation Commands

- `trace features`: List all detected and explicit features in the repository.
- `trace feature <name>`: Show the complete implementation surface for a feature.
- `trace explain <symbol>`: Show why TRACE believes a symbol belongs to a feature, including evidence.
- `trace impact <symbol-or-file>`: Identify direct and indirect consumers and affected tests.
- `trace context "<feature>" --tokens 2000`: Retrieve high-density, token-budgeted prompt context.
- `trace status`: Check if the working tree has drifted from the index.
- `trace update`: Incrementally re-index changed, added, or renamed files.
- `trace validate`: Ensure the index is completely healthy with no stale or orphaned links.
