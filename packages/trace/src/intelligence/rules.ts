// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { FeatureGraph } from '../core/graph.js';
import { analyzeHotspots } from './hotspots.js';

export interface ArchitectureRule {
  name: string;
  description?: string;
  from?: string;
  cannotImport?: string;
  target?: string;
  requiresTests?: boolean;
  maxCoupling?: number;
}

export interface RuleViolation {
  ruleName: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  file?: string;
  line?: number;
  symbol?: string;
  evidence: string;
}

export interface RuleCheckReport {
  totalRules: number;
  passedRules: number;
  failedRules: number;
  isCompliant: boolean;
  violations: RuleViolation[];
}

function matchGlob(pattern: string, targetPath: string): boolean {
  const normPattern = pattern.replace(/\\/g, '/');
  const normTarget = targetPath.replace(/\\/g, '/');

  // Convert glob to regex
  let regStr = normPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '___GLOBSTAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/___GLOBSTAR___/g, '.*');

  const regex = new RegExp(`^${regStr}$`);
  return regex.test(normTarget);
}

/**
 * Validates deterministic architecture rules against the feature and code graph.
 */
export function checkArchitectureRules(
  repoRoot: string,
  graph: FeatureGraph,
  customRulesPath?: string
): RuleCheckReport {
  const rules = loadRules(repoRoot, customRulesPath);
  const violations: RuleViolation[] = [];

  for (const rule of rules) {
    // 1. cannotImport rule
    if (rule.from && rule.cannotImport) {
      for (const edge of graph.getAllEdges()) {
        if (['imports', 'calls'].includes(edge.relationship)) {
          const sNode = graph.getNode(edge.sourceUrn);
          const tNode = graph.getNode(edge.targetUrn);

          if (sNode?.path && tNode?.path) {
            if (matchGlob(rule.from, sNode.path) && matchGlob(rule.cannotImport, tNode.path)) {
              violations.push({
                ruleName: rule.name,
                severity: 'ERROR',
                message: `Forbidden architectural dependency: '${sNode.path}' imports '${tNode.path}'`,
                file: sNode.path,
                line: edge.evidence.line,
                symbol: sNode.name,
                evidence: edge.evidence.reason
              });
            }
          }
        }
      }
    }

    // 2. requiresTests rule
    if (rule.target && rule.requiresTests) {
      for (const node of graph.getActiveNodes()) {
        if (node.path && matchGlob(rule.target, node.path) && node.kind === 'symbol') {
          const impact = graph.getImpact(node.urn);
          if (impact.affectedTests.length === 0) {
            violations.push({
              ruleName: rule.name,
              severity: 'WARNING',
              message: `Missing test coverage: Symbol '${node.name}' in '${node.path}' has no associated test suites`,
              file: node.path,
              line: (node as any).startLine,
              symbol: node.name,
              evidence: `Target '${rule.target}' requires corresponding test relationships in graph`
            });
          }
        }
      }
    }

    // 3. maxCoupling rule
    if (rule.maxCoupling) {
      const hotspots = analyzeHotspots(graph, 100);
      for (const h of hotspots.hotspots) {
        if (h.couplingScore > rule.maxCoupling) {
          violations.push({
            ruleName: rule.name,
            severity: 'WARNING',
            message: `Coupling threshold exceeded: Node '${h.node.name}' score (${h.couplingScore}) exceeds limit (${rule.maxCoupling})`,
            file: h.node.path,
            symbol: h.node.name,
            evidence: h.formula
          });
        }
      }
    }
  }

  const failedCount = violations.filter((v) => v.severity === 'ERROR').length;
  const passedRules = Math.max(0, rules.length - failedCount);

  return {
    totalRules: rules.length,
    passedRules,
    failedRules: failedCount,
    isCompliant: failedCount === 0,
    violations
  };
}

function loadRules(repoRoot: string, customPath?: string): ArchitectureRule[] {
  const candidatePaths = [
    customPath,
    path.join(repoRoot, '.codebase', 'rules.yaml'),
    path.join(repoRoot, '.codebase', 'rules.json')
  ].filter(Boolean) as string[];

  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        if (filePath.endsWith('.json')) {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : parsed.rules || [];
        } else {
          const parsed = YAML.parse(raw);
          return Array.isArray(parsed) ? parsed : parsed.rules || [];
        }
      } catch {
        // Fallback to defaults
      }
    }
  }

  // Default sanity rules if none defined in repository
  return [
    {
      name: 'ui-cannot-import-database',
      from: 'src/components/**',
      cannotImport: 'prisma/**'
    }
  ];
}
