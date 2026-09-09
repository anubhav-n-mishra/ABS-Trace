// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import fs from 'node:fs';
import path from 'node:path';
import type { FeatureGraph } from '../core/graph.js';
import type { FeatureNode } from '../core/types.js';

export type DimensionStatus = 'COMPLETE' | 'PARTIAL' | 'MISSING';

export interface TraceabilityDimension {
  dimension: 'Implementation' | 'API' | 'Database' | 'Tests' | 'Documentation' | 'Consumers';
  status: DimensionStatus;
  symbol: string; // '✓' | '⚠' | '✗'
  details: string;
}

export interface FeatureCoverageReport {
  feature: FeatureNode;
  dimensions: TraceabilityDimension[];
  completenessScore: number; // 0 to 100
  caveat: string;
}

/**
 * Evaluates architectural feature traceability across 6 core dimensions.
 * Note: This is architectural traceability, not dynamic code coverage.
 */
export function evaluateFeatureCoverage(
  repoRoot: string,
  graph: FeatureGraph,
  featureName?: string
): FeatureCoverageReport[] {
  const features = featureName ? [graph.getFeatureByName(featureName)].filter(Boolean) as FeatureNode[] : graph.getFeatures();

  const reports: FeatureCoverageReport[] = [];

  for (const feat of features) {
    const view = graph.getFeatureView(feat.urn);
    const dimensions: TraceabilityDimension[] = [];

    // 1. Implementation
    const implCount = view.ui.length + view.services.length;
    dimensions.push({
      dimension: 'Implementation',
      status: implCount > 0 ? 'COMPLETE' : 'MISSING',
      symbol: implCount > 0 ? '✓' : '✗',
      details: `${implCount} mapped symbol(s) (${view.ui.length} UI, ${view.services.length} services)`
    });

    // 2. API
    dimensions.push({
      dimension: 'API',
      status: view.api.length > 0 ? 'COMPLETE' : 'MISSING',
      symbol: view.api.length > 0 ? '✓' : '✗',
      details: `${view.api.length} mapped route(s)`
    });

    // 3. Database
    dimensions.push({
      dimension: 'Database',
      status: view.database.length > 0 ? 'COMPLETE' : 'MISSING',
      symbol: view.database.length > 0 ? '✓' : '✗',
      details: `${view.database.length} mapped model(s)`
    });

    // 4. Tests
    const testCount = view.tests.length;
    let testStatus: DimensionStatus = 'MISSING';
    let testSymbol = '✗';
    if (testCount >= 2) {
      testStatus = 'COMPLETE';
      testSymbol = '✓';
    } else if (testCount === 1) {
      testStatus = 'PARTIAL';
      testSymbol = '⚠';
    }
    dimensions.push({
      dimension: 'Tests',
      status: testStatus,
      symbol: testSymbol,
      details: `${testCount} mapped test suite(s)/case(s)`
    });

    // 5. Documentation
    let hasDocs = false;
    try {
      const docsDir = path.join(repoRoot, 'docs');
      if (fs.existsSync(docsDir)) {
        const files = fs.readdirSync(docsDir, { recursive: true }) as string[];
        for (const file of files) {
          if (file.toString().toLowerCase().includes(feat.name.toLowerCase())) {
            hasDocs = true;
            break;
          }
        }
      }
    } catch {
      hasDocs = false;
    }
    dimensions.push({
      dimension: 'Documentation',
      status: hasDocs ? 'COMPLETE' : 'MISSING',
      symbol: hasDocs ? '✓' : '✗',
      details: hasDocs ? 'Referenced in docs/' : 'No dedicated documentation file detected'
    });

    // 6. Consumers
    const consumerCount = view.consumers.length;
    dimensions.push({
      dimension: 'Consumers',
      status: consumerCount > 0 ? 'COMPLETE' : 'MISSING',
      symbol: consumerCount > 0 ? '✓' : '✗',
      details: `${consumerCount} consumer relationship(s)`
    });

    // Compute completeness score
    const points = dimensions.reduce((acc, d) => {
      if (d.status === 'COMPLETE') return acc + 100;
      if (d.status === 'PARTIAL') return acc + 50;
      return acc;
    }, 0);
    const score = Math.round(points / dimensions.length);

    reports.push({
      feature: feat,
      dimensions,
      completenessScore: score,
      caveat: 'Absence from the feature graph indicates unmapped references; it does not guarantee absence from the repository.'
    });
  }

  return reports;
}
