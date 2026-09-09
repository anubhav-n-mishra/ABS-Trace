// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { FeatureGraph } from '../core/graph.js';
import type { SymbolNode } from '../core/types.js';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  urn?: string;
  file?: string;
  message: string;
  suggestedAction: string;
}

export interface ValidationReport {
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
}

export class IndexValidator {
  private repoRoot: string;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
  }

  validate(graph: FeatureGraph): ValidationReport {
    const issues: ValidationIssue[] = [];
    const activeNodes = graph.getActiveNodes();
    const allEdges = graph.getAllEdges();

    // 1. Validate file existence and symbol line freshness
    const checkedFiles = new Map<string, string[]>(); // path -> lines

    for (const node of activeNodes) {
      if (!node.path) continue; // Skip virtual or feature nodes
      const fullPath = path.join(this.repoRoot, node.path);

      if (!fs.existsSync(fullPath)) {
        issues.push({
          severity: 'error',
          urn: node.urn,
          file: node.path,
          message: `File '${node.path}' referenced by node '${node.name}' does not exist on disk.`,
          suggestedAction: "Run 'trace update' to reconcile deleted or moved files."
        });
        continue;
      }

      // Check line range and hash for symbols
      if (node.kind === 'symbol') {
        const sym = node as SymbolNode;
        if (!checkedFiles.has(node.path)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            checkedFiles.set(node.path, content.split('\n'));
          } catch {
            checkedFiles.set(node.path, []);
          }
        }

        const lines = checkedFiles.get(node.path) || [];
        if (sym.startLine > lines.length || sym.endLine > lines.length) {
          issues.push({
            severity: 'warning',
            urn: sym.urn,
            file: sym.path,
            message: `Symbol '${sym.name}' line range [${sym.startLine}-${sym.endLine}] exceeds current file line count (${lines.length}).`,
            suggestedAction: "Run 'trace update' to refresh line locations."
          });
        } else if (sym.contentHash) {
          const slice = lines.slice(sym.startLine - 1, sym.endLine).join('\n');
          const currentHash = crypto.createHash('sha256').update(slice).digest('hex').slice(0, 16);
          if (currentHash !== sym.contentHash) {
            issues.push({
              severity: 'warning',
              urn: sym.urn,
              file: sym.path,
              message: `Symbol '${sym.name}' content has changed since indexing.`,
              suggestedAction: "Run 'trace update' to refresh symbol hashes."
            });
          }
        }
      }
    }

    // 2. Validate Edge integrity (broken references)
    for (const edge of allEdges) {
      const source = graph.getNode(edge.sourceUrn);
      const target = graph.getNode(edge.targetUrn);

      if (!source) {
        issues.push({
          severity: 'error',
          message: `Edge '${edge.id}' has missing source node: ${edge.sourceUrn}`,
          suggestedAction: "Run 'trace rebuild' to clean up orphaned edges."
        });
      }
      if (!target) {
        issues.push({
          severity: 'error',
          message: `Edge '${edge.id}' has missing target node: ${edge.targetUrn}`,
          suggestedAction: "Run 'trace rebuild' to clean up orphaned edges."
        });
      }
    }

    // 3. Validate Feature Orphans
    const features = graph.getFeatures();
    for (const feat of features) {
      const incoming = graph.getIncomingEdges(feat.urn);
      if (incoming.length === 0) {
        issues.push({
          severity: 'warning',
          urn: feat.urn,
          message: `Feature '${feat.displayName}' has no linked implementation files or symbols.`,
          suggestedAction: "Define feature relationships in .codebase/features/*.yaml or remove obsolete feature."
        });
      }
    }

    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;

    return {
      isValid: errorCount === 0,
      errorCount,
      warningCount,
      issues
    };
  }
}
