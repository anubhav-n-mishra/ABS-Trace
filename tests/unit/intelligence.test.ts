// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { FeatureGraph } from '../../packages/trace/src/core/graph.js';
import { detectCycles } from '../../packages/trace/src/intelligence/cycles.js';
import { analyzeHotspots } from '../../packages/trace/src/intelligence/hotspots.js';
import { detectDeadCode } from '../../packages/trace/src/intelligence/dead-code.js';
import { mapTaskArchitecture, generateTaskPlan } from '../../packages/trace/src/intelligence/task-planner.js';
import { evaluateFeatureCoverage } from '../../packages/trace/src/intelligence/coverage.js';
import { checkArchitectureRules } from '../../packages/trace/src/intelligence/rules.js';
import { LocalUsageLedger } from '../../packages/trace/src/intelligence/telemetry.js';
import { startGraphServer } from '../../packages/trace/src/graph-ui/server.js';
import type { SymbolNode, FeatureNode, GraphEdge } from '../../packages/trace/src/core/types.js';

describe('Intelligence Engine: Cycle Detection', () => {
  it('detects direct and multi-hop cycles across symbols and files', () => {
    const graph = new FeatureGraph();

    const nodeA: SymbolNode = {
      urn: 'urn:trace:symbol:src/a.ts#funcA',
      kind: 'symbol',
      symbolKind: 'function',
      name: 'funcA',
      path: 'src/a.ts',
      status: 'active',
      aliases: [],
      startLine: 1,
      endLine: 5,
      contentHash: 'hashA',
      isExported: true,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const nodeB: SymbolNode = {
      urn: 'urn:trace:symbol:src/b.ts#funcB',
      kind: 'symbol',
      symbolKind: 'function',
      name: 'funcB',
      path: 'src/b.ts',
      status: 'active',
      aliases: [],
      startLine: 1,
      endLine: 5,
      contentHash: 'hashB',
      isExported: true,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    graph.addNode(nodeA);
    graph.addNode(nodeB);

    // Initial state: acyclic
    graph.addEdge({
      id: 'e1',
      sourceUrn: nodeA.urn,
      targetUrn: nodeB.urn,
      relationship: 'calls',
      confidence: 'EXPLICIT',
      confidenceScore: 1.0,
      provenance: { source: 'ast', timestamp: new Date().toISOString() },
      evidence: { type: 'ast_call', reason: 'A calls B' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    let report = detectCycles(graph);
    expect(report.hasCycles).toBe(false);
    expect(report.cycleCount).toBe(0);

    // Introduce cycle: B calls A
    graph.addEdge({
      id: 'e2',
      sourceUrn: nodeB.urn,
      targetUrn: nodeA.urn,
      relationship: 'calls',
      confidence: 'EXPLICIT',
      confidenceScore: 1.0,
      provenance: { source: 'ast', timestamp: new Date().toISOString() },
      evidence: { type: 'ast_call', reason: 'B calls A' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    report = detectCycles(graph);
    expect(report.hasCycles).toBe(true);
    expect(report.cycleCount).toBeGreaterThanOrEqual(1);
    expect(report.cycles.some((c) => c.chain.includes('funcA') && c.chain.includes('funcB'))).toBe(true);
  });
});

describe('Intelligence Engine: Coupling Hotspots', () => {
  it('computes coupling score accurately using documented formula', () => {
    const graph = new FeatureGraph();

    const targetNode: SymbolNode = {
      urn: 'urn:trace:symbol:src/service.ts#HotService',
      kind: 'symbol',
      symbolKind: 'class',
      name: 'HotService',
      path: 'src/service.ts',
      status: 'active',
      aliases: [],
      startLine: 1,
      endLine: 50,
      contentHash: 'hashS',
      isExported: true,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    graph.addNode(targetNode);

    // Add 10 callers
    for (let i = 0; i < 10; i++) {
      const caller: SymbolNode = {
        urn: `urn:trace:symbol:src/caller${i}.ts#caller${i}`,
        kind: 'symbol',
        symbolKind: 'function',
        name: `caller${i}`,
        path: `src/caller${i}.ts`,
        status: 'active',
        aliases: [],
        startLine: 1,
        endLine: 5,
        contentHash: `hash${i}`,
        isExported: true,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      graph.addNode(caller);
      graph.addEdge({
        id: `edge_${i}`,
        sourceUrn: caller.urn,
        targetUrn: targetNode.urn,
        relationship: 'calls',
        confidence: 'EXPLICIT',
        confidenceScore: 1.0,
        provenance: { source: 'ast', timestamp: new Date().toISOString() },
        evidence: { type: 'ast_call', reason: 'Calls HotService' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    const report = analyzeHotspots(graph, 5);
    expect(report.totalAnalyzed).toBeGreaterThanOrEqual(1);

    const hot = report.hotspots.find((h) => h.node.name === 'HotService');
    expect(hot).toBeDefined();
    // 2 * 10 incoming + 2 * 10 consumers = 40 >= 20 -> HIGH
    expect(hot?.couplingScore).toBeGreaterThanOrEqual(20);
    expect(hot?.couplingRating).toBe('HIGH');
  });
});

describe('Intelligence Engine: Dead Code & Orphan Detection', () => {
  it('marks unreferenced symbols as POSSIBLY DEAD with explicit caveats', () => {
    const graph = new FeatureGraph();

    const deadSymbol: SymbolNode = {
      urn: 'urn:trace:symbol:src/unused.ts#abandonedMethod',
      kind: 'symbol',
      symbolKind: 'function',
      name: 'abandonedMethod',
      path: 'src/unused.ts',
      status: 'active',
      aliases: [],
      startLine: 1,
      endLine: 10,
      contentHash: 'hashDead',
      isExported: true,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    graph.addNode(deadSymbol);

    const report = detectDeadCode(graph);
    expect(report.totalFindings).toBeGreaterThanOrEqual(1);

    const finding = report.possiblyDeadSymbols.find((s) => s.name === 'abandonedMethod');
    expect(finding).toBeDefined();
    expect(finding?.status).toBe('POSSIBLY DEAD');
    expect(finding?.caveat).toContain('dynamic');
  });

  it('reports zero retired node references after incremental update retires a node', () => {
    const graph = new FeatureGraph();

    const activeSym: SymbolNode = {
      urn: 'urn:trace:symbol:src/active.ts#activeFn',
      kind: 'symbol',
      symbolKind: 'function',
      name: 'activeFn',
      path: 'src/active.ts',
      status: 'active',
      aliases: [],
      startLine: 1,
      endLine: 5,
      contentHash: 'hashActive',
      isExported: true,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const obsoleteSym: SymbolNode = {
      urn: 'urn:trace:symbol:src/active.ts#obsoleteFn',
      kind: 'symbol',
      symbolKind: 'function',
      name: 'obsoleteFn',
      path: 'src/active.ts',
      status: 'active',
      aliases: [],
      startLine: 6,
      endLine: 12,
      contentHash: 'hashObsolete',
      isExported: true,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const edge: GraphEdge = {
      id: 'edge-active-to-obsolete',
      sourceUrn: activeSym.urn,
      targetUrn: obsoleteSym.urn,
      relationship: 'calls',
      confidence: 'DETECTED',
      confidenceScore: 0.9,
      provenance: { source: 'ast', timestamp: new Date().toISOString() },
      evidence: { type: 'ast_call', file: 'src/active.ts', line: 3, reason: 'Calls obsolete' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    graph.addNode(activeSym);
    graph.addNode(obsoleteSym);
    graph.addEdge(edge);

    // Simulate reconcileFile when obsoleteFn is removed
    graph.reconcileFile('src/active.ts', [activeSym], []);

    expect(graph.getNode(obsoleteSym.urn)?.status).toBe('retired');

    // Dead code detection should find zero retired nodes referenced
    const report = detectDeadCode(graph);
    expect(report.retiredNodesReferenced.length).toBe(0);
  });
});

describe('Intelligence Engine: Task Mapping & Plan Generator', () => {
  it('maps task to matching features and produces categorized phases', () => {
    const graph = new FeatureGraph();

    const feat: FeatureNode = {
      urn: 'urn:trace:feature:billing',
      kind: 'feature',
      name: 'billing',
      displayName: 'Billing',
      path: '',
      status: 'active',
      aliases: [],
      confidence: 'EXPLICIT',
      confidenceScore: 1.0,
      source: 'explicit',
      tags: ['invoice', 'payment'],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    graph.addNode(feat);

    const map = mapTaskArchitecture(graph, 'update billing recurring invoices');
    expect(map.primaryFeature?.displayName).toBe('Billing');

    const plan = generateTaskPlan(graph, 'update billing recurring invoices');
    expect(plan.suggestedOrder.length).toBeGreaterThanOrEqual(1);
    expect(plan.suggestedOrder.some((p) => p.category === 'SUGGESTED')).toBe(true);
  });
});

describe('Intelligence Engine: Feature Coverage', () => {
  it('evaluates traceability across implementation, API, and tests', () => {
    const graph = new FeatureGraph();

    const feat: FeatureNode = {
      urn: 'urn:trace:feature:auth',
      kind: 'feature',
      name: 'auth',
      displayName: 'Authentication',
      path: '',
      status: 'active',
      aliases: [],
      confidence: 'DETECTED',
      confidenceScore: 0.85,
      source: 'ast',
      tags: [],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    graph.addNode(feat);

    const reports = evaluateFeatureCoverage(process.cwd(), graph, 'Authentication');
    expect(reports.length).toBe(1);
    expect(reports[0]?.dimensions.length).toBe(6);
    expect(reports[0]?.caveat).toContain('does not guarantee absence');
  });
});

describe('Intelligence Engine: Architecture Rules', () => {
  it('reports forbidden import boundaries deterministically', () => {
    const graph = new FeatureGraph();

    const uiNode: SymbolNode = {
      urn: 'urn:trace:symbol:src/components/Button.tsx#Button',
      kind: 'symbol',
      symbolKind: 'component',
      name: 'Button',
      path: 'src/components/Button.tsx',
      status: 'active',
      aliases: [],
      startLine: 1,
      endLine: 10,
      contentHash: 'hashUI',
      isExported: true,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const dbNode: SymbolNode = {
      urn: 'urn:trace:symbol:prisma/client.ts#db',
      kind: 'symbol',
      symbolKind: 'variable',
      name: 'db',
      path: 'prisma/client.ts',
      status: 'active',
      aliases: [],
      startLine: 1,
      endLine: 5,
      contentHash: 'hashDB',
      isExported: true,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    graph.addNode(uiNode);
    graph.addNode(dbNode);

    // Violation edge: UI imports DB
    graph.addEdge({
      id: 'viol_1',
      sourceUrn: uiNode.urn,
      targetUrn: dbNode.urn,
      relationship: 'imports',
      confidence: 'EXPLICIT',
      confidenceScore: 1.0,
      provenance: { source: 'ast', timestamp: new Date().toISOString() },
      evidence: { type: 'ast_import', line: 2, reason: 'Import of prisma/client' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const report = checkArchitectureRules(process.cwd(), graph);
    expect(report.isCompliant).toBe(false);
    expect(report.violations.length).toBeGreaterThanOrEqual(1);
    expect(report.violations[0]?.ruleName).toBe('ui-cannot-import-database');
  });
});

describe('Intelligence Engine: Local Token Telemetry', () => {
  const tempDir = path.resolve('scratch/test-telemetry');

  beforeEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('records session usage locally and aggregates by command and date', () => {
    const ledger = new LocalUsageLedger(tempDir);

    ledger.record({
      sessionId: 'session-1',
      command: 'context',
      tokensRequested: 4000,
      tokensGenerated: 1250,
      tokenType: 'ESTIMATED',
      filesIncluded: 4,
      symbolsIncluded: 12
    });

    ledger.record({
      sessionId: 'session-1',
      command: 'task',
      tokensRequested: 0,
      tokensGenerated: 300,
      tokenType: 'TRACE-GENERATED',
      filesIncluded: 2,
      symbolsIncluded: 4
    });

    const summary = ledger.getSummary();
    expect(summary.totalSessions).toBe(1);
    expect(summary.totalInvocations).toBe(2);
    expect(summary.totalTokensGenerated).toBe(1550);
    expect(summary.byCommand['context']).toBe(1);
    expect(summary.byCommand['task']).toBe(1);

    // Reset ledger
    ledger.reset();
    const postReset = ledger.getSummary();
    expect(postReset.totalInvocations).toBe(0);
  });
});

describe('Interactive Graph Server', () => {
  it('initializes local server and handles /api/graph endpoint', async () => {
    const graph = new FeatureGraph();
    const serverInstance = await startGraphServer(process.cwd(), graph, {
      port: 8765,
      openBrowser: false
    });

    try {
      expect(serverInstance.port).toBe(8765);
      expect(serverInstance.url).toBe('http://127.0.0.1:8765');

      const res = await fetch('http://127.0.0.1:8765/api/graph', {
        headers: { connection: 'close' }
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty('nodes');
      expect(json).toHaveProperty('edges');
      expect(json).toHaveProperty('features');

      // Default HTML should have model filter inactive by default
      const htmlRes = await fetch('http://127.0.0.1:8765/', {
        headers: { connection: 'close' }
      });
      expect(htmlRes.status).toBe(200);
      const html = await htmlRes.text();
      expect(html).toContain('data-kind="model"');
      expect(html).not.toMatch(/class="chip active"\s+data-kind="model"/);
      expect(html).toContain('showModels: false');

      // Request with ?models=true should activate models
      const modelsHtmlRes = await fetch('http://127.0.0.1:8765/?models=true', {
        headers: { connection: 'close' }
      });
      expect(modelsHtmlRes.status).toBe(200);
      const modelsHtml = await modelsHtmlRes.text();
      expect(modelsHtml).toContain('class="chip active" data-kind="model"');
      expect(modelsHtml).toContain('showModels: true');
    } finally {
      await serverInstance.stop();
    }
  }, 15000);
});
