// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { FeatureGraph } from '../core/graph.js';
import type { FeatureNode, RouteNode, ModelNode, TestNode, SymbolNode } from '../core/types.js';
import { normalizeRepoPath } from '../core/urn.js';

export interface ArchitecturalDiffReport {
  ref: string;
  filesChanged: string[];
  symbolsChanged: SymbolNode[];
  apisChanged: RouteNode[];
  modelsChanged: ModelNode[];
  affectedTests: TestNode[];
  affectedFeatures: FeatureNode[];
  directConsumersCount: number;
  potentialConcerns: string[];
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH';
  riskRationale: string;
  deterministicFacts: {
    files: string[];
    apis: string[];
    models: string[];
  };
  heuristicInferences: {
    features: string[];
    concerns: string[];
  };
}

/**
 * Computes an architectural interpretation of a Git diff against working tree or specific ref.
 */
export function computeArchitecturalDiff(
  repoRoot: string,
  graph: FeatureGraph,
  ref?: string
): ArchitecturalDiffReport {
  let changedFiles: string[] = [];

  try {
    const gitArgs = ref ? ['diff', '--name-only', ref] : ['status', '--porcelain', '-z'];
    const raw = execFileSync('git', gitArgs, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });

    if (ref) {
      changedFiles = raw
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean)
        .map(normalizeRepoPath);
    } else {
      // Porcelain -z format
      const entries = raw.split('\0').filter(Boolean);
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!;
        const filePath = entry.slice(3);
        if (entry.slice(0, 2).includes('R')) {
          const next = entries[i + 1] || '';
          if (next) changedFiles.push(normalizeRepoPath(next));
          i++;
        } else {
          changedFiles.push(normalizeRepoPath(filePath));
        }
      }
    }
  } catch {
    // Non-git fallback: inspect active nodes
    changedFiles = [];
  }

  const allActive = graph.getActiveNodes();
  const fileSet = new Set(changedFiles);

  const symbolsChanged: SymbolNode[] = [];
  const apisChanged: RouteNode[] = [];
  const modelsChanged: ModelNode[] = [];
  const testNodesChanged: TestNode[] = [];

  for (const node of allActive) {
    if (fileSet.has(node.path)) {
      if (node.kind === 'symbol') symbolsChanged.push(node as SymbolNode);
      else if (node.kind === 'route') apisChanged.push(node as RouteNode);
      else if (node.kind === 'model') modelsChanged.push(node as ModelNode);
      else if (node.kind === 'test') testNodesChanged.push(node as TestNode);
    }
  }

  // Trace downstream impact across features and tests
  const affectedFeatureMap = new Map<string, FeatureNode>();
  const affectedTestMap = new Map<string, TestNode>();
  let directConsumersCount = 0;

  for (const sym of symbolsChanged) {
    const impact = graph.getImpact(sym.urn);
    directConsumersCount += impact.directConsumers.length;
    for (const f of impact.affectedFeatures) {
      affectedFeatureMap.set(f.urn, f);
    }
    for (const t of impact.affectedTests) {
      affectedTestMap.set(t.urn, t);
    }

    const exp = graph.explain(sym.urn);
    for (const rel of exp.relatedFeatures) {
      affectedFeatureMap.set(rel.feature.urn, rel.feature);
    }
  }

  for (const api of apisChanged) {
    const impact = graph.getImpact(api.urn);
    for (const f of impact.affectedFeatures) affectedFeatureMap.set(f.urn, f);
    for (const t of impact.affectedTests) affectedTestMap.set(t.urn, t);
  }

  for (const model of modelsChanged) {
    const impact = graph.getImpact(model.urn);
    for (const f of impact.affectedFeatures) affectedFeatureMap.set(f.urn, f);
    for (const t of impact.affectedTests) affectedTestMap.set(t.urn, t);
  }

  // Potential concerns
  const potentialConcerns: string[] = [];
  const modifiedTestFiles = changedFiles.filter(
    (f) => f.includes('.test.') || f.includes('.spec.') || f.startsWith('tests/')
  );

  if (symbolsChanged.length > 0 && modifiedTestFiles.length === 0 && affectedTestMap.size > 0) {
    potentialConcerns.push(
      `Symbols modified (${symbolsChanged.slice(0, 3).map((s) => s.name).join(', ')}) without detected corresponding test change.`
    );
  }

  if (modelsChanged.length > 0) {
    potentialConcerns.push(
      `Database models changed (${modelsChanged.map((m) => m.name).join(', ')}). Verify schema migrations or database synchronization.`
    );
  }

  if (apisChanged.length > 0 && modifiedTestFiles.length === 0) {
    potentialConcerns.push(
      `API routes modified (${apisChanged.map((a) => `${a.httpMethod} ${a.routePath}`).join(', ')}) with no corresponding test modifications.`
    );
  }

  // Risk calculation
  const affectedFeatures = Array.from(affectedFeatureMap.values());
  const affectedTests = Array.from(affectedTestMap.values());

  let riskRating: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  let riskRationale = 'Minimal blast radius and isolated file changes.';

  if (affectedFeatures.length >= 3 || modelsChanged.length > 0 || (apisChanged.length > 0 && affectedTests.length > 5)) {
    riskRating = 'HIGH';
    riskRationale = `Substantial blast radius affecting ${affectedFeatures.length} features, ${modelsChanged.length} models, and ${apisChanged.length} APIs.`;
  } else if (affectedFeatures.length >= 1 || apisChanged.length > 0 || symbolsChanged.length >= 5) {
    riskRating = 'MEDIUM';
    riskRationale = `Moderate blast radius affecting ${affectedFeatures.length} feature(s) and ${apisChanged.length} API(s).`;
  }

  return {
    ref: ref || 'working-tree',
    filesChanged: changedFiles,
    symbolsChanged,
    apisChanged,
    modelsChanged,
    affectedTests,
    affectedFeatures,
    directConsumersCount,
    potentialConcerns,
    riskRating,
    riskRationale,
    deterministicFacts: {
      files: changedFiles,
      apis: apisChanged.map((a) => `${a.httpMethod} ${a.routePath}`),
      models: modelsChanged.map((m) => m.name)
    },
    heuristicInferences: {
      features: affectedFeatures.map((f) => f.displayName),
      concerns: potentialConcerns
    }
  };
}
