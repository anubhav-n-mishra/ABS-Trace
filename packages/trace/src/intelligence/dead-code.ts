// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import type { FeatureGraph } from '../core/graph.js';
import type { SymbolNode, TraceNode } from '../core/types.js';

export interface DeadNodeFinding {
  status: 'POSSIBLY DEAD';
  urn: string;
  name: string;
  kind: string;
  path: string;
  reason: string;
  confidence: 'INFERRED';
  caveat: string;
}

export interface DeadCodeReport {
  totalFindings: number;
  possiblyDeadSymbols: DeadNodeFinding[];
  possiblyDeadFiles: DeadNodeFinding[];
  retiredNodesReferenced: DeadNodeFinding[];
  brokenRelationships: DeadNodeFinding[];
}

/**
 * Detects unreferenced symbols, unconsumed files, and orphan graph references.
 *
 * CRITICAL DIRECTIVE: All findings are designated 'POSSIBLY DEAD' because static analysis
 * cannot determine runtime reflection, dynamic dispatch, or external package consumers.
 */
export function detectDeadCode(graph: FeatureGraph): DeadCodeReport {
  const allNodes = graph.getAllNodes();
  const activeNodes = graph.getActiveNodes();
  const edges = graph.getAllEdges();

  const possiblyDeadSymbols: DeadNodeFinding[] = [];
  const possiblyDeadFiles: DeadNodeFinding[] = [];
  const retiredNodesReferenced: DeadNodeFinding[] = [];
  const brokenRelationships: DeadNodeFinding[] = [];

  const incomingCounts = new Map<string, number>();
  for (const edge of edges) {
    const target = graph.resolveUrn(edge.targetUrn);
    incomingCounts.set(target, (incomingCounts.get(target) || 0) + 1);
  }

  // 1. Unreferenced symbols
  for (const node of activeNodes) {
    if (node.kind === 'symbol') {
      const symbol = node as SymbolNode;

      // Locals and variables are excluded deliberately. The graph records
      // cross-file relationships, not intra-file dataflow, so a module-scope
      // binding that is only used within its own file (an import alias, a
      // router handed to app.use) looks unreferenced here even though it is
      // live. Unused locals are a linter's job; this report is for declarations
      // that nothing in the repository consumes.
      const isLocal = Boolean(symbol.enclosingScope);
      const isDeclaration =
        symbol.symbolKind === 'function' ||
        symbol.symbolKind === 'class' ||
        symbol.symbolKind === 'component' ||
        symbol.symbolKind === 'hook';
      if (isLocal || !isDeclaration) continue;

      const incoming = incomingCounts.get(node.urn) || 0;
      // Also check incoming through feature edges
      const inEdges = graph.getIncomingEdges(node.urn);
      const isReferenced = incoming > 0 || inEdges.length > 0;

      // Skip common entrypoints / root exports / test blocks
      const isTestOrConfig =
        node.path.includes('.test.') ||
        node.path.includes('.spec.') ||
        node.path.startsWith('tests/') ||
        node.path.endsWith('.config.js') ||
        node.path.endsWith('.config.ts');

      if (!isReferenced && !isTestOrConfig) {
        possiblyDeadSymbols.push({
          status: 'POSSIBLY DEAD',
          urn: node.urn,
          name: node.name,
          kind: 'symbol',
          path: node.path,
          reason: `No incoming calls, imports, or feature links detected in the graph for '${node.name}'`,
          confidence: 'INFERRED',
          caveat: 'May be an external library export, dynamically invoked, or invoked via reflection.'
        });
      }
    }
  }

  // 2. Unconsumed files
  const fileConsumerCounts = new Map<string, number>();
  for (const edge of edges) {
    const sNode = graph.getNode(edge.sourceUrn);
    const tNode = graph.getNode(edge.targetUrn);
    if (sNode?.path && tNode?.path && sNode.path !== tNode.path) {
      fileConsumerCounts.set(tNode.path, (fileConsumerCounts.get(tNode.path) || 0) + 1);
    }
  }

  const allFiles = new Set(activeNodes.map((n) => n.path).filter(Boolean));
  for (const file of allFiles) {
    const isCodeFile = /\.(js|ts|jsx|tsx|mjs|cjs)$/.test(file);
    if (!isCodeFile) continue;

    // Exclude entrypoints, binaries, index files, server scripts, tests
    const isEntrypoint =
      file.endsWith('index.ts') ||
      file.endsWith('index.js') ||
      file.endsWith('main.ts') ||
      file.endsWith('main.js') ||
      file.endsWith('server.js') ||
      file.endsWith('app.ts') ||
      file.startsWith('bin/') ||
      file.includes('tests/') ||
      file.includes('fixtures/') ||
      file.endsWith('.test.ts') ||
      file.endsWith('.test.js');

    const consumers = fileConsumerCounts.get(file) || 0;
    if (consumers === 0 && !isEntrypoint) {
      possiblyDeadFiles.push({
        status: 'POSSIBLY DEAD',
        urn: `urn:trace:file:${file}`,
        name: file,
        kind: 'file',
        path: file,
        reason: `No files in the repository import or call symbols from '${file}'`,
        confidence: 'INFERRED',
        caveat: 'May be an executable script, worker, dynamic plugin, or route entrypoint.'
      });
    }
  }

  // 3. Retired nodes still referenced
  for (const edge of edges) {
    const sNode = graph.getNode(edge.sourceUrn);
    const tNode = graph.getNode(edge.targetUrn);

    if (sNode?.status === 'retired') {
      retiredNodesReferenced.push({
        status: 'POSSIBLY DEAD',
        urn: sNode.urn,
        name: sNode.name,
        kind: sNode.kind,
        path: sNode.path,
        reason: `Retired node '${sNode.name}' is still referenced as source in edge ${edge.id}`,
        confidence: 'INFERRED',
        caveat: 'Check if edge was retained from a historical alias.'
      });
    }
    if (tNode?.status === 'retired') {
      retiredNodesReferenced.push({
        status: 'POSSIBLY DEAD',
        urn: tNode.urn,
        name: tNode.name,
        kind: tNode.kind,
        path: tNode.path,
        reason: `Retired node '${tNode.name}' is still referenced as target in edge ${edge.id}`,
        confidence: 'INFERRED',
        caveat: 'Check if edge was retained from a historical alias.'
      });
    }
  }

  // 4. Broken graph relationships (edge pointing to missing node)
  for (const edge of edges) {
    const sExists = graph.hasNode(edge.sourceUrn);
    const tExists = graph.hasNode(edge.targetUrn);
    if (!sExists) {
      brokenRelationships.push({
        status: 'POSSIBLY DEAD',
        urn: edge.sourceUrn,
        name: edge.sourceUrn,
        kind: 'edge_source',
        path: '',
        reason: `Edge ${edge.id} references source URN '${edge.sourceUrn}' which does not exist in graph`,
        confidence: 'INFERRED',
        caveat: 'Run trace update or trace rebuild to reconcile graph edges.'
      });
    }
    if (!tExists) {
      brokenRelationships.push({
        status: 'POSSIBLY DEAD',
        urn: edge.targetUrn,
        name: edge.targetUrn,
        kind: 'edge_target',
        path: '',
        reason: `Edge ${edge.id} references target URN '${edge.targetUrn}' which does not exist in graph`,
        confidence: 'INFERRED',
        caveat: 'Run trace update or trace rebuild to reconcile graph edges.'
      });
    }
  }

  const total =
    possiblyDeadSymbols.length +
    possiblyDeadFiles.length +
    retiredNodesReferenced.length +
    brokenRelationships.length;

  return {
    totalFindings: total,
    possiblyDeadSymbols,
    possiblyDeadFiles,
    retiredNodesReferenced,
    brokenRelationships
  };
}
