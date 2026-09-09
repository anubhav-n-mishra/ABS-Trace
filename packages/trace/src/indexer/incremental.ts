// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { FeatureGraph } from '../core/graph.js';
import type { LanguageAnalyzer, StructuralFacts } from '../analyzer/base.js';
import { JavaScriptTypeScriptAnalyzer } from '../analyzer/js-ts-analyzer.js';
import { parsePrismaSchema } from '../analyzer/database.js';
import { getGitStatus } from '../git/git-status.js';
import { normalizeRepoPath } from '../core/urn.js';

export interface FileChangeDiff {
  added: string[];
  modified: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string; confidenceScore: number; reason: string }>;
}

export class IncrementalReconciler {
  private repoRoot: string;
  private analyzers: LanguageAnalyzer[];

  constructor(repoRoot: string, analyzers?: LanguageAnalyzer[]) {
    this.repoRoot = repoRoot;
    this.analyzers = analyzers || [new JavaScriptTypeScriptAnalyzer()];
  }

  computeFileHash(filePath: string): string {
    const fullPath = path.join(this.repoRoot, filePath);
    if (!fs.existsSync(fullPath)) return '';
    const content = fs.readFileSync(fullPath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  detectRenames(
    deletedFiles: string[],
    addedFiles: string[],
    oldFileHashes: Map<string, string>
  ): {
    renamed: Array<{ from: string; to: string; confidenceScore: number; reason: string }>;
    remainingAdded: string[];
    remainingDeleted: string[];
  } {
    const renamed: Array<{ from: string; to: string; confidenceScore: number; reason: string }> = [];
    const matchedAdded = new Set<string>();
    const matchedDeleted = new Set<string>();

    // 1. Git Status Renames
    const git = getGitStatus(this.repoRoot);
    for (const r of git.renamed) {
      renamed.push({
        from: r.from,
        to: r.to,
        confidenceScore: 0.95,
        reason: 'Git tracked rename'
      });
      matchedDeleted.add(r.from);
      matchedAdded.add(r.to);
    }

    // 2. Exact SHA-256 Content Match
    for (const added of addedFiles) {
      if (matchedAdded.has(added)) continue;
      const addedHash = this.computeFileHash(added);
      if (!addedHash) continue;

      for (const deleted of deletedFiles) {
        if (matchedDeleted.has(deleted)) continue;
        const oldHash = oldFileHashes.get(deleted);
        if (oldHash && oldHash === addedHash) {
          renamed.push({
            from: deleted,
            to: added,
            confidenceScore: 0.9,
            reason: 'Identical SHA-256 content match'
          });
          matchedAdded.add(added);
          matchedDeleted.add(deleted);
          break;
        }
      }
    }

    const remainingAdded = addedFiles.filter((f) => !matchedAdded.has(f));
    const remainingDeleted = deletedFiles.filter((f) => !matchedDeleted.has(f));

    return { renamed, remainingAdded, remainingDeleted };
  }

  async extractFactsForFile(filePath: string): Promise<StructuralFacts | null> {
    const fullPath = path.join(this.repoRoot, filePath);
    if (!fs.existsSync(fullPath)) return null;

    const content = fs.readFileSync(fullPath, 'utf8');

    if (filePath.endsWith('.prisma')) {
      const models = parsePrismaSchema(content, filePath);
      return {
        filePath: normalizeRepoPath(filePath),
        symbols: [],
        routes: [],
        models,
        tests: [],
        imports: [],
        calls: []
      };
    }

    for (const analyzer of this.analyzers) {
      if (analyzer.canAnalyze(filePath)) {
        return analyzer.extractStructuralFacts(content, filePath);
      }
    }

    return null;
  }

  async applyIncrementalUpdate(
    graph: FeatureGraph,
    diff: FileChangeDiff
  ): Promise<{ updatedCount: number; retiredCount: number }> {
    let updatedCount = 0;
    let retiredCount = 0;

    // Handle renames
    for (const r of diff.renamed) {
      const oldNodes = graph.getAllNodes().filter((n) => n.path === r.from);
      for (const oldNode of oldNodes) {
        const newUrn = oldNode.urn.replace(`:${r.from}`, `:${r.to}`);
        graph.addAlias(oldNode.urn, newUrn);
        oldNode.path = r.to;
        oldNode.urn = newUrn;
        oldNode.updatedAt = new Date().toISOString();
        updatedCount++;
      }
    }

    // Handle modifications and additions
    const filesToParse = [...diff.modified, ...diff.added];
    const factsList: StructuralFacts[] = [];

    for (const file of filesToParse) {
      const facts = await this.extractFactsForFile(file);
      if (!facts) continue;
      factsList.push(facts);

      // Update FileNode hash
      const fileUrn = `urn:trace:file:${file}`;
      const newHash = this.computeFileHash(file);
      let fileNode = graph.getNode(fileUrn);
      if (!fileNode) {
        fileNode = {
          urn: fileUrn,
          kind: 'file',
          name: path.basename(file),
          path: file,
          status: 'active',
          aliases: [],
          metadata: { fileHash: newHash },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        graph.addNode(fileNode);
      } else {
        fileNode.metadata = { ...fileNode.metadata, fileHash: newHash };
        fileNode.updatedAt = new Date().toISOString();
        fileNode.status = 'active';
      }

      const newNodes = [...facts.symbols, ...facts.routes, ...facts.models, ...facts.tests];
      const result = graph.reconcileFile(file, newNodes, []);
      updatedCount += result.added.length + result.updated.length;
      retiredCount += result.retired.length;
    }

    // Connect new symbols to features and refresh structural edges
    if (factsList.length > 0) {
      const { FeatureDetector } = await import('../detector/auto-detector.js');
      const detector = new FeatureDetector(this.repoRoot);
      const { edges } = detector.detectFeatures(factsList);
      for (const edge of edges) {
        graph.addEdge(edge);
      }

      const symbolMap = new Map(
        graph
          .getActiveNodes()
          .filter((n) => n.kind === 'symbol')
          .map((n) => [n.name, n])
      );

      let structuralEdgeCount = Date.now();
      for (const facts of factsList) {
        const fileUrn = `urn:trace:file:${facts.filePath}`;
        const existingOutEdges = graph.getOutgoingEdges(fileUrn);
        for (const edge of existingOutEdges) {
          if (edge.relationship === 'imports') {
            graph.removeEdge(edge.id);
          }
        }
        for (const testNode of facts.tests) {
          const existingTestEdges = graph.getOutgoingEdges(testNode.urn);
          for (const edge of existingTestEdges) {
            if (edge.relationship === 'tests') {
              graph.removeEdge(edge.id);
            }
          }
        }

        for (const imp of facts.imports) {
          for (const symName of imp.importedSymbols) {
            const targetSym = symbolMap.get(symName);
            if (targetSym && targetSym.path !== facts.filePath) {
              graph.addEdge({
                id: `edge-struct-imp-${structuralEdgeCount++}`,
                sourceUrn: fileUrn,
                targetUrn: targetSym.urn,
                relationship: 'imports',
                confidence: 'DETECTED',
                confidenceScore: 0.95,
                provenance: { source: 'ast', timestamp: new Date().toISOString() },
                evidence: {
                  type: 'ast_import',
                  file: facts.filePath,
                  line: imp.line,
                  symbol: symName,
                  reason: `AST import of '${symName}' from '${imp.moduleSpecifier}'`
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });

              for (const testNode of facts.tests) {
                graph.addEdge({
                  id: `edge-struct-test-${structuralEdgeCount++}`,
                  sourceUrn: testNode.urn,
                  targetUrn: targetSym.urn,
                  relationship: 'tests',
                  confidence: 'DETECTED',
                  confidenceScore: 0.9,
                  provenance: { source: 'ast', timestamp: new Date().toISOString() },
                  evidence: {
                    type: 'ast_call',
                    file: facts.filePath,
                    line: testNode.startLine,
                    symbol: symName,
                    reason: `Test '${testNode.name}' in file importing '${symName}'`
                  },
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                });
              }
            }
          }
        }
      }
    }

    // Handle deletions
    for (const file of diff.deleted) {
      const fileNodes = graph.getAllNodes().filter((n) => n.path === file);
      for (const node of fileNodes) {
        graph.retireNode(node.urn);
        retiredCount++;
      }
    }

    return { updatedCount, retiredCount };
  }
}
