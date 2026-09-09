// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import type { FeatureGraph } from '../core/graph.js';
import type { TraceNode } from '../core/types.js';

export type CouplingRating = 'HIGH' | 'MEDIUM' | 'LOW';

export interface HotspotMetrics {
  node: TraceNode;
  incomingEdges: number;
  outgoingEdges: number;
  featureCount: number;
  consumerCount: number;
  apiCount: number;
  testCount: number;
  couplingScore: number;
  couplingRating: CouplingRating;
  formula: string;
}

export interface HotspotsReport {
  totalAnalyzed: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  hotspots: HotspotMetrics[];
}

/**
 * Identifies highly coupled architectural nodes using a deterministic, documented coupling formula:
 * Score = (2 * incomingEdges) + (1 * outgoingEdges) + (3 * featureCount) + (2 * consumerCount) + (2 * apiCount)
 *
 * Ratings:
 * - HIGH:   Score >= 20
 * - MEDIUM: Score >= 8 && Score < 20
 * - LOW:    Score < 8
 */
export function analyzeHotspots(graph: FeatureGraph, limit = 10): HotspotsReport {
  const activeNodes = graph.getActiveNodes();
  const targetNodes = activeNodes.filter((n) => ['symbol', 'file', 'model'].includes(n.kind));

  const formulaDoc = 'Score = (2 * incoming) + (1 * outgoing) + (3 * features) + (2 * consumers) + (2 * apis)';
  const metricsList: HotspotMetrics[] = [];

  for (const node of targetNodes) {
    const inEdges = graph.getIncomingEdges(node.urn);
    const outEdges = graph.getOutgoingEdges(node.urn);

    // Connected features
    const featureUrns = new Set<string>();
    for (const edge of [...inEdges, ...outEdges]) {
      const otherUrn = edge.sourceUrn === node.urn ? edge.targetUrn : edge.sourceUrn;
      const other = graph.getNode(otherUrn);
      if (other && other.kind === 'feature') {
        featureUrns.add(other.urn);
      }
    }

    // Direct consumers and tests
    const impact = graph.getImpact(node.urn);
    const consumerCount = impact.directConsumers.length;
    const testCount = impact.affectedTests.length;
    const apiCount = impact.affectedApis.length;

    const score =
      2 * inEdges.length +
      1 * outEdges.length +
      3 * featureUrns.size +
      2 * consumerCount +
      2 * apiCount;

    let rating: CouplingRating = 'LOW';
    if (score >= 20) {
      rating = 'HIGH';
    } else if (score >= 8) {
      rating = 'MEDIUM';
    }

    metricsList.push({
      node,
      incomingEdges: inEdges.length,
      outgoingEdges: outEdges.length,
      featureCount: featureUrns.size,
      consumerCount,
      apiCount,
      testCount,
      couplingScore: score,
      couplingRating: rating,
      formula: formulaDoc
    });
  }

  // Sort descending by score
  metricsList.sort((a, b) => b.couplingScore - a.couplingScore);

  const highRisk = metricsList.filter((m) => m.couplingRating === 'HIGH').length;
  const medRisk = metricsList.filter((m) => m.couplingRating === 'MEDIUM').length;
  const lowRisk = metricsList.filter((m) => m.couplingRating === 'LOW').length;

  return {
    totalAnalyzed: metricsList.length,
    highRiskCount: highRisk,
    mediumRiskCount: medRisk,
    lowRiskCount: lowRisk,
    hotspots: metricsList.slice(0, limit)
  };
}
