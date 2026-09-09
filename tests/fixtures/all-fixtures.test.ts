// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { CodebaseIndexer } from '../../packages/trace/src/indexer/indexer.js';
import { FeatureGraph } from '../../packages/trace/src/core/graph.js';
import { IndexValidator } from '../../packages/trace/src/indexer/validator.js';
import { createTempFixture, type TempFixture } from '../helpers/fixture-copy.js';

describe('Fixture 02: TypeScript Application', () => {
  let fixture: TempFixture;
  let indexer: CodebaseIndexer;

  beforeAll(() => {
    fixture = createTempFixture('fixtures/02-typescript-app');
    indexer = new CodebaseIndexer(fixture.dir);
  });

  afterAll(() => {
    fixture?.cleanup();
  });

  it('extracts interfaces, generic classes, and methods', async () => {
    indexer.getStore().clean();
    const { graph } = await indexer.runFullIndex();

    const userInterface = graph.getActiveNodes().find((n) => n.name === 'User');
    expect(userInterface).toBeDefined();

    const userService = graph.getActiveNodes().find((n) => n.name === 'UserService');
    expect(userService).toBeDefined();

    const updateUserProfile = graph.getActiveNodes().find((n) => n.name === 'updateUserProfile');
    expect(updateUserProfile).toBeDefined();
    expect(updateUserProfile?.urn).toContain('UserService.updateUserProfile');
  });
});

describe('Fixture 03: React Frontend', () => {
  let fixture: TempFixture;
  let indexer: CodebaseIndexer;

  beforeAll(() => {
    fixture = createTempFixture('fixtures/03-react-frontend');
    indexer = new CodebaseIndexer(fixture.dir);
  });

  afterAll(() => {
    fixture?.cleanup();
  });

  it('detects React components and custom hooks', async () => {
    indexer.getStore().clean();
    const { graph } = await indexer.runFullIndex();

    const hook = graph.getActiveNodes().find((n) => n.name === 'useNotification');
    expect(hook).toBeDefined();

    const banner = graph.getActiveNodes().find((n) => n.name === 'NotificationBanner');
    expect(banner).toBeDefined();
  });
});

describe('Fixture 04: Node Backend', () => {
  let fixture: TempFixture;
  let indexer: CodebaseIndexer;

  beforeAll(() => {
    fixture = createTempFixture('fixtures/04-node-backend');
    indexer = new CodebaseIndexer(fixture.dir);
  });

  afterAll(() => {
    fixture?.cleanup();
  });

  it('extracts order service and express routes', async () => {
    indexer.getStore().clean();
    const { graph } = await indexer.runFullIndex();

    const orderService = graph.getActiveNodes().find((n) => n.name === 'OrderService');
    expect(orderService).toBeDefined();

    const createOrderRoute = graph.getActiveNodes().find((n) => n.name === 'POST /api/order/create');
    expect(createOrderRoute).toBeDefined();
  });
});

describe('Fixture 05: Fullstack App with Prisma', () => {
  let fixture: TempFixture;
  let indexer: CodebaseIndexer;

  beforeAll(() => {
    fixture = createTempFixture('fixtures/05-fullstack-app');
    indexer = new CodebaseIndexer(fixture.dir);
  });

  afterAll(() => {
    fixture?.cleanup();
  });

  it('extracts Prisma models with relations and API routes', async () => {
    indexer.getStore().clean();
    const { graph } = await indexer.runFullIndex();

    const paymentModel = graph.getActiveNodes().find((n) => n.name === 'Payment' && n.kind === 'model');
    expect(paymentModel).toBeDefined();

    const checkoutService = graph.getActiveNodes().find((n) => n.name === 'CheckoutService');
    expect(checkoutService).toBeDefined();

    const checkoutRoute = graph.getActiveNodes().find((n) => n.name.includes('/api/checkout/process'));
    expect(checkoutRoute).toBeDefined();
  });
});

