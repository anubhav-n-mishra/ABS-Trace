// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import type { FeatureGraph } from '../core/graph.js';
import type { TraceNode, FeatureNode, SymbolNode, RouteNode } from '../core/types.js';

export interface SearchResult {
  node: TraceNode;
  score: number;
  matchReason: string;
}

/**
 * Dropped from queries because they substring-match real identifiers: 'to'
 * matches 'stock' and 'inventory', 'in' matches 'index', and a natural-language
 * task description is mostly these. Without the filter, "add account lockout to
 * login" resolves to the Inventory feature.
 */
const QUERY_STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'in', 'on', 'at', 'of', 'for', 'and', 'or', 'is', 'are',
  'be', 'it', 'as', 'by', 'we', 'i', 'my', 'do', 'can', 'add', 'new', 'use', 'set',
  'get', 'make', 'need', 'want', 'with', 'from', 'into', 'this', 'that', 'when',
  'how', 'what', 'where', 'should', 'would', 'please', 'change', 'update', 'fix'
]);

function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !QUERY_STOPWORDS.has(t));
}

/** Splits an identifier or path into lowercase words. */
function nodeWords(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map((w) => w.toLowerCase())
    .filter(Boolean);
}

/** Word-boundary aware match: exact word, plural, or a prefix of a longer word. */
function wordHit(words: string[], token: string): boolean {
  return words.some(
    (w) =>
      w === token ||
      (w.endsWith('s') && w.slice(0, -1) === token) ||
      (token.length >= 4 && w.startsWith(token))
  );
}

export class SemanticMatcher {
  private graph: FeatureGraph;

  constructor(graph: FeatureGraph) {
    this.graph = graph;
  }

  search(query: string, limit = 20): SearchResult[] {
    const rawTokens = queryTokens(query);
    if (rawTokens.length === 0) return [];

    const nodes = this.graph.getActiveNodes();
    const results: SearchResult[] = [];

    for (const node of nodes) {
      let score = 0;
      const reasons: string[] = [];

      const nameLower = node.name.toLowerCase();
      const nameWords = nodeWords(node.name);
      const pathWords = nodeWords(node.path);

      // Exact name match
      if (rawTokens.includes(nameLower)) {
        score += 10;
        reasons.push(`Exact name match '${node.name}'`);
      } else {
        for (const token of rawTokens) {
          if (wordHit(nameWords, token)) {
            score += 5;
            reasons.push(`Name contains '${token}'`);
          }
          if (wordHit(pathWords, token)) {
            score += 3;
            reasons.push(`Path contains '${token}'`);
          }
        }
      }

      // Feature specific matching
      if (node.kind === 'feature') {
        const feat = node as FeatureNode;
        const displayWords = nodeWords(feat.displayName);
        for (const token of rawTokens) {
          if (wordHit(displayWords, token)) {
            score += 6;
            reasons.push(`Feature display name matches '${token}'`);
          }
          if (feat.tags.some((t) => wordHit(nodeWords(t), token))) {
            score += 4;
            reasons.push(`Tag matches '${token}'`);
          }
        }
      }

      // Route specific matching
      if (node.kind === 'route') {
        const route = node as RouteNode;
        const routeWords = nodeWords(route.routePath);
        for (const token of rawTokens) {
          if (wordHit(routeWords, token)) {
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
