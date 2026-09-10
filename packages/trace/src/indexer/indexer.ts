// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import fg from 'fast-glob';
import { FeatureGraph } from '../core/graph.js';
import { CodebaseStore } from '../core/store.js';
import { loadConfig } from '../core/config.js';
import { SecretFilter } from '../analyzer/secrets.js';
import { JavaScriptTypeScriptAnalyzer } from '../analyzer/js-ts-analyzer.js';
import { PythonAnalyzer } from '../analyzer/python-analyzer.js';
import { GoAnalyzer } from '../analyzer/go-analyzer.js';
import { RustAnalyzer } from '../analyzer/rust-analyzer.js';
import { JavaAnalyzer } from '../analyzer/java-analyzer.js';
import { parsePrismaSchema } from '../analyzer/database.js';
import { FeatureDetector } from '../detector/auto-detector.js';
import { IncrementalReconciler, type FileChangeDiff } from './incremental.js';
import { calculateDrift } from './drift.js';
import { getGitStatus } from '../git/git-status.js';
import { normalizeRepoPath } from '../core/urn.js';
import type { StructuralFacts } from '../analyzer/base.js';
import type { IndexMetadata, DriftReport, SymbolNode } from '../core/types.js';
import { generateFeatureIndexMarkdown } from '../renderers/markdown.js';
import { generateAgentSkillMarkdown } from '../agent/skill-generator.js';
import { isStandardBuiltin, resolveImportTargetFile, resolveImportTargetFiles } from './builtins.js';

export class CodebaseIndexer {
  private repoRoot: string;
  private store: CodebaseStore;
  private analyzers = [
    new JavaScriptTypeScriptAnalyzer(),
    new PythonAnalyzer(),
    new GoAnalyzer(),
    new RustAnalyzer(),
    new JavaAnalyzer()
  ];

  constructor(repoRoot: string) {
    this.repoRoot = path.resolve(repoRoot);
    this.store = new CodebaseStore(this.repoRoot);
  }

  getStore(): CodebaseStore {
    return this.store;
  }

  async runFullIndex(): Promise<{ graph: FeatureGraph; metadata: IndexMetadata }> {
    const config = loadConfig(this.repoRoot);
    const secretFilter = new SecretFilter(this.repoRoot, config);
    const graph = new FeatureGraph();

    // 1. Discover all repository files
    const allFiles = fg.sync('**/*', {
      cwd: this.repoRoot,
      onlyFiles: true,
      dot: true,
      ignore: config.ignoredDirectories.map((d) => `**/${d}/**`)
    })
      .map(normalizeRepoPath)
      .filter((f) => !secretFilter.isIgnored(f));

    // 2. Extract facts from each file
    const factsList: StructuralFacts[] = [];

    for (const file of allFiles) {
      const fullPath = path.join(this.repoRoot, file);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');

        if (file.endsWith('.prisma')) {
          const models = parsePrismaSchema(content, file);
          factsList.push({
            filePath: file,
            symbols: [],
            routes: [],
            models,
            tests: [],
            imports: [],
            calls: []
          });
        } else {
          const analyzer = this.analyzers.find((a) => a.canAnalyze(file));
          if (analyzer) {
            factsList.push(await analyzer.extractStructuralFacts(content, file));
          }
        }
      } catch (err: any) {
        console.warn(`[WARN] Failed to analyze file ${file}:`, err.message);
      }
    }

