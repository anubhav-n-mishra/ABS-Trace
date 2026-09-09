// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import fg from 'fast-glob';
import type { DriftReport, IndexMetadata } from '../core/types.js';
import { SecretFilter } from '../analyzer/secrets.js';
import { loadConfig } from '../core/config.js';
import { getGitStatus } from '../git/git-status.js';
import { normalizeRepoPath } from '../core/urn.js';

export function calculateDrift(repoRoot: string, metadata: IndexMetadata): DriftReport {
  const config = loadConfig(repoRoot);
  const secretFilter = new SecretFilter(repoRoot, config);
  const gitStatus = getGitStatus(repoRoot);

  const graphPath = path.join(repoRoot, '.codebase', 'graph.json');
  const indexedFileMap = new Map<string, string>(); // path -> stored fileHash

  if (fs.existsSync(graphPath)) {
    try {
      const raw = fs.readFileSync(graphPath, 'utf8');
      const parsed = JSON.parse(raw);
      for (const node of parsed.nodes || []) {
        if (node.path && node.kind === 'file') {
          indexedFileMap.set(node.path, (node.metadata?.fileHash as string) || '');
        }
      }
    } catch {
      // Ignored
    }
  }

  // Get current repo files
  const currentFiles = fg.sync('**/*', {
    cwd: repoRoot,
    onlyFiles: true,
    dot: true,
    ignore: config.ignoredDirectories.map((d) => `**/${d}/**`)
  }).map(normalizeRepoPath).filter((f) => !secretFilter.isIgnored(f));

  const modified: string[] = [];
  const added: string[] = [];
  const deleted: string[] = [];

  // Check added or modified
  for (const file of currentFiles) {
    if (!indexedFileMap.has(file)) {
      added.push(file);
    } else {
      const storedHash = indexedFileMap.get(file);
      const fullPath = path.join(repoRoot, file);
      let currentHash = '';
      try {
        currentHash = crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex');
      } catch {
        // Ignored
      }

      if (storedHash && currentHash && storedHash !== currentHash) {
        modified.push(file);
      }
    }
  }

  // Check deleted
  for (const indexedFile of indexedFileMap.keys()) {
    if (!currentFiles.includes(indexedFile)) {
      deleted.push(indexedFile);
    }
  }

  const totalTracked = Math.max(1, currentFiles.length);
  const changedCount = modified.length + added.length + deleted.length;
  const driftScore = Math.min(1.0, changedCount / totalTracked);

  const commitMismatch =
    gitStatus.isGitRepo &&
    metadata.gitCommit !== 'uncommitted' &&
    gitStatus.currentCommit !== 'uncommitted' &&
    metadata.gitCommit !== gitStatus.currentCommit;

  const isStale = changedCount > 0;

  const recommendations: string[] = [];
  if (isStale) {
    recommendations.push("Run 'trace update' to reconcile recent changes with the feature map.");
  }
  if (driftScore > 0.4) {
    recommendations.push("Substantial drift detected (>40%). Consider 'trace rebuild' for a clean index.");
  }

  return {
    driftScore,
    isStale,
    workingTree: {
      modified,
      added,
      deleted,
      renamed: gitStatus.renamed
    },
    git: {
      indexedCommit: metadata.gitCommit,
      headCommit: gitStatus.currentCommit,
      mismatch: commitMismatch
    },
    recommendations
  };
}
