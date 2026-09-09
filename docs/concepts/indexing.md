# Incremental Indexing & Drift Detection

Codebases change constantly. Full re-indexing on every file save wastes compute and slows down development.

Amvelt TRACE implements a **reconciling incremental indexer** and **real-time drift detection**.

---

## The Incremental Pipeline

1. **Change Set Detection**:
   - Computes SHA-256 hashes of repository files.
   - Evaluates Git porcelain status for staged/unstaged changes and renames.
2. **Multi-Tier Rename Detection**:
   - Tier 1: Git rename detection (confidence 0.95).
   - Tier 2: Exact SHA-256 content match for moved files (confidence 0.90).
   - Tier 3: AST symbol and token similarity (Jaccard $\ge 0.65$) for modified+renamed files (confidence 0.70).
   - Ambiguous matches fall back to `UNKNOWN` (delete + add).
3. **Reconciliation vs. Destruction**:
   - TRACE does **not** blindly purge historical nodes on modification.
   - Obsolete nodes are transitioned to `status: 'retired'`, preserving historical aliases and git linkage.

---

## Drift Detection (`trace status`)

`trace status` continuously compares the filesystem state with `.codebase/`:
- **Filesystem Drift**: Tracks added, modified, deleted, and renamed files.
- **Git Commit Delta**: Detects if the current `HEAD` commit differs from the indexed commit.
- **Status Reporting**:
  - `INDEX: CURRENT`: Everything is in sync.
  - `INDEX: STALE`: Lists modified files and prompts: `Run 'trace update'`.
