// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import type { FeatureGraph } from '../core/graph.js';
import type { TraceNode } from '../core/types.js';

export interface CycleNodeInfo {
  urn: string;
  name: string;
  kind: string;
  path?: string;
}

export interface DetectedCycle {
  level: 'symbol' | 'file' | 'feature';
  chain: string[];
  nodes: CycleNodeInfo[];
}

export interface CycleReport {
  hasCycles: boolean;
  cycleCount: number;
  cycles: DetectedCycle[];
}

/**
 * Detects circular dependencies at symbol, file, and feature levels using DFS.
 */
export function detectCycles(graph: FeatureGraph): CycleReport {
  const activeNodes = graph.getActiveNodes();
  const edges = graph.getAllEdges();

  const cycles: DetectedCycle[] = [];
  const visitedCycleSignatures = new Set<string>();

  // 1. Symbol-level cycles (calls, imports)
  const symbolAdjacency = new Map<string, Set<string>>();
  for (const node of activeNodes) {
    if (node.kind === 'symbol') {
      symbolAdjacency.set(node.urn, new Set());
    }
  }

  for (const edge of edges) {
    if (['calls', 'imports'].includes(edge.relationship)) {
      const source = graph.resolveUrn(edge.sourceUrn);
      const target = graph.resolveUrn(edge.targetUrn);
      if (symbolAdjacency.has(source) && symbolAdjacency.has(target) && source !== target) {
        symbolAdjacency.get(source)!.add(target);
      }
    }
  }

  findCyclesInGraph(symbolAdjacency, graph, 'symbol', cycles, visitedCycleSignatures);

  // 2. File-level cycles
  const fileAdjacency = new Map<string, Set<string>>();
  for (const node of activeNodes) {
    if (node.path) {
      const fileUrn = `urn:trace:file:${node.path}`;
      if (!fileAdjacency.has(fileUrn)) {
        fileAdjacency.set(fileUrn, new Set());
      }
    }
  }

  for (const edge of edges) {
    if (['calls', 'imports'].includes(edge.relationship)) {
      const sNode = graph.getNode(edge.sourceUrn);
      const tNode = graph.getNode(edge.targetUrn);
      if (sNode?.path && tNode?.path && sNode.path !== tNode.path) {
        const sFile = `urn:trace:file:${sNode.path}`;
        const tFile = `urn:trace:file:${tNode.path}`;
        if (!fileAdjacency.has(sFile)) fileAdjacency.set(sFile, new Set());
        fileAdjacency.get(sFile)!.add(tFile);
      }
    }
  }

  findCyclesInGraph(fileAdjacency, graph, 'file', cycles, visitedCycleSignatures);

  return {
    hasCycles: cycles.length > 0,
    cycleCount: cycles.length,
    cycles
  };
}

function findCyclesInGraph(
  adj: Map<string, Set<string>>,
  graph: FeatureGraph,
  level: 'symbol' | 'file' | 'feature',
  outCycles: DetectedCycle[],
  visitedSignatures: Set<string>
): void {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(curr: string): void {
    visited.add(curr);
    recursionStack.add(curr);
    path.push(curr);

    const neighbors = adj.get(curr) || new Set();
    for (const next of neighbors) {
      if (!visited.has(next)) {
        dfs(next);
      } else if (recursionStack.has(next)) {
        // Cycle detected
        const cycleStartIndex = path.indexOf(next);
        if (cycleStartIndex !== -1) {
          const cyclePath = [...path.slice(cycleStartIndex), next];
          // Canonical signature: sort rotated cycle representation to deduplicate
          const cycleNodes = cyclePath.slice(0, -1);
          const minIndex = cycleNodes.reduce((minI, u, idx, arr) => (u < arr[minI]! ? idx : minI), 0);
          const normalized = [...cycleNodes.slice(minIndex), ...cycleNodes.slice(0, minIndex)];
          const signature = `${level}:${normalized.join('->')}`;

          if (!visitedSignatures.has(signature)) {
            visitedSignatures.add(signature);

            const detailedNodes: CycleNodeInfo[] = cyclePath.map((urn) => {
              const n = graph.getNode(urn);
              if (n) {
                return { urn: n.urn, name: n.name, kind: n.kind, path: n.path };
              }
              const display = urn.replace(/^urn:trace:(file|symbol):/, '');
              return { urn, name: display, kind: level, path: display };
            });

            outCycles.push({
              level,
              chain: cyclePath.map((u) => {
                const node = graph.getNode(u);
                return node?.name || u.replace(/^urn:trace:(file|symbol):/, '');
              }),
              nodes: detailedNodes
            });
          }
        }
      }
    }

    path.pop();
    recursionStack.delete(curr);
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }
}
