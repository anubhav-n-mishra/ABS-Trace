// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import type { FeatureGraph } from '../core/graph.js';
import type { FeatureNode, SymbolNode, RouteNode, TestNode, TraceNode } from '../core/types.js';

const CALL_RELATIONSHIPS = new Set(['calls', 'imports']);

export interface MappedFunction {
  urn: string;
  name: string;
  path: string;
  startLine: number;
  endLine: number;
  symbolKind: string;
  isExported: boolean;
  /** Functions this one calls that also belong to the feature. */
  callsInFeature: string[];
  /** How many distinct consumers call this function repository-wide. */
  consumerCount: number;
  /** True when consumers span more than one file: changing it has reach. */
  isShared: boolean;
  /** Nothing in the feature calls it, so it is an entry point or a leaf API. */
  isEntryPoint: boolean;
}

export interface FeatureFunctionMap {
  feature: FeatureNode;
  functions: MappedFunction[];
  files: string[];
  routes: RouteNode[];
  tests: TestNode[];
}

function isCallable(node: TraceNode): node is SymbolNode {
  if (node.kind !== 'symbol') return false;
  const kind = (node as SymbolNode).symbolKind;
  return kind === 'function' || kind === 'method' || kind === 'component' || kind === 'hook' || kind === 'class';
}

/**
 * Lists every function that implements a feature, across every file, ordered
 * so entry points come first and shared choke points are flagged. This is the
 * "where does this feature actually live" question that otherwise costs a
 * grep plus a dozen file reads.
 */
export function mapFeatureFunctions(graph: FeatureGraph, featureUrn: string): FeatureFunctionMap {
  const resolved = graph.resolveUrn(featureUrn);
  const feature = graph.getNode(resolved);
  if (!feature || feature.kind !== 'feature') {
    throw new Error(`Feature not found for URN: ${featureUrn}`);
  }

  const members: TraceNode[] = [];
  for (const edge of graph.getIncomingEdges(resolved)) {
    if (edge.relationship !== 'implements' && edge.relationship !== 'belongs_to') continue;
    const node = graph.getNode(edge.sourceUrn);
    if (node && node.status !== 'retired') members.push(node);
  }

  const callables = members.filter(isCallable);
  const memberUrns = new Set(callables.map((c) => c.urn));

  const functions: MappedFunction[] = callables.map((sym) => {
    const callsInFeature: string[] = [];
    for (const edge of graph.getOutgoingEdges(sym.urn)) {
      if (!CALL_RELATIONSHIPS.has(edge.relationship)) continue;
      const target = graph.getNode(edge.targetUrn);
      if (target && memberUrns.has(target.urn)) callsInFeature.push(target.name);
    }

    const consumerPaths = new Set<string>();
    let consumerCount = 0;
    let calledFromInsideFeature = false;
    for (const edge of graph.getIncomingEdges(sym.urn)) {
      if (!CALL_RELATIONSHIPS.has(edge.relationship)) continue;
      const source = graph.getNode(edge.sourceUrn);
      if (!source || source.status === 'retired') continue;
      consumerCount++;
      if (source.path) consumerPaths.add(source.path);
      if (memberUrns.has(source.urn)) calledFromInsideFeature = true;
    }

    return {
      urn: sym.urn,
      name: sym.name,
      path: sym.path,
      startLine: sym.startLine,
      endLine: sym.endLine,
      symbolKind: sym.symbolKind,
      isExported: sym.isExported,
      callsInFeature: Array.from(new Set(callsInFeature)),
      consumerCount,
      isShared: consumerPaths.size > 1,
      isEntryPoint: !calledFromInsideFeature
    };
  });

  // Entry points first, then the most-depended-upon functions.
  functions.sort((a, b) => {
    if (a.isEntryPoint !== b.isEntryPoint) return a.isEntryPoint ? -1 : 1;
    if (b.consumerCount !== a.consumerCount) return b.consumerCount - a.consumerCount;
    return a.path.localeCompare(b.path) || a.startLine - b.startLine;
  });

  return {
    feature: feature as FeatureNode,
    functions,
    files: Array.from(new Set(callables.map((c) => c.path))).sort(),
    routes: members.filter((m): m is RouteNode => m.kind === 'route'),
    tests: members.filter((m): m is TestNode => m.kind === 'test')
  };
}

export interface CallPath {
  nodes: Array<{ urn: string; name: string; path: string; line: number }>;
}

/**
 * Finds concrete call paths between two symbols by walking 'calls' edges.
 * Answers "how does this request actually reach the database" in one query
 * instead of a chain of file reads.
 */
export function findCallPaths(
  graph: FeatureGraph,
  fromUrn: string,
  toUrn: string,
  maxDepth = 8,
  maxPaths = 5
): CallPath[] {
  const start = graph.resolveUrn(fromUrn);
  const goal = graph.resolveUrn(toUrn);
  const paths: CallPath[] = [];

  const describe = (urn: string) => {
    const node = graph.getNode(urn);
    return {
      urn,
      name: node?.name ?? urn,
      path: node?.path ?? '',
      line: (node as SymbolNode | undefined)?.startLine ?? 0
    };
  };

  const walk = (current: string, trail: string[], seen: Set<string>) => {
    if (paths.length >= maxPaths || trail.length > maxDepth) return;
    if (current === goal) {
      paths.push({ nodes: trail.map(describe) });
      return;
    }
    for (const edge of graph.getOutgoingEdges(current)) {
      if (!CALL_RELATIONSHIPS.has(edge.relationship)) continue;
      const next = graph.resolveUrn(edge.targetUrn);
      if (seen.has(next)) continue;
      const node = graph.getNode(next);
      if (!node || node.status === 'retired') continue;
      seen.add(next);
      walk(next, [...trail, next], seen);
      seen.delete(next);
    }
  };

  walk(start, [start], new Set([start]));
  return paths;
}

/** Resolves a free-text name to a node, preferring exact symbol matches. */
export function resolveSymbolByName(graph: FeatureGraph, name: string): TraceNode | undefined {
  const lower = name.toLowerCase();
  const active = graph.getActiveNodes();
  return (
    active.find((n) => n.kind === 'symbol' && n.name === name) ||
    active.find((n) => n.kind === 'symbol' && n.name.toLowerCase() === lower) ||
    active.find((n) => n.name === name) ||
    active.find((n) => n.name.toLowerCase() === lower) ||
    active.find((n) => n.kind === 'symbol' && n.name.toLowerCase().includes(lower))
  );
}
