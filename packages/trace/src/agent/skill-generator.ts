// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt

export function generateAgentSkillMarkdown(): string {
  return `---
name: trace
description: Use Amvelt TRACE to navigate and understand codebase features, APIs, dependencies, and exact code locations before modifying code.
---

# Amvelt TRACE Agent Protocol

You have access to **Amvelt TRACE** (\`trace\`), the living codebase map connecting high-level product features to their implementations, APIs, database models, consumers, and tests.

> **PRIMARY SAFETY DIRECTIVE:**
> The TRACE index is navigation and context infrastructure, NOT a substitute for reading actual source code.
> You must ALWAYS verify indexed information against actual source files before making modifications.
> The compiler, tests, and actual source code are the ultimate authorities.

---

## START HERE: one command, one tool call

For almost any task, your **first and often only** discovery command is:

\`\`\`bash
trace brief "<the task in your own words>"
\`\`\`

This returns, in a single call: the matched feature, every entry point and core
function with exact \`file:startLine-endLine\` ranges, which functions call which,
the HTTP routes, the tests, and a **BLAST RADIUS** section listing shared
functions whose change reaches beyond the obvious call site.

Do **not** run \`grep\` for a feature name and start opening files. That costs
roughly 6x the tokens and reliably misses consumers that use different naming
(an \`authenticateOperator\` that never contains the word "login").

Read the \`!shared(n)\` markers carefully. A function marked shared is called from
multiple files; editing it changes behavior for every caller. Putting a guard in
the obviously-named function instead of the shared one is how security fixes ship
with bypasses still open.

---

## 10-Step Agent Lifecycle

When assigned any coding, debugging, refactoring, or feature task:

1. **Understand Task Intent**: Identify what product capability, feature, bug, or behavior the user request mentions.
2. **Get the brief** (one tool call):
   \`\`\`bash
   trace brief "<task>"
   \`\`\`
   To list every function implementing a feature across all files:
   \`\`\`bash
   trace functions <feature-name>
   \`\`\`
   For a specific concept or keyword:
   \`\`\`bash
   trace search "<query>"
   \`\`\`
3. **Inspect the Feature Surface**: Examine the returned entry points, core functions, API endpoints, database models, and test locations.
4. **Understand Why**: If relationships seem ambiguous, inspect the evidence:
   \`\`\`bash
   trace explain <feature-or-symbol>
   \`\`\`
5. **Inspect Impact Before Changing**: Check what depends on the symbols you plan to touch:
   \`\`\`bash
   trace impact <symbol-or-file>
   \`\`\`
   To see how one function actually reaches another:
   \`\`\`bash
   trace chain <fromSymbol> <toSymbol>
   \`\`\`
6. **Read Actual Source Code**: Open and read the exact source files and line ranges identified by TRACE.
7. **Make Code Changes**: Edit, add, or refactor the code according to requirements.
8. **Run Verification Tests**: Execute unit and integration tests to confirm your change works.
9. **Update TRACE Index**: Keep the feature map synchronized with your changes:
   \`\`\`bash
   trace update
   \`\`\`
10. **Validate Index**: Confirm the index has zero broken references or stale line locations:
    \`\`\`bash
    trace validate
    \`\`\`

---

## Core CLI Navigation & Intelligence Commands

### Start here (lowest token cost per answer)
- \`trace brief "<task>"\`: **One-shot task context.** Feature, functions with line ranges, call relationships, routes, tests and blast radius in a single tool call. Use this first.
- \`trace functions <feature>\`: Every function implementing a feature across all files, entry points first, shared choke points flagged.
- \`trace chain <from> <to>\`: Concrete call paths between two symbols — how a request actually reaches the thing you care about.

### For Architecture Understanding
- \`trace features\`: List all mapped features with confidence ratings.
- \`trace feature <name>\`: Show complete implementation surface area for a feature.
- \`trace where <concept>\`: Find where a feature, route, or concept is implemented.
- \`trace explain <symbol>\`: Show why TRACE believes a symbol belongs to a feature, including evidence.
- \`trace search "<query>"\`: Semantic search across features, symbols, and routes.
- \`trace graph\`: Launch interactive visual codebase map.

### For Task Planning & Impact Analysis
- \`trace task "<task>"\`: Map likely architecture, files, and reference patterns for a task.
- \`trace plan "<task>"\`: Generate an evidence-backed implementation plan distinguishing deterministic facts from suggestions.
- \`trace impact <target>\`: Identify direct and indirect consumers and affected tests.
- \`trace hotspots\`: Identify highly coupled architectural nodes.
- \`trace cycles\`: Detect dependency cycles across files and symbols.

### For Code Review & Diff Intelligence
- \`trace diff [ref]\`: Architectural interpretation of Git diff or working tree changes.
- \`trace review [ref]\`: Review proposed changes against features, APIs, models, and tests.
- \`trace dead\`: Detect unreferenced symbols, unconsumed files, and orphan graph nodes.

### For AI Context & Telemetry
- \`trace context "<task>" --tokens 2000\`: Retrieve compact, token-budgeted prompt context with hard ceiling guarantee.
- \`trace usage\`: View local token usage ledger and session telemetry.

### For Governance & Maintenance
- \`trace check\`: Validate architecture rules (import boundaries, required tests).
- \`trace coverage [feature]\`: Evaluate feature architectural traceability across 6 dimensions.
- \`trace status\`: Check if index has drifted from the working tree.
- \`trace update\`: Incrementally re-index changed, added, or renamed files.
- \`trace validate\`: Ensure index health with zero stale or broken references.
- \`trace watch\`: Real-time filesystem watcher for continuous synchronization.
`;
}
