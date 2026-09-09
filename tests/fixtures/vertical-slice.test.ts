// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { CodebaseIndexer } from '../../packages/trace/src/indexer/indexer.js';
import { IndexValidator } from '../../packages/trace/src/indexer/validator.js';
import { FeatureGraph } from '../../packages/trace/src/core/graph.js';
import { generateLLMContext } from '../../packages/trace/src/renderers/llm-context.js';
import { createTempFixture, type TempFixture } from '../helpers/fixture-copy.js';

describe('Vertical Slice: 01-small-js', () => {
  let fixture: TempFixture;
  let fixtureDir: string;
  let indexer: CodebaseIndexer;

  beforeAll(() => {
    fixture = createTempFixture('fixtures/01-small-js');
    fixtureDir = fixture.dir;
    indexer = new CodebaseIndexer(fixtureDir);
  });

  afterAll(() => {
    fixture?.cleanup();
  });

  beforeEach(async () => {
    // Clean and initialize
    indexer.getStore().clean();
    await indexer.runFullIndex();
  });

  it('indexes fixture and creates feature map with evidence', () => {
    const graph = new FeatureGraph();
    const meta = indexer.getStore().loadGraph(graph);

    expect(meta.schemaVersion).toBe(1);
    expect(meta.stats.fileCount).toBeGreaterThanOrEqual(6);

    const features = graph.getFeatures();
    expect(features.length).toBeGreaterThanOrEqual(2);

    const paymentFeat = graph.getFeatureByName('Payments');
    expect(paymentFeat).toBeDefined();

    const view = graph.getFeatureView(paymentFeat!.urn);
    expect(view.ui.length).toBeGreaterThanOrEqual(1);
    expect(view.api.length).toBeGreaterThanOrEqual(2);
    expect(view.services.length).toBeGreaterThanOrEqual(2);
    expect(view.tests.length).toBeGreaterThanOrEqual(2);

    // Verify structured evidence
    expect(view.ui[0]?.evidence.reason).toBeDefined();
    expect(view.api[0]?.evidence.type).toBe('route_match');
  });

  it('traces impact for PaymentService to test cases', () => {
    const graph = new FeatureGraph();
    indexer.getStore().loadGraph(graph);

    const paymentService = graph.getActiveNodes().find((n) => n.name === 'PaymentService');
    expect(paymentService).toBeDefined();

    const impact = graph.getImpact(paymentService!.urn);
    expect(impact.affectedTests.length).toBeGreaterThanOrEqual(1);
    expect(impact.affectedTests.some((t) => t.name.includes('UPI'))).toBe(true);
  });

  it('generates token-bounded context for LLM', () => {
    const graph = new FeatureGraph();
    indexer.getStore().loadGraph(graph);

    const context = generateLLMContext(graph, 'Payments', { maxTokens: 1000 });
    expect(context).toContain('# Feature Context: Payments');
    expect(context).toContain('POST /api/payment/upi');
    expect(context).toContain('PaymentService');
  });

  it('validates index health with 0 errors', () => {
    const graph = new FeatureGraph();
    indexer.getStore().loadGraph(graph);

    const validator = new IndexValidator(fixtureDir);
    const report = validator.validate(graph);

    expect(report.isValid).toBe(true);
    expect(report.errorCount).toBe(0);
  });

  it('detects drift when file is modified and updates index cleanly', async () => {
    // Initial status: current
    const initialStatus = indexer.checkStatus();
    expect(initialStatus.isStale).toBe(false);

    // Modify file
    const servicePath = path.join(fixtureDir, 'src/services/payment.js');
    const originalContent = fs.readFileSync(servicePath, 'utf8');
    fs.writeFileSync(servicePath, originalContent + '\n// Temporary modification comment', 'utf8');

    // Drift detected
    const driftStatus = indexer.checkStatus();
    expect(driftStatus.isStale).toBe(true);
    expect(driftStatus.workingTree.modified).toContain('src/services/payment.js');

    // Run incremental update
    const updateRes = await indexer.runIncrementalUpdate();
    expect(updateRes.updatedCount).toBeGreaterThanOrEqual(1);

    // Status is current again
    const postStatus = indexer.checkStatus();
    expect(postStatus.isStale).toBe(false);

    // Revert modification
    fs.writeFileSync(servicePath, originalContent, 'utf8');
    await indexer.runIncrementalUpdate();
  });
});
