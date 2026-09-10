// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import type { FeatureGraph } from '../core/graph.js';
import type { FeatureNode, SymbolNode } from '../core/types.js';
import { mapFeatureFunctions, resolveSymbolByName, type MappedFunction } from './function-map.js';
import { SemanticMatcher } from '../detector/semantic-matcher.js';

export interface BriefWarning {
  symbol: string;
  location: string;
  message: string;
}

export interface BriefSymbol {
  name: string;
  location: string;
  symbolKind: string;
  calledBy: string[];
  calls: string[];
  consumerCount: number;
}

export interface TaskBrief {
  query: string;
  feature?: FeatureNode;
  entryPoints: MappedFunction[];
  coreFunctions: MappedFunction[];
  routes: Array<{ method: string; routePath: string; location: string }>;
  tests: Array<{ name: string; location: string }>;
  /** Shared choke points whose change reaches beyond the obvious call site. */
  warnings: BriefWarning[];
  files: string[];
  notes: string[];
  /**
   * Populated instead of a feature when nothing matched confidently. Plenty of
   * real code (infrastructure, build tooling, internal utilities) belongs to no
   * product feature at all, and guessing one is worse than saying so.
   */
  symbols?: BriefSymbol[];
}

/**
 * Fraction of query-matching symbols that must actually belong to the winning
 * feature for the match to be trusted.
 *
 * Raw scores cannot be thresholded because they scale with repository size: a
 * genuine match in a small repo scored 11 while an incidental one in a large
 * repo scored 26. This ratio is scale-free — it asks "of the code that matched
 * this query, how much of it is actually this feature?" Measured separation is
 * wide: incidental matches land at 0.00-0.05, genuine ones at 0.33-1.00.
 */
const MIN_FEATURE_SHARE = 0.2;

const CALL_RELS = new Set(['calls', 'imports']);

/**
 * Symbol-centric answer for queries that name code rather than a product
 * feature — build tooling, internal utilities, anything with no feature to
 * belong to. Returns the matched symbols with their real callers and callees.
 */
function buildSymbolBrief(graph: FeatureGraph, query: string): TaskBrief {
  const matcher = new SemanticMatcher(graph);
  const allHits = matcher.search(query, 25).filter((r) => r.node.kind === 'symbol');

  // Locals and constants match on name but rarely answer the question. Keep
  // them only when there are too few real declarations to be useful.
  const declarations = allHits.filter((r) => (r.node as SymbolNode).symbolKind !== 'variable');
  const hits = (declarations.length >= 3 ? declarations : allHits).slice(0, 8);

  const direct = resolveSymbolByName(graph, query);
  if (direct && !hits.some((h) => h.node.urn === direct.urn)) {
    hits.unshift({ node: direct, score: 100, matchReason: 'Direct name match' });
  }

  const symbols: BriefSymbol[] = hits.map((hit) => {
    const node = hit.node as SymbolNode;
    const calledBy: string[] = [];
    for (const edge of graph.getIncomingEdges(node.urn)) {
      if (!CALL_RELS.has(edge.relationship)) continue;
      const source = graph.getNode(edge.sourceUrn);
      if (source && source.status !== 'retired') calledBy.push(source.name);
    }
    const calls: string[] = [];
    for (const edge of graph.getOutgoingEdges(node.urn)) {
      if (!CALL_RELS.has(edge.relationship)) continue;
      const target = graph.getNode(edge.targetUrn);
      if (target && target.status !== 'retired') calls.push(target.name);
    }
    return {
      name: node.name,
      location: `${node.path}:${node.startLine}-${node.endLine}`,
      symbolKind: node.symbolKind,
      calledBy: Array.from(new Set(calledBy)).slice(0, 8),
      calls: Array.from(new Set(calls)).slice(0, 8),
      consumerCount: calledBy.length
    };
  });

  return {
    query,
    entryPoints: [],
    coreFunctions: [],
    routes: [],
    tests: [],
    warnings: [],
    files: Array.from(new Set(hits.map((h) => h.node.path))).sort(),
    notes: [],
    symbols
  };
}

/**
 * Assembles everything an agent needs to start a change in ONE query: which
 * feature the task touches, the functions that implement it with exact line
 * ranges, the routes and tests around it, and — critically — which of those
 * functions are shared choke points whose blast radius exceeds the obvious
 * call site.
 */
