// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import type {
  TraceNode,
  GraphEdge,
  FeatureNode,
  SymbolNode,
  RouteNode,
  ModelNode,
  TestNode,
  FeatureView,
  ConfidenceLevel,
  StructuredEvidence
} from './types.js';
import { parseUrn } from './urn.js';

export class FeatureGraph {
  private nodes = new Map<string, TraceNode>();
  private aliases = new Map<string, string>(); // oldUrn -> currentUrn
  private edges = new Map<string, GraphEdge>();
  private outgoing = new Map<string, Set<string>>(); // sourceUrn -> Set<edgeId>
  private incoming = new Map<string, Set<string>>(); // targetUrn -> Set<edgeId>

  // --- Node Operations ---

  addNode(node: TraceNode): void {
    this.nodes.set(node.urn, node);
    if (node.aliases && Array.isArray(node.aliases)) {
      for (const alias of node.aliases) {
        this.aliases.set(alias, node.urn);
      }
    }
  }

  resolveUrn(urn: string): string {
    return this.aliases.get(urn) || urn;
  }

  getNode(urn: string): TraceNode | undefined {
    const resolved = this.resolveUrn(urn);
    return this.nodes.get(resolved);
  }

  hasNode(urn: string): boolean {
    const resolved = this.resolveUrn(urn);
    return this.nodes.has(resolved);
  }

  getAllNodes(): TraceNode[] {
    return Array.from(this.nodes.values());
  }

