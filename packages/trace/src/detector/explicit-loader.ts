// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { FeatureNode } from '../core/types.js';
import { createFeatureUrn } from '../core/urn.js';

export interface ExplicitFeatureDefinition {
  feature: string;
  name?: string;
  displayName?: string;
  description?: string;
  tags?: string[];
  components?: string[];
  services?: string[];
  routes?: string[];
  models?: string[];
  tests?: string[];
}

export class ExplicitFeatureLoader {
  private featuresDir: string;

  constructor(repoRoot: string) {
    this.featuresDir = path.join(repoRoot, '.codebase', 'features');
  }

  loadExplicitFeatures(): {
    features: FeatureNode[];
    mappings: Map<string, ExplicitFeatureDefinition>;
  } {
    const features: FeatureNode[] = [];
    const mappings = new Map<string, ExplicitFeatureDefinition>();

    if (!fs.existsSync(this.featuresDir)) {
      return { features, mappings };
    }

    const entries = fs.readdirSync(this.featuresDir);
    for (const entry of entries) {
      const ext = path.extname(entry).toLowerCase();
      if (!['.yaml', '.yml', '.json'].includes(ext)) continue;

      const fullPath = path.join(this.featuresDir, entry);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const parsed = (ext === '.json' ? JSON.parse(content) : YAML.parse(content)) as ExplicitFeatureDefinition;

        if (!parsed || !parsed.feature) continue;

        const featureId = parsed.feature;
        const displayName = parsed.displayName || parsed.name || featureId;
        const urn = createFeatureUrn(featureId);

        const node: FeatureNode = {
          urn,
          kind: 'feature',
          name: featureId,
          displayName,
          description: parsed.description,
          path: '',
          status: 'active',
          aliases: [],
          confidence: 'EXPLICIT',
          confidenceScore: 1.0,
          source: 'explicit',
          tags: parsed.tags || [],
          metadata: {
            explicitFile: entry
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        features.push(node);
        mappings.set(urn, parsed);
      } catch (err: any) {
        console.warn(`[WARN] Failed to load explicit feature definition ${entry}:`, err.message);
      }
    }

    return { features, mappings };
  }
}
