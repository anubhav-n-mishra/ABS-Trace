# AI Agent Integration & Skill Protocol

Amvelt TRACE is engineered from the ground up as **first-class navigation infrastructure for AI coding agents** (including Claude Code, Cursor, Antigravity, and OpenAI agents).

---

## The AI Navigation Dilemma

When AI coding agents enter an unfamiliar repository, they typically resort to:
1. Grepping through hundreds of files.
2. Guessing filenames.
3. Reading massive irrelevant files, exhausting LLM context budgets.
4. Hallucinating missing relationships.

TRACE solves this by giving agents a high-density, structured navigation layer:
```bash
trace feature <name>
trace context <feature> --tokens 2000
```

---

## The Official Agent Skill

When initialized, TRACE generates `.agents/skills/trace/SKILL.md`.

### The 10-Step AI Lifecycle

```text
1. Understand Task Intent
2. Query TRACE First (trace feature <feature>)
3. Inspect the Feature Surface
4. Understand Why (trace explain <symbol>)
5. Inspect Impact Before Changing (trace impact <symbol>)
6. Read Actual Source Code at Exact Locations
7. Make Code Modifications
8. Run Verification Tests
9. Update TRACE Index (trace update)
10. Validate Index (trace validate)
```

---

## The Cardinal Rule of AI Navigation

> **TRACE is navigation infrastructure, NOT a substitute for reading source code.**
> The agent must ALWAYS inspect the actual source code before modifying anything.
> The compiler, tests, and actual source code are the ultimate authorities.
