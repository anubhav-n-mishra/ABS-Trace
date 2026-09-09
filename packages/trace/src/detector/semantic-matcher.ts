// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import type { FeatureGraph } from '../core/graph.js';
import type { TraceNode, FeatureNode, SymbolNode, RouteNode } from '../core/types.js';

export interface SearchResult {
  node: TraceNode;
  score: number;
  matchReason: string;
}

export class SemanticMatcher {
  private graph: FeatureGraph;

  constructor(graph: FeatureGraph) {
    this.graph = graph;
  }

  search(query: string, limit = 20): SearchResult[] {
    const rawTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (rawTokens.length === 0) return [];

    const nodes = this.graph.getActiveNodes();
    const results: SearchResult[] = [];

    for (const node of nodes) {
      let score = 0;
      const reasons: string[] = [];

      const nameLower = node.name.toLowerCase();
      const pathLower = node.path.toLowerCase();

      // Exact name match
      if (rawTokens.includes(nameLower)) {
        score += 10;
        reasons.push(`Exact name match '${node.name}'`);
      } else {
        // Substring / token matches
        for (const token of rawTokens) {
          if (nameLower.includes(token)) {
            score += 5;
            reasons.push(`Name contains '${token}'`);
          }
          if (pathLower.includes(token)) {
            score += 3;
            reasons.push(`Path contains '${token}'`);
          }
        }
      }

      // Feature specific matching
      if (node.kind === 'feature') {
        const feat = node as FeatureNode;
        const displayLower = feat.displayName.toLowerCase();
        for (const token of rawTokens) {
          if (displayLower.includes(token)) {
            score += 6;
            reasons.push(`Feature display name matches '${token}'`);
          }
          if (feat.tags.some((t) => t.toLowerCase().includes(token))) {
            score += 4;
            reasons.push(`Tag matches '${token}'`);
          }
        }
      }

      // Route specific matching
      if (node.kind === 'route') {
        const route = node as RouteNode;
        const routeLower = route.routePath.toLowerCase();
        for (const token of rawTokens) {
          if (routeLower.includes(token)) {
            score += 7;
            reasons.push(`Route path matches '${token}'`);
          }
        }
      }

      if (score > 0) {
        results.push({
          node,
          score,
          matchReason: reasons.join('; ')
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