    // 3. Add FileNodes for all discovered repository files
    for (const file of allFiles) {
      const fileUrn = `urn:trace:file:${file}`;
      const fullPath = path.join(this.repoRoot, file);
      let fileHash = '';
      try {
        fileHash = crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex');
      } catch {
        // Ignored
      }

      graph.addNode({
        urn: fileUrn,
        kind: 'file',
        name: path.basename(file),
        path: file,
        status: 'active',
        aliases: [],
        metadata: { fileHash },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // 4. Add all extracted structural nodes to graph
    for (const facts of factsList) {
      for (const sym of facts.symbols) graph.addNode(sym);
      for (const route of facts.routes) graph.addNode(route);
      for (const model of facts.models) graph.addNode(model);
      for (const test of facts.tests) graph.addNode(test);
    }

    // 4. Run Feature Detector to discover features and create edges
    const detector = new FeatureDetector(this.repoRoot);
    const { features, edges } = detector.detectFeatures(factsList);

    for (const feat of features) {
      graph.addNode(feat);
    }
    for (const edge of edges) {
      graph.addEdge(edge);
    }

    // 5. Connect imports and calls between symbols and tests
    const activeSymbols = graph
      .getActiveNodes()
      .filter((n): n is SymbolNode => n.kind === 'symbol');

    const symbolsByFile = new Map<string, Map<string, SymbolNode>>();
    const allSymbolsByName = new Map<string, SymbolNode[]>();

    for (const sym of activeSymbols) {
      if (!symbolsByFile.has(sym.path)) {
        symbolsByFile.set(sym.path, new Map());
      }
      symbolsByFile.get(sym.path)!.set(sym.name, sym);

      if (!allSymbolsByName.has(sym.name)) {
        allSymbolsByName.set(sym.name, []);
      }
      allSymbolsByName.get(sym.name)!.push(sym);
    }

    const knownFiles = new Set(allFiles);
    let structuralEdgeCount = 1;

    for (const facts of factsList) {
      for (const imp of facts.imports) {
        const targetFile = resolveImportTargetFile(facts.filePath, imp.moduleSpecifier, knownFiles);

        for (const symName of imp.importedSymbols) {
          let targetSym: SymbolNode | undefined;

          if (targetFile && symbolsByFile.has(targetFile)) {
            targetSym = symbolsByFile.get(targetFile)!.get(symName);
          }

          if (!targetSym) {
            const isNodeBuiltin = imp.moduleSpecifier.startsWith('node:') || isStandardBuiltin(imp.moduleSpecifier);
            if (!isNodeBuiltin) {
              const candidates = allSymbolsByName.get(symName);
              if (candidates && candidates.length > 0) {
                const matchingCand = candidates.find((c) => {
                  const base = path.posix.basename(c.path, path.posix.extname(c.path));
                  return imp.moduleSpecifier.includes(base) || c.path.includes(imp.moduleSpecifier);
                });
                if (matchingCand) {
                  targetSym = matchingCand;
                } else if (imp.moduleSpecifier.startsWith('.') || imp.moduleSpecifier.startsWith('@/')) {
                  targetSym = candidates.length === 1 ? candidates[0] : candidates.find((c) => c.path !== facts.filePath);
                }
              }
            }
          }

          if (targetSym && targetSym.path !== facts.filePath) {
            // Edge from importing file to imported symbol
            graph.addEdge({
              id: `edge-struct-imp-${structuralEdgeCount++}`,
              sourceUrn: `urn:trace:file:${facts.filePath}`,
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

            // If this file has tests, link the tests to the imported target symbol
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

      for (const call of facts.calls) {
        const cleanName = call.calleeName.includes('.')
          ? call.calleeName.split('.').pop()!
          : call.calleeName;

        // Skip standard built-in methods (filter, map, slice, etc.) to prevent false cross-module edges
        if (isStandardBuiltin(cleanName)) continue;

        const candidates = allSymbolsByName.get(cleanName);
        if (!candidates || candidates.length === 0) continue;

        // Prefer candidate from a file directly imported by this file
        const importedFilePaths = new Set(
          facts.imports.flatMap((i) =>
            resolveImportTargetFiles(facts.filePath, i.moduleSpecifier, knownFiles)
          )
        );

        // A local definition shadows an import, so resolve same-file first.
        const targetSym =
          candidates.find((c) => c.path === facts.filePath) ||
          candidates.find((c) => importedFilePaths.has(c.path)) ||
          (candidates.length === 1 ? candidates[0] : undefined);

        if (targetSym) {
          // Attribute the call to the calling function when it is a symbol we
          // actually indexed; otherwise fall back to the containing file.
          const callerUrn =
            call.callerUrn && call.callerUrn !== targetSym.urn && graph.hasNode(call.callerUrn)
              ? call.callerUrn
              : `urn:trace:file:${facts.filePath}`;

          graph.addEdge({
            id: `edge-struct-call-${structuralEdgeCount++}`,
            sourceUrn: callerUrn,
            targetUrn: targetSym.urn,
            relationship: 'calls',
            confidence: 'DETECTED',
            confidenceScore: 0.9,
            provenance: { source: 'ast', timestamp: new Date().toISOString() },
            evidence: {
              type: 'ast_call',
              file: facts.filePath,
              line: call.line,
              symbol: cleanName,
              reason: `AST invocation of '${call.calleeName}'`
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    // 6. Save persistent store
    const git = getGitStatus(this.repoRoot);
    const metadata = this.store.saveGraph(graph, git.currentCommit);

    // 7. Write projections: FEATURE_INDEX.md and .agents/skills/trace/SKILL.md
    const featureIndexPath = path.join(this.repoRoot, 'FEATURE_INDEX.md');
    const featureIndexMarkdown = generateFeatureIndexMarkdown(graph);
    fs.writeFileSync(featureIndexPath, featureIndexMarkdown, 'utf8');

    const agentSkillDir = path.join(this.repoRoot, '.agents', 'skills', 'trace');
    if (!fs.existsSync(agentSkillDir)) {
      fs.mkdirSync(agentSkillDir, { recursive: true });
    }
    const skillPath = path.join(agentSkillDir, 'SKILL.md');
    fs.writeFileSync(skillPath, generateAgentSkillMarkdown(), 'utf8');

    return { graph, metadata };
  }

  async runIncrementalUpdate(): Promise<{
    graph: FeatureGraph;
    metadata: IndexMetadata;
    updatedCount: number;
    retiredCount: number;
  }> {
    if (!this.store.isInitialized()) {
      const res = await this.runFullIndex();
      return {
        graph: res.graph,
        metadata: res.metadata,
        updatedCount: res.metadata.stats.nodeCount,
        retiredCount: 0
      };
    }

    const graph = new FeatureGraph();
    const oldMeta = this.store.loadGraph(graph);

    const drift = calculateDrift(this.repoRoot, oldMeta);

    const reconciler = new IncrementalReconciler(this.repoRoot);
    const diff: FileChangeDiff = {
      added: drift.workingTree.added,
      modified: drift.workingTree.modified,
      deleted: drift.workingTree.deleted,
      renamed: drift.workingTree.renamed.map((r) => ({
        ...r,
        confidenceScore: 0.95,
        reason: 'Git detected rename'
      }))
    };

    const { updatedCount, retiredCount } = await reconciler.applyIncrementalUpdate(graph, diff);

    // Re-save store
    const git = getGitStatus(this.repoRoot);
    const newMeta = this.store.saveGraph(graph, git.currentCommit);

    // Regenerate projections
    const featureIndexPath = path.join(this.repoRoot, 'FEATURE_INDEX.md');
    fs.writeFileSync(featureIndexPath, generateFeatureIndexMarkdown(graph), 'utf8');

    return {
      graph,
      metadata: newMeta,
      updatedCount,
      retiredCount
    };
  }

  checkStatus(): DriftReport {
    if (!this.store.isInitialized()) {
      return {
        driftScore: 1.0,
        isStale: true,
        workingTree: { modified: [], added: [], deleted: [], renamed: [] },
        git: { indexedCommit: 'none', headCommit: 'none', mismatch: true },
        recommendations: ["Repository not indexed yet. Run 'trace init'."]
      };
    }

    const meta = this.store.loadMetadata();
    return calculateDrift(this.repoRoot, meta);
  }
}
