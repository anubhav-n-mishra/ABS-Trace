// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt

export type NodeStatus = 'active' | 'aliased' | 'retired';

export type NodeKind = 'file' | 'symbol' | 'route' | 'model' | 'test' | 'feature';

export type SymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'variable'
  | 'type'
  | 'method'
  | 'component'
  | 'hook';

export type ConfidenceLevel = 'EXPLICIT' | 'DETECTED' | 'INFERRED' | 'UNKNOWN';

export type ProvenanceSource = 'ast' | 'git' | 'explicit' | 'ai' | 'inferred';

export type RelationshipType =
  | 'implements'
  | 'calls'
  | 'imports'
  | 'exposes_api'
  | 'accesses_model'
  | 'tests'
  | 'consumes'
  | 'belongs_to';

export type EvidenceType =
  | 'ast_import'
  | 'ast_call'
  | 'route_match'
  | 'model_ref'
  | 'directory_cluster'
  | 'explicit_declaration'
  | 'semantic_similarity';

export interface StructuredEvidence {
  type: EvidenceType;
  file?: string;
  line?: number;
  symbol?: string;
  reason: string;
}

export interface BaseNode {
  urn: string;
  kind: NodeKind;
  name: string;
  path: string;
  status: NodeStatus;
  aliases: string[];
  metadata: Record<string, unknown>;
  retiredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SymbolNode extends BaseNode {
  kind: 'symbol';
  symbolKind: SymbolKind;
  startLine: number;
  endLine: number;
  startCol?: number;
  endCol?: number;
  contentHash: string;
  enclosingScope?: string;
  isExported: boolean;
}

export interface RouteNode extends BaseNode {
  kind: 'route';
  httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL' | 'USE';
  routePath: string;
  startLine: number;
  endLine: number;
  handlerSymbol?: string;
}

export interface ModelField {
  name: string;
  type: string;
  isId?: boolean;
  isRelation?: boolean;
}

export interface ModelNode extends BaseNode {
  kind: 'model';
  fields: ModelField[];
  startLine: number;
  endLine: number;
}

export interface TestNode extends BaseNode {
  kind: 'test';
  testType: 'suite' | 'case';
  suiteName?: string;
  testName: string;
  targetSymbol?: string;
  startLine: number;
  endLine: number;
}

export interface FeatureNode extends BaseNode {
  kind: 'feature';
  displayName: string;
  description?: string;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  source: ProvenanceSource;
  tags: string[];
}

export type TraceNode = SymbolNode | RouteNode | ModelNode | TestNode | FeatureNode | BaseNode;

export interface GraphEdge {
  id: string;
  sourceUrn: string;
  targetUrn: string;
  relationship: RelationshipType;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  provenance: {
    source: ProvenanceSource;
    timestamp: string;
    author?: string;
  };
  evidence: StructuredEvidence;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureViewCategoryItem<T extends TraceNode = TraceNode> {
  node: T;
  edge: GraphEdge;
  evidence: StructuredEvidence;
}

export interface FeatureView {
  feature: FeatureNode;
  ui: FeatureViewCategoryItem<SymbolNode>[];
  api: FeatureViewCategoryItem<RouteNode>[];
  services: FeatureViewCategoryItem<SymbolNode>[];
  database: FeatureViewCategoryItem<ModelNode>[];
  external: { name: string; edge: GraphEdge; evidence: StructuredEvidence }[];
  tests: FeatureViewCategoryItem<TestNode>[];
  consumers: { featureName: string; consumerUrn: string; edge: GraphEdge; evidence: StructuredEvidence }[];
}

export interface DriftReport {
  driftScore: number;
  isStale: boolean;
  workingTree: {
    modified: string[];
    added: string[];
    deleted: string[];
    renamed: Array<{ from: string; to: string }>;
  };
  git: {
    indexedCommit: string;
    headCommit: string;
    mismatch: boolean;
  };
  recommendations: string[];
}

export interface TokenBudgetOptions {
  maxTokens: number;
  model?: string;
  priority?: Array<'summary' | 'api' | 'models' | 'symbols' | 'tests' | 'consumers'>;
}

export interface IndexMetadata {
  schemaVersion: number;
  generator: string;
  generatedAt: string;
  gitCommit: string;
  stats: {
    nodeCount: number;
    edgeCount: number;
    featureCount: number;
    symbolCount: number;
    fileCount: number;
  };
}
