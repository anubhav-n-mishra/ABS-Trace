// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FeatureGraph } from '../../packages/trace/src/core/graph.js';
import { CodebaseStore } from '../../packages/trace/src/core/store.js';
import {
  createSymbolUrn,
  createRouteUrn,
  createModelUrn,
  createTestUrn,
  createFeatureUrn,
  parseUrn
} from '../../packages/trace/src/core/urn.js';
import { TokenBudgetManager } from '../../packages/trace/src/core/token-estimator.js';
import type { SymbolNode, FeatureNode, GraphEdge } from '../../packages/trace/src/core/types.js';

describe('Core URN System', () => {
  it('generates stable symbol URNs independent of line numbers', () => {
    const urn1 = createSymbolUrn('src/services/payment.ts', 'processUPIPayment', 'PaymentService');
    const urn2 = createSymbolUrn('src\\services\\payment.ts', 'processUPIPayment', 'PaymentService');

    expect(urn1).toBe('urn:trace:symbol:src/services/payment.ts#PaymentService.processUPIPayment');
    expect(urn2).toBe(urn1); // Windows path normalization
  });

  it('parses URN correctly', () => {
    const urn = createRouteUrn('src/api/payment.ts', 'POST', '/api/payment/upi');
    const parsed = parseUrn(urn);
    expect(parsed.kind).toBe('route');
    expect(parsed.path).toBe('src/api/payment.ts');
    expect(parsed.identifier).toBe('POST:/api/payment/upi');
  });
});

describe('FeatureGraph and Alias Handling', () => {
  let graph: FeatureGraph;

  beforeEach(() => {
    graph = new FeatureGraph();
  });

  it('adds and retrieves nodes and handles aliases', () => {
    const symbol: SymbolNode = {
      urn: 'urn:trace:symbol:src/services/payment.ts#processUPIPayment',
      kind: 'symbol',
      symbolKind: 'function',
      name: 'processUPIPayment',
      path: 'src/services/payment.ts',
      status: 'active',
      aliases: [],
      startLine: 91,
      endLine: 143,
      contentHash: 'hash123',
      isExported: true,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    graph.addNode(symbol);
    expect(graph.getNode(symbol.urn)).toBeDefined();

    // Add historical alias for refactoring
    const oldUrn = 'urn:trace:symbol:src/services/old_payment.ts#processUPIPayment';
    graph.addAlias(oldUrn, symbol.urn);

    // Resolving via old URN retrieves current node
    const resolved = graph.getNode(oldUrn);
    expect(resolved).toBeDefined();
    expect(resolved?.urn).toBe(symbol.urn);
  });

  it('connects features, symbols, and provides impact and explanation', () => {
    const feat: FeatureNode = {
      urn: createFeatureUrn('payments'),
      kind: 'feature',
      name: 'payments',
      displayName: 'Payments',
      path: '',
      status: 'active',
      aliases: [],
      confidence: 'DETECTED',
      confidenceScore: 0.85,
      source: 'ast',
      tags: ['billing'],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const sym: SymbolNode = {
      urn: createSymbolUrn('src/services/payment.ts', 'processUPIPayment'),
      kind: 'symbol',
      symbolKind: 'function',
      name: 'processUPIPayment',
      path: 'src/services/payment.ts',
      status: 'active',
      aliases: [],
      startLine: 10,
      endLine: 30,
      contentHash: 'abc',
      isExported: true,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const edge: GraphEdge = {
      id: 'edge-1',
      sourceUrn: sym.urn,
      targetUrn: feat.urn,
      relationship: 'implements',
      confidence: 'DETECTED',
      confidenceScore: 0.85,
      provenance: { source: 'ast', timestamp: new Date().toISOString() },
      evidence: {
        type: 'ast_call',
        file: sym.path,
        line: sym.startLine,
        reason: 'Payment business logic'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    graph.addNode(feat);
    graph.addNode(sym);
    graph.addEdge(edge);

    const explanation = graph.explain(sym.urn);
    expect(explanation.relatedFeatures.length).toBe(1);
    expect(explanation.relatedFeatures[0]?.feature.displayName).toBe('Payments');
    expect(explanation.relatedFeatures[0]?.evidence[0]?.reason).toBe('Payment business logic');
  });

  it('cleans up connected edges when a node is retired or removed', () => {
    const sym1: SymbolNode = {
      urn: 'urn:trace:symbol:src/a.ts#fnA',
      kind: 'symbol',
      symbolKind: 'function',
      name: 'fnA',
      path: 'src/a.ts',
      status: 'active',
      aliases: [],
      startLine: 1,
      endLine: 10,
      contentHash: 'hashA',
      isExported: true,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const sym2: SymbolNode = {
      urn: 'urn:trace:symbol:src/b.ts#fnB',
      kind: 'symbol',
      symbolKind: 'function',
      name: 'fnB',
      path: 'src/b.ts',
      status: 'active',
      aliases: [],
      startLine: 1,
      endLine: 10,
      contentHash: 'hashB',
      isExported: true,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const edge: GraphEdge = {
      id: 'edge-a-b',
      sourceUrn: sym1.urn,
      targetUrn: sym2.urn,
      relationship: 'calls',
      confidence: 'DETECTED',
      confidenceScore: 0.9,
      provenance: { source: 'ast', timestamp: new Date().toISOString() },
      evidence: { type: 'ast_call', file: sym1.path, line: 5, reason: 'Direct call' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    graph.addNode(sym1);
    graph.addNode(sym2);
    graph.addEdge(edge);

    expect(graph.getAllEdges().length).toBe(1);
    expect(graph.getOutgoingEdges(sym1.urn).length).toBe(1);
    expect(graph.getIncomingEdges(sym2.urn).length).toBe(1);

    // Retiring sym2 must cleanly remove the edge pointing to it
    graph.retireNode(sym2.urn);

    expect(graph.getNode(sym2.urn)?.status).toBe('retired');
    expect(graph.getAllEdges().length).toBe(0);
    expect(graph.getOutgoingEdges(sym1.urn).length).toBe(0);
    expect(graph.getIncomingEdges(sym2.urn).length).toBe(0);
  });
});

describe('TokenBudgetManager', () => {
  it('strictly enforces requested budget limit', () => {
    const manager = new TokenBudgetManager();
    const longText = 'console.log("hello world"); '.repeat(500); // long string
    const maxTokens = 50;

    const truncated = manager.enforceTokenLimit(longText, maxTokens);
    const estimated = manager.estimate(truncated);

    expect(estimated).toBeLessThanOrEqual(maxTokens); // Strict ceiling guarantee
    expect(truncated).toContain('[TRUNCATED');
  });
});