  getActiveNodes(): TraceNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.status !== 'retired');
  }

  retireNode(urn: string): void {
    const resolved = this.resolveUrn(urn);
    const node = this.nodes.get(resolved);
    if (node) {
      node.status = 'retired';
      node.retiredAt = new Date().toISOString();
      node.updatedAt = new Date().toISOString();

      // Clean up connected edges so no dangling references to retired nodes remain
      const outEdgeIds = Array.from(this.outgoing.get(resolved) || []);
      for (const edgeId of outEdgeIds) {
        this.removeEdge(edgeId);
      }

      const inEdgeIds = Array.from(this.incoming.get(resolved) || []);
      for (const edgeId of inEdgeIds) {
        this.removeEdge(edgeId);
      }
    }
  }

  removeNode(urn: string): void {
    const resolved = this.resolveUrn(urn);
    this.nodes.delete(resolved);

    // Clean up associated edges
    const outEdgeIds = Array.from(this.outgoing.get(resolved) || []);
    for (const edgeId of outEdgeIds) {
      this.removeEdge(edgeId);
    }

    const inEdgeIds = Array.from(this.incoming.get(resolved) || []);
    for (const edgeId of inEdgeIds) {
      this.removeEdge(edgeId);
    }
  }

  removeEdge(id: string): boolean {
    const edge = this.edges.get(id);
    if (!edge) return false;

    const source = this.resolveUrn(edge.sourceUrn);
    const target = this.resolveUrn(edge.targetUrn);

    const outSet = this.outgoing.get(source);
    if (outSet) {
      outSet.delete(id);
      if (outSet.size === 0) this.outgoing.delete(source);
    }

    const inSet = this.incoming.get(target);
    if (inSet) {
      inSet.delete(id);
      if (inSet.size === 0) this.incoming.delete(target);
    }

    this.edges.delete(id);
    return true;
  }

  addAlias(oldUrn: string, newUrn: string): void {
    const resolvedNew = this.resolveUrn(newUrn);
    this.aliases.set(oldUrn, resolvedNew);
    const node = this.nodes.get(resolvedNew);
    if (node && !node.aliases.includes(oldUrn)) {
      node.aliases.push(oldUrn);
      node.updatedAt = new Date().toISOString();
    }
  }

  // --- Edge Operations ---

  addEdge(edge: GraphEdge): void {
    const source = this.resolveUrn(edge.sourceUrn);
    const target = this.resolveUrn(edge.targetUrn);
    const normalizedEdge: GraphEdge = {
      ...edge,
      sourceUrn: source,
      targetUrn: target
    };

    this.edges.set(normalizedEdge.id, normalizedEdge);

    if (!this.outgoing.has(source)) {
      this.outgoing.set(source, new Set());
    }
    this.outgoing.get(source)!.add(normalizedEdge.id);

    if (!this.incoming.has(target)) {
      this.incoming.set(target, new Set());
    }
    this.incoming.get(target)!.add(normalizedEdge.id);
  }

  getEdge(id: string): GraphEdge | undefined {
    return this.edges.get(id);
  }

  getAllEdges(): GraphEdge[] {
    return Array.from(this.edges.values());
  }

  getOutgoingEdges(urn: string): GraphEdge[] {
    const resolved = this.resolveUrn(urn);
    const edgeIds = this.outgoing.get(resolved);
    if (!edgeIds) return [];
    return Array.from(edgeIds)
      .map((id) => this.edges.get(id))
      .filter((e): e is GraphEdge => e !== undefined);
  }

  getIncomingEdges(urn: string): GraphEdge[] {
    const resolved = this.resolveUrn(urn);
    const edgeIds = this.incoming.get(resolved);
    if (!edgeIds) return [];
    return Array.from(edgeIds)
      .map((id) => this.edges.get(id))
      .filter((e): e is GraphEdge => e !== undefined);
  }

  // --- Feature & Domain Queries ---

  getFeatures(): FeatureNode[] {
    return Array.from(this.nodes.values()).filter(
      (n): n is FeatureNode => n.kind === 'feature' && n.status !== 'retired'
    );
  }

  getFeatureByName(name: string): FeatureNode | undefined {
    const lower = name.toLowerCase().trim();
    return this.getFeatures().find(
      (f) =>
        f.name.toLowerCase() === lower ||
        f.displayName.toLowerCase() === lower ||
        f.urn.toLowerCase().endsWith(`:${lower}`)
    );
  }

  getFeatureView(featureUrn: string): FeatureView {
    const resolved = this.resolveUrn(featureUrn);
    const feature = this.nodes.get(resolved);
    if (!feature || feature.kind !== 'feature') {
      throw new Error(`Feature not found for URN: ${featureUrn}`);
    }

    const view: FeatureView = {
      feature: feature as FeatureNode,
      ui: [],
      api: [],
      services: [],
      database: [],
      external: [],
      tests: [],
      consumers: []
    };

    // Find all nodes connected to this feature
    // Edges where feature is target (e.g. symbol implements feature, file belongs_to feature)
    const incoming = this.getIncomingEdges(resolved);
    for (const edge of incoming) {
      const source = this.getNode(edge.sourceUrn);
      if (!source || source.status === 'retired') continue;

      if (source.kind === 'symbol') {
        const sym = source as SymbolNode;
        if (sym.symbolKind === 'component' || sym.path.includes('/components/') || sym.path.endsWith('.tsx') || sym.path.endsWith('.jsx')) {
          view.ui.push({ node: sym, edge, evidence: edge.evidence });
        } else {
          view.services.push({ node: sym, edge, evidence: edge.evidence });
        }
      } else if (source.kind === 'route') {
        view.api.push({ node: source as RouteNode, edge, evidence: edge.evidence });
      } else if (source.kind === 'model') {
        view.database.push({ node: source as ModelNode, edge, evidence: edge.evidence });
      } else if (source.kind === 'test') {
        view.tests.push({ node: source as TestNode, edge, evidence: edge.evidence });
      }
    }

    // Edges where feature is source (e.g. feature consumes another feature/service)
    const outgoing = this.getOutgoingEdges(resolved);
    for (const edge of outgoing) {
      if (edge.relationship === 'consumes') {
        const target = this.getNode(edge.targetUrn);
        if (target && target.kind === 'feature') {
          view.consumers.push({
            featureName: (target as FeatureNode).displayName || target.name,
            consumerUrn: target.urn,
            edge,
            evidence: edge.evidence
          });
        }
      }
    }

    // Consumers: other features that depend on this feature or its services
    for (const item of [...view.services, ...view.api]) {
      const consumersOfItem = this.getIncomingEdges(item.node.urn);
      for (const consumerEdge of consumersOfItem) {
        if (consumerEdge.relationship === 'calls' || consumerEdge.relationship === 'imports') {
          const callerNode = this.getNode(consumerEdge.sourceUrn);
          if (callerNode && callerNode.urn !== resolved) {
            // Find which features this caller belongs to
            const callerFeatures = this.getIncomingEdges(callerNode.urn)
              .filter((e) => e.relationship === 'implements' || e.relationship === 'belongs_to')
              .map((e) => this.getNode(e.targetUrn))
              .filter((n): n is FeatureNode => n?.kind === 'feature');

            for (const f of callerFeatures) {
              if (f.urn !== resolved && !view.consumers.some((c) => c.consumerUrn === f.urn)) {
                view.consumers.push({
                  featureName: f.displayName || f.name,
                  consumerUrn: f.urn,
                  edge: consumerEdge,
                  evidence: consumerEdge.evidence
                });
              }
            }
          }
        }
      }
    }

    return view;
  }

  // --- Impact Analysis ---

  getImpact(targetUrn: string): {
    target: TraceNode;
    directConsumers: TraceNode[];
    indirectConsumers: TraceNode[];
    affectedFeatures: FeatureNode[];
    affectedApis: RouteNode[];
    affectedTests: TestNode[];
  } {
    const resolved = this.resolveUrn(targetUrn);
    const target = this.getNode(resolved);
    if (!target) {
      throw new Error(`Target node not found: ${targetUrn}`);
    }

    const directConsumers = new Set<TraceNode>();
    const indirectConsumers = new Set<TraceNode>();
    const affectedFeatures = new Set<FeatureNode>();
    const affectedApis = new Set<RouteNode>();
    const affectedTests = new Set<TestNode>();

    // BFS Queue to trace upstream consumers
    const visited = new Set<string>([resolved]);
    const queue: Array<{ urn: string; depth: number }> = [{ urn: resolved, depth: 0 }];

    while (queue.length > 0) {
      const { urn, depth } = queue.shift()!;
      const inEdges = this.getIncomingEdges(urn);

      for (const edge of inEdges) {
        const caller = this.getNode(edge.sourceUrn);
        if (!caller || caller.status === 'retired') continue;

        if (caller.kind === 'feature') {
          affectedFeatures.add(caller as FeatureNode);
        } else if (caller.kind === 'route') {
          affectedApis.add(caller as RouteNode);
        } else if (caller.kind === 'test') {
          affectedTests.add(caller as TestNode);
        } else if (depth === 0) {
          directConsumers.add(caller);
        } else {
          indirectConsumers.add(caller);
        }

        if (!visited.has(caller.urn)) {
          visited.add(caller.urn);
          queue.push({ urn: caller.urn, depth: depth + 1 });
        }
      }
    }

    return {
      target,
      directConsumers: Array.from(directConsumers),
      indirectConsumers: Array.from(indirectConsumers),
      affectedFeatures: Array.from(affectedFeatures),
      affectedApis: Array.from(affectedApis),
      affectedTests: Array.from(affectedTests)
    };
  }

  // --- Rationale & Explanation ---

  explain(targetUrn: string): {
    target: TraceNode;
    relatedFeatures: Array<{
      feature: FeatureNode;
      confidence: ConfidenceLevel;
      score: number;
      evidence: StructuredEvidence[];
      edges: GraphEdge[];
    }>;
  } {
    const resolved = this.resolveUrn(targetUrn);
    const target = this.getNode(resolved);
    if (!target) {
      throw new Error(`Node not found for explanation: ${targetUrn}`);
    }

    const featureMap = new Map<
      string,
      {
        feature: FeatureNode;
        confidence: ConfidenceLevel;
        score: number;
        evidence: StructuredEvidence[];
        edges: GraphEdge[];
      }
    >();

    // 1. Direct incoming edges from/to features
    const allEdges = [...this.getIncomingEdges(resolved), ...this.getOutgoingEdges(resolved)];
    for (const edge of allEdges) {
      const otherUrn = edge.sourceUrn === resolved ? edge.targetUrn : edge.sourceUrn;
      const otherNode = this.getNode(otherUrn);
      if (otherNode && otherNode.kind === 'feature') {
        const feat = otherNode as FeatureNode;
        if (!featureMap.has(feat.urn)) {
          featureMap.set(feat.urn, {
            feature: feat,
            confidence: edge.confidence,
            score: edge.confidenceScore,
            evidence: [edge.evidence],
            edges: [edge]
          });
        } else {
          const entry = featureMap.get(feat.urn)!;
          entry.evidence.push(edge.evidence);
          entry.edges.push(edge);
          if (edge.confidenceScore > entry.score) {
            entry.score = edge.confidenceScore;
            entry.confidence = edge.confidence;
          }
        }
      }
    }

    // 2. Traversal through parent file if target is a symbol
    if (target.kind === 'symbol') {
      const fileUrn = `urn:trace:file:${target.path}`;
      const fileEdges = [...this.getIncomingEdges(fileUrn), ...this.getOutgoingEdges(fileUrn)];
      for (const edge of fileEdges) {
        const otherUrn = edge.sourceUrn === fileUrn ? edge.targetUrn : edge.sourceUrn;
        const otherNode = this.getNode(otherUrn);
        if (otherNode && otherNode.kind === 'feature') {
          const feat = otherNode as FeatureNode;
          if (!featureMap.has(feat.urn)) {
            featureMap.set(feat.urn, {
              feature: feat,
              confidence: 'INFERRED',
              score: 0.5,
              evidence: [
                {
                  type: 'directory_cluster',
                  file: target.path,
                  reason: `Enclosing file '${target.path}' is linked to feature '${feat.displayName}'`
                }
              ],
              edges: [edge]
            });
          }
        }
      }
    }

    return {
      target,
      relatedFeatures: Array.from(featureMap.values())
    };
  }

  // --- Reconciliation ---

  reconcileFile(
    filePath: string,
    newNodes: TraceNode[],
    newEdges: GraphEdge[]
  ): { added: TraceNode[]; updated: TraceNode[]; retired: TraceNode[] } {
    const existingFileNodes = Array.from(this.nodes.values()).filter(
      (n) => n.path === filePath && n.kind !== 'feature'
    );

    const newNodeMap = new Map(newNodes.map((n) => [n.urn, n]));
    const existingNodeMap = new Map(existingFileNodes.map((n) => [n.urn, n]));

    const added: TraceNode[] = [];
    const updated: TraceNode[] = [];
    const retired: TraceNode[] = [];

    // Find added or updated nodes
    for (const [urn, newNode] of newNodeMap) {
      if (existingNodeMap.has(urn)) {
        // Node exists: update metadata without breaking historical edges
        const existing = existingNodeMap.get(urn)!;
        Object.assign(existing, newNode, {
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
          status: 'active'
        });
        updated.push(existing);
      } else {
        this.addNode(newNode);
        added.push(newNode);
      }
    }

    // Find obsolete nodes in this file
    for (const [urn, existing] of existingNodeMap) {
      if (!newNodeMap.has(urn)) {
        this.retireNode(urn);
        retired.push(existing);
      }
    }

    // Reconcile edges for this file
    for (const edge of newEdges) {
      this.addEdge(edge);
    }

    return { added, updated, retired };
  }
}