describe('Fixture 06: Vibe-Coded Spaghetti', () => {
  let fixture: TempFixture;
  let indexer: CodebaseIndexer;

  beforeAll(() => {
    fixture = createTempFixture('fixtures/06-vibe-coded-mess');
    indexer = new CodebaseIndexer(fixture.dir);
  });

  afterAll(() => {
    fixture?.cleanup();
  });

  it('parses messy code and discovers mixed features', async () => {
    indexer.getStore().clean();
    const { graph } = await indexer.runFullIndex();

    expect(graph.getActiveNodes().length).toBeGreaterThan(5);

    const loginQuick = graph.getActiveNodes().find((n) => n.name.includes('login_quick'));
    expect(loginQuick).toBeDefined();

    const payInstant = graph.getActiveNodes().find((n) => n.name.includes('pay_instant'));
    expect(payInstant).toBeDefined();

    const features = graph.getFeatures();
    expect(features.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Fixture 07: Monorepo', () => {
  let fixture: TempFixture;
  let indexer: CodebaseIndexer;

  beforeAll(() => {
    fixture = createTempFixture('fixtures/07-monorepo');
    indexer = new CodebaseIndexer(fixture.dir);
  });

  afterAll(() => {
    fixture?.cleanup();
  });

  it('indexes across workspace packages', async () => {
    indexer.getStore().clean();
    const { graph } = await indexer.runFullIndex();

    const sharedType = graph.getActiveNodes().find((n) => n.name === 'SharedAuthUser');
    expect(sharedType).toBeDefined();

    const apiGateway = graph.getActiveNodes().find((n) => n.name === 'GET /api/auth/profile');
    expect(apiGateway).toBeDefined();
  });
});

describe('Fixture 08: Renamed Files', () => {
  let fixture: TempFixture;
  let indexer: CodebaseIndexer;

  beforeAll(() => {
    fixture = createTempFixture('fixtures/08-renamed-files');
    indexer = new CodebaseIndexer(fixture.dir);
  });

  afterAll(() => {
    fixture?.cleanup();
  });

  it('preserves URN aliases across file moves', async () => {
    indexer.getStore().clean();
    const { graph } = await indexer.runFullIndex();

    const oldPath = path.join(fixture.dir, 'src/legacy/oldPaymentProcessor.js');
    const newDir = path.join(fixture.dir, 'src/services');
    const newPath = path.join(newDir, 'ModernPaymentProcessor.js');

    // Move file
    if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
    fs.renameSync(oldPath, newPath);

    // Incremental update
    await indexer.runIncrementalUpdate();

    const updatedGraph = new FeatureGraph();
    indexer.getStore().loadGraph(updatedGraph);

    const modernProcessor = updatedGraph.getActiveNodes().find((n) => n.path.includes('ModernPaymentProcessor'));
    expect(modernProcessor).toBeDefined();

    // Revert move
    fs.renameSync(newPath, oldPath);
    await indexer.runIncrementalUpdate();
  });
});

describe('Fixture 09: Deleted Features', () => {
  let fixture: TempFixture;
  let indexer: CodebaseIndexer;

  beforeAll(() => {
    fixture = createTempFixture('fixtures/09-deleted-features');
    indexer = new CodebaseIndexer(fixture.dir);
  });

  afterAll(() => {
    fixture?.cleanup();
  });

  it('retires nodes upon deletion without breaking index', async () => {
    indexer.getStore().clean();
    await indexer.runFullIndex();

    const filePath = path.join(fixture.dir, 'src/features/deprecated/cryptoPayment.js');
    const backupContent = fs.readFileSync(filePath, 'utf8');

    // Delete file
    fs.unlinkSync(filePath);

    // Incremental update
    const { retiredCount } = await indexer.runIncrementalUpdate();
    expect(retiredCount).toBeGreaterThan(0);

    const graph = new FeatureGraph();
    indexer.getStore().loadGraph(graph);
    const activeCrypto = graph.getActiveNodes().find((n) => n.path.includes('cryptoPayment'));
    expect(activeCrypto).toBeUndefined();

    // Verify incremental update cleaned up edges to retired nodes without dangling references
    const { detectDeadCode } = await import('../../packages/trace/src/intelligence/dead-code.js');
    const deadReport = detectDeadCode(graph);
    expect(deadReport.retiredNodesReferenced.length).toBe(0);

    // Restore file
    fs.writeFileSync(filePath, backupContent, 'utf8');
    await indexer.runIncrementalUpdate();
  });
});

describe('Fixture 10: Shared Services Impact', () => {
  let fixture: TempFixture;
  let indexer: CodebaseIndexer;

  beforeAll(() => {
    fixture = createTempFixture('fixtures/10-shared-services');
    indexer = new CodebaseIndexer(fixture.dir);
  });

  afterAll(() => {
    fixture?.cleanup();
  });

  it('traces multi-feature consumers for shared payment service', async () => {
    indexer.getStore().clean();
    const { graph } = await indexer.runFullIndex();

    const paymentService = graph.getActiveNodes().find((n) => n.name === 'paymentService');
    expect(paymentService).toBeDefined();

    const impact = graph.getImpact(paymentService!.urn);
    expect(impact.directConsumers.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Fixture 11: Ambiguous Features & Confidence Grading', () => {
  let fixture: TempFixture;
  let indexer: CodebaseIndexer;

  beforeAll(() => {
    fixture = createTempFixture('fixtures/11-ambiguous-features');
    indexer = new CodebaseIndexer(fixture.dir);
  });

  afterAll(() => {
    fixture?.cleanup();
  });

  it('distinguishes EXPLICIT from DETECTED and explains evidence', async () => {
    indexer.getStore().clean();
    const { graph } = await indexer.runFullIndex();

    const authFeat = graph.getFeatures().find((f) => f.name === 'authentication');
    expect(authFeat).toBeDefined();
    expect(authFeat?.confidence).toBe('EXPLICIT');
    expect(authFeat?.confidenceScore).toBe(1.0);

    const paymentFeat = graph.getFeatures().find((f) => f.name === 'payments');
    expect(paymentFeat).toBeDefined();
    expect(paymentFeat?.confidence).toBe('DETECTED');
  });
});