export function buildTaskBrief(graph: FeatureGraph, query: string): TaskBrief {
  const notes: string[] = [];

  let feature: FeatureNode | undefined = graph.getFeatureByName(query) ?? undefined;

  // Otherwise aggregate search evidence per feature: a query that matches many
  // Authentication symbols should resolve to Authentication even when no single
  // hit outranks an unrelated symbol.
  if (!feature) {
    const matcher = new SemanticMatcher(graph);
    const results = matcher.search(query, 40);
    const featureScores = new Map<string, number>();
    const featureMembers = new Map<string, Set<string>>();

    const credit = (urn: string, amount: number) => {
      featureScores.set(urn, (featureScores.get(urn) ?? 0) + amount);
    };

    let symbolHitCount = 0;
    for (const result of results) {
      if (result.node.kind === 'feature') {
        credit(result.node.urn, result.score * 2);
        continue;
      }
      symbolHitCount++;
      for (const edge of graph.getOutgoingEdges(result.node.urn)) {
        if (edge.relationship !== 'implements' && edge.relationship !== 'belongs_to') continue;
        const owner = graph.getNode(edge.targetUrn);
        if (owner?.kind !== 'feature') continue;
        credit(owner.urn, result.score);
        if (!featureMembers.has(owner.urn)) featureMembers.set(owner.urn, new Set());
        featureMembers.get(owner.urn)!.add(result.node.urn);
      }
    }

    const ranked = Array.from(featureScores.entries()).sort((a, b) => b[1] - a[1]);
    const bestUrn = ranked[0]?.[0];

    const share =
      bestUrn && symbolHitCount > 0
        ? (featureMembers.get(bestUrn)?.size ?? 0) / symbolHitCount
        : 0;
    const confident = share >= MIN_FEATURE_SHARE;

    if (bestUrn && confident) {
      feature = graph.getNode(bestUrn) as FeatureNode;
    } else {
      const fallback = buildSymbolBrief(graph, query);
      if (fallback.symbols && fallback.symbols.length > 0) {
        if (bestUrn) {
          const near = graph.getNode(bestUrn);
          fallback.notes.push(
            `No feature matched confidently (closest: ${near?.name ?? 'unknown'}). Showing matched symbols instead.`
          );
        }
        return fallback;
      }
      if (bestUrn) feature = graph.getNode(bestUrn) as FeatureNode;
    }
  }

  if (!feature) {
    return {
      query,
      entryPoints: [],
      coreFunctions: [],
      routes: [],
      tests: [],
      warnings: [],
      files: [],
      notes: [`No feature matched '${query}'. Try 'trace features' to list mapped features.`]
    };
  }

  const map = mapFeatureFunctions(graph, feature.urn);

  const warnings: BriefWarning[] = map.functions
    .filter((fn) => fn.isShared)
    .sort((a, b) => b.consumerCount - a.consumerCount)
    .slice(0, 8)
    .map((fn) => ({
      symbol: fn.name,
      location: `${fn.path}:${fn.startLine}`,
      message: `${fn.consumerCount} callers across files`
    }));

  return {
    query,
    feature,
    entryPoints: map.functions.filter((f) => f.isEntryPoint),
    coreFunctions: map.functions.filter((f) => !f.isEntryPoint),
    routes: map.routes.map((r) => ({
      method: r.httpMethod,
      routePath: r.routePath,
      location: `${r.path}:${r.startLine}`
    })),
    tests: map.tests.map((t) => ({ name: t.name, location: `${t.path}:${t.startLine}` })),
    warnings,
    files: map.files,
    notes
  };
}

/**
 * Renders a brief in a deliberately dense format: no box drawing, no repeated
 * evidence strings, one line per fact. Built to be pasted into an agent's
 * context window, where every token competes with actual source code.
 */
export function renderBriefCompact(brief: TaskBrief): string {
  if (brief.symbols && brief.symbols.length > 0) {
    const lines = ['SYMBOLS (no feature matched — showing code that matches the query)'];
    for (const s of brief.symbols) {
      const shared = s.consumerCount > 1 ? ` !shared(${s.consumerCount})` : '';
      lines.push(`  ${s.location} ${s.name} (${s.symbolKind})${shared}`);
      if (s.calledBy.length) lines.push(`    called by: ${s.calledBy.join(', ')}`);
      if (s.calls.length) lines.push(`    calls: ${s.calls.join(', ')}`);
    }
    brief.notes.forEach((n) => lines.push(`NOTE ${n}`));
    return lines.join('\n');
  }

  if (!brief.feature) return brief.notes.join('\n');

  const lines: string[] = [];
  const f = brief.feature;
  lines.push(`FEATURE ${f.displayName} [${f.confidence} ${Math.round(f.confidenceScore * 100)}%]`);

  const fmt = (fn: MappedFunction) => {
    const calls = fn.callsInFeature.length ? ` -> ${fn.callsInFeature.join(',')}` : '';
    const shared = fn.isShared ? ` !shared(${fn.consumerCount})` : '';
    return `  ${fn.path}:${fn.startLine}-${fn.endLine} ${fn.name}${calls}${shared}`;
  };

  if (brief.entryPoints.length) {
    lines.push('ENTRY');
    brief.entryPoints.forEach((fn) => lines.push(fmt(fn)));
  }
  if (brief.coreFunctions.length) {
    lines.push('CORE');
    brief.coreFunctions.forEach((fn) => lines.push(fmt(fn)));
  }
  if (brief.routes.length) {
    lines.push('API');
    brief.routes.forEach((r) => lines.push(`  ${r.method} ${r.routePath} @ ${r.location}`));
  }
  if (brief.tests.length) {
    lines.push('TESTS');
    brief.tests.forEach((t) => lines.push(`  ${t.location} ${t.name}`));
  }
  if (brief.warnings.length) {
    lines.push('BLAST RADIUS (change these and every caller is affected)');
    brief.warnings.forEach((w) => lines.push(`  ${w.symbol} ${w.location} — ${w.message}`));
  }
  if (brief.notes.length) brief.notes.forEach((n) => lines.push(`NOTE ${n}`));

  return lines.join('\n');
}
