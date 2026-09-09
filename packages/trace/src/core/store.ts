// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import fs from 'node:fs';
import path from 'node:path';
import type { FeatureGraph } from './graph.js';
import type { IndexMetadata, TraceNode, GraphEdge, FeatureNode, SymbolNode } from './types.js';

export const CURRENT_SCHEMA_VERSION = 1;

export class CodebaseStore {
  private codebaseDir: string;

  constructor(repoRoot: string) {
    this.codebaseDir = path.join(repoRoot, '.codebase');
  }

  getCodebaseDir(): string {
    return this.codebaseDir;
  }

  isInitialized(): boolean {
    const metaPath = path.join(this.codebaseDir, 'metadata.json');
    const graphPath = path.join(this.codebaseDir, 'graph.json');
    return fs.existsSync(metaPath) && fs.existsSync(graphPath);
  }

  loadMetadata(): IndexMetadata {
    const metaPath = path.join(this.codebaseDir, 'metadata.json');
    if (!fs.existsSync(metaPath)) {
      throw new Error(`No index metadata found at ${metaPath}. Has 'trace init' been run?`);
    }

    try {
      const raw = fs.readFileSync(metaPath, 'utf8');
      const meta = JSON.parse(raw) as IndexMetadata;

      if (!meta.schemaVersion || meta.schemaVersion !== CURRENT_SCHEMA_VERSION) {
        throw new Error(
          `Incompatible or corrupted index schema (found version ${meta.schemaVersion || 'none'}, expected v${CURRENT_SCHEMA_VERSION}). Run 'trace rebuild' to re-index.`
        );
      }

      return meta;
    } catch (err: any) {
      if (err.message.includes('Incompatible or corrupted')) {
        throw err;
      }
      throw new Error(`Failed to read .codebase metadata: ${err.message}. Run 'trace rebuild'.`);
    }
  }

  saveGraph(graph: FeatureGraph, gitCommit = 'uncommitted'): IndexMetadata {
    if (!fs.existsSync(this.codebaseDir)) {
      fs.mkdirSync(this.codebaseDir, { recursive: true });
    }

    const allNodes = graph.getAllNodes();
    const allEdges = graph.getAllEdges();

    // Deterministic sorting
    const sortedNodes = [...allNodes].sort((a, b) => a.urn.localeCompare(b.urn));
    const sortedEdges = [...allEdges].sort((a, b) => a.id.localeCompare(b.id));

    const features = sortedNodes.filter((n): n is FeatureNode => n.kind === 'feature');
    const symbols = sortedNodes.filter((n): n is SymbolNode => n.kind === 'symbol');
    const uniqueFiles = new Set(sortedNodes.map((n) => n.path).filter(Boolean));

    const metadata: IndexMetadata = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      generator: 'Amvelt TRACE v0.1.0',
      generatedAt: new Date().toISOString(),
      gitCommit,
      stats: {
        nodeCount: sortedNodes.length,
        edgeCount: sortedEdges.length,
        featureCount: features.length,
        symbolCount: symbols.length,
        fileCount: uniqueFiles.size
      }
    };

    // 1. Save metadata.json
    fs.writeFileSync(
      path.join(this.codebaseDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2) + '\n',
      'utf8'
    );

    // 2. Save graph.json
    fs.writeFileSync(
      path.join(this.codebaseDir, 'graph.json'),
      JSON.stringify(
        {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          nodes: sortedNodes,
          edges: sortedEdges
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    // 3. Save features.json
    fs.writeFileSync(
      path.join(this.codebaseDir, 'features.json'),
      JSON.stringify(
        {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          features: features.map((f) => ({
            urn: f.urn,
            name: f.name,
            displayName: f.displayName,
            description: f.description,
            confidence: f.confidence,
            confidenceScore: f.confidenceScore,
            tags: f.tags
          }))
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    // 4. Save symbols.json
    fs.writeFileSync(
      path.join(this.codebaseDir, 'symbols.json'),
      JSON.stringify(
        {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          symbols: symbols.map((s) => ({
            urn: s.urn,
            name: s.name,
            path: s.path,
            symbolKind: s.symbolKind,
            startLine: s.startLine,
            endLine: s.endLine,
            contentHash: s.contentHash,
            status: s.status
          }))
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    return metadata;
  }

  loadGraph(graph: FeatureGraph): IndexMetadata {
    const metadata = this.loadMetadata();
    const graphPath = path.join(this.codebaseDir, 'graph.json');

    if (!fs.existsSync(graphPath)) {
      throw new Error(`Missing graph data at ${graphPath}. Run 'trace rebuild'.`);
    }

    try {
      const raw = fs.readFileSync(graphPath, 'utf8');
      const data = JSON.parse(raw);

      for (const node of data.nodes || []) {
        graph.addNode(node as TraceNode);
      }

      for (const edge of data.edges || []) {
        graph.addEdge(edge as GraphEdge);
      }

      return metadata;
    } catch (err: any) {
      throw new Error(`Failed to load graph data: ${err.message}. Run 'trace rebuild'.`);
    }
  }

  clean(): void {
    if (fs.existsSync(this.codebaseDir)) {
      const generatedFiles = ['graph.json', 'metadata.json', 'symbols.json', 'features.json'];
      for (const file of generatedFiles) {
        const fullPath = path.join(this.codebaseDir, file);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
    }
  }
}
