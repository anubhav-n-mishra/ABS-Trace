// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import type { StructuralFacts } from '../analyzer/base.js';
import type {
  FeatureNode,
  GraphEdge,
  TraceNode,
  StructuredEvidence,
  ConfidenceLevel
} from '../core/types.js';
import { createFeatureUrn } from '../core/urn.js';
import { ExplicitFeatureLoader, type ExplicitFeatureDefinition } from './explicit-loader.js';

interface InferredFeatureCandidate {
  id: string;
  name: string;
  confidence: ConfidenceLevel;
  score: number;
  tags: string[];
  nodes: Array<{ node: TraceNode; evidence: StructuredEvidence; confidence: ConfidenceLevel; score: number }>;
}

const DOMAIN_KEYWORDS: Record<string, { name: string; tags: string[] }> = {
  // Authentication & Access Control
  auth: { name: 'Authentication', tags: ['security', 'session'] },
  login: { name: 'Authentication', tags: ['security', 'session'] },
  session: { name: 'Authentication', tags: ['security', 'session'] },
  oauth: { name: 'Authentication', tags: ['security', 'oauth'] },
  rbac: { name: 'Access Control', tags: ['security', 'rbac', 'permissions'] },
  permission: { name: 'Access Control', tags: ['security', 'permissions'] },

  // User & Accounts
  user: { name: 'User Management', tags: ['account', 'profile'] },
  profile: { name: 'User Management', tags: ['account', 'profile'] },
  account: { name: 'User Management', tags: ['account'] },

  // Commerce, Orders & Billing
  payment: { name: 'Payments', tags: ['billing', 'checkout'] },
  upi: { name: 'Payments', tags: ['billing', 'upi'] },
  billing: { name: 'Billing & Subscriptions', tags: ['billing', 'finance'] },
  invoice: { name: 'Invoicing', tags: ['billing', 'invoice'] },
  subscription: { name: 'Billing & Subscriptions', tags: ['billing', 'recurring'] },
  checkout: { name: 'Checkout', tags: ['order', 'ecommerce'] },
  order: { name: 'Orders', tags: ['ecommerce', 'order'] },
  cart: { name: 'Shopping Cart', tags: ['ecommerce'] },
  pricing: { name: 'Billing & Subscriptions', tags: ['billing', 'pricing'] },

  // Discovery & Navigation
  search: { name: 'Search', tags: ['discovery'] },
  catalog: { name: 'Catalog', tags: ['inventory', 'discovery'] },

  // Notifications & Integrations
  notification: { name: 'Notifications', tags: ['alerts', 'email'] },
  email: { name: 'Notifications', tags: ['communication', 'email'] },
  webhook: { name: 'Integrations & Webhooks', tags: ['integrations', 'webhooks'] },
  integration: { name: 'Integrations & Webhooks', tags: ['integrations', 'api'] },

  // AI & Machine Learning
  ai: { name: 'AI & Intelligence', tags: ['ai', 'llm'] },
  llm: { name: 'AI & Intelligence', tags: ['ai', 'llm'] },
  chat: { name: 'AI & Intelligence', tags: ['ai', 'messaging'] },
  agent: { name: 'AI & Intelligence', tags: ['ai', 'agents'] },

  // Analytics, Telemetry & Monitoring
  analytics: { name: 'Analytics & Reporting', tags: ['telemetry', 'analytics'] },
  telemetry: { name: 'Analytics & Reporting', tags: ['telemetry', 'metrics'] },
  report: { name: 'Analytics & Reporting', tags: ['reporting', 'bi'] },
  metric: { name: 'Analytics & Reporting', tags: ['telemetry', 'monitoring'] },

  // Storage & Media
  storage: { name: 'Storage & Media', tags: ['files', 'storage'] },
  upload: { name: 'Storage & Media', tags: ['files', 'upload'] },
  media: { name: 'Storage & Media', tags: ['files', 'media'] },

  // Tools & Utilities
  tool: { name: 'Tools & Utilities', tags: ['tools', 'utilities'] },
  calculator: { name: 'Tools & Utilities', tags: ['tools', 'calculator'] },

  // Settings & Configuration
  settings: { name: 'Settings & Config', tags: ['preferences', 'config'] },
  config: { name: 'Settings & Config', tags: ['preferences', 'config'] }
};

/** Splits an identifier or sentence into lowercase words across camelCase,
 * PascalCase, snake_case, kebab-case and path separators. */
export function splitWords(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .flatMap((part) => part.split(/(?<=[A-Za-z])(?=[0-9])/))
    .map((w) => w.toLowerCase())
    .filter(Boolean);
}

/** Treats a trailing plural 's' as equivalent ('payments' matches 'payment'). */
function wordEquals(word: string, keyword: string): boolean {
  return word === keyword || (word.endsWith('s') && word.slice(0, -1) === keyword);
}

/**
 * Scores how strongly a keyword describes a symbol, using word boundaries
 * rather than raw substrings. Without this, 'auth' matches 'authorize' and
 * 'ai' matches 'email'/'available', which silently misfiles whole domains.
 * An exact domain word in the file path outranks a fuzzy prefix in the symbol
 * name, so paymentsService.js#authorizeCharge lands in Payments, not Auth.
 */
const MIN_PREFIX_KEYWORD_LENGTH = 4;

function scoreKeyword(
  keyword: string,
  symbolWords: string[],
  pathWords: string[]
): { score: number; fromPath: boolean } {
  if (symbolWords.some((w) => wordEquals(w, keyword))) {
    return { score: 100 + keyword.length, fromPath: false };
  }
  if (pathWords.some((w) => wordEquals(w, keyword))) {
    return { score: 80 + keyword.length, fromPath: true };
  }
  if (keyword.length >= MIN_PREFIX_KEYWORD_LENGTH) {
    if (symbolWords.some((w) => w.startsWith(keyword))) {
      return { score: 40 + keyword.length, fromPath: false };
    }
    if (pathWords.some((w) => w.startsWith(keyword))) {
      return { score: 30 + keyword.length, fromPath: true };
    }
  }
  return { score: 0, fromPath: false };
}

/** Picks the single best-matching domain keyword, or null if none apply. */
export function bestKeywordMatch(
  symbolWords: string[],
  pathWords: string[]
): { keyword: string; meta: { name: string; tags: string[] }; fromPath: boolean } | null {
  let best: {
    keyword: string;
    meta: { name: string; tags: string[] };
    score: number;
    fromPath: boolean;
  } | null = null;
  for (const [keyword, meta] of Object.entries(DOMAIN_KEYWORDS)) {
    const { score, fromPath } = scoreKeyword(keyword, symbolWords, pathWords);
    if (score === 0) continue;
    if (!best || score > best.score) best = { keyword, meta, score, fromPath };
  }
  return best;
}

export class FeatureDetector {
  private explicitLoader: ExplicitFeatureLoader;

  constructor(repoRoot: string) {
    this.explicitLoader = new ExplicitFeatureLoader(repoRoot);
  }

  detectFeatures(factsList: StructuralFacts[]): {
    features: FeatureNode[];
    edges: GraphEdge[];
  } {
    const candidates = new Map<string, InferredFeatureCandidate>();

    function getOrCreateCandidate(id: string, name: string, tags: string[] = []): InferredFeatureCandidate {
      const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
      if (!candidates.has(slug)) {
        candidates.set(slug, {
          id: slug,
          name,
          confidence: 'DETECTED',
          score: 0.85,
          tags: [...tags],
          nodes: []
        });
      } else {
        const existing = candidates.get(slug)!;
        for (const tag of tags) {
          if (!existing.tags.includes(tag)) existing.tags.push(tag);
        }
      }
      return candidates.get(slug)!;
    }

    // 1. Process routes with domain sanitization
    for (const facts of factsList) {
      for (const route of facts.routes) {
        // e.g. /api/payment/upi -> domain 'payment'
        const routeParts = route.routePath
          .split('/')
          .filter(Boolean)
          .filter((p) => !p.startsWith('(') && !p.endsWith(')')); // Filter Next.js route groups like (marketing)

        let domain = '';
        for (const part of routeParts) {
          if (['api', 'v1', 'v2', 'v3', 'app', 'routes'].includes(part.toLowerCase())) continue;
          // Skip dynamic bracket parameters: [slug], [id], [...rest]
          if (part.startsWith('[') && part.endsWith(']')) continue;
          // Strip extension (e.g. key.txt, rss.xml, sitemap.xml)
          const cleanPart = part.replace(/\.[a-zA-Z0-9]+$/, '');
          if (['rss', 'sitemap', 'robots', 'favicon', 'og', 'manifest'].includes(cleanPart.toLowerCase())) {
            continue;
          }
          if (cleanPart) {
            domain = cleanPart;
            break;
          }
        }

        if (domain) {
          const match = DOMAIN_KEYWORDS[domain.toLowerCase()];
          const featureName = match ? match.name : domain.charAt(0).toUpperCase() + domain.slice(1).replace(/[-_]/g, ' ');
          const tags = match ? match.tags : [domain];
          const cand = getOrCreateCandidate(domain, featureName, tags);

          cand.nodes.push({
            node: route,
            confidence: 'DETECTED',
            score: 0.85,
            evidence: {
              type: 'route_match',
              file: route.path,
              line: route.startLine,
              reason: `Route path '${route.routePath}' matches domain '${domain}'`
            }
          });
        }
      }

      // 2. Process models
      for (const model of facts.models) {
        const lowerName = model.name.toLowerCase();
        for (const [kw, meta] of Object.entries(DOMAIN_KEYWORDS)) {
          if (lowerName.includes(kw)) {
            const cand = getOrCreateCandidate(kw, meta.name, meta.tags);
            cand.nodes.push({
              node: model,
              confidence: 'DETECTED',
              score: 0.85,
              evidence: {
                type: 'model_ref',
                file: model.path,
                line: model.startLine,
                reason: `Database model '${model.name}' relates to '${meta.name}' domain`
              }
            });
            break;
          }
        }
      }

      // 3. Process symbols and file paths
      for (const symbol of facts.symbols) {
        const lowerPath = symbol.path.toLowerCase();
        const lowerSym = symbol.name.toLowerCase();

        // 3a. Structural directory feature detection: src/features/<feat>/ or src/modules/<feat>/
        const structMatch = symbol.path.match(/(?:^|\/)(?:features|modules)\/([a-zA-Z0-9_-]+)(?:\/|$)/i);
        if (structMatch && structMatch[1]) {
          const rawFeat = structMatch[1];
          const featMatch = DOMAIN_KEYWORDS[rawFeat.toLowerCase()];
          const featureName = featMatch
            ? featMatch.name
            : rawFeat.charAt(0).toUpperCase() + rawFeat.slice(1).replace(/[-_]/g, ' ');
          const tags = featMatch ? featMatch.tags : [rawFeat];
          const cand = getOrCreateCandidate(rawFeat, featureName, tags);
          cand.nodes.push({
            node: symbol,
            confidence: 'DETECTED',
            score: 0.9,
            evidence: {
              type: 'directory_cluster',
              file: symbol.path,
              line: symbol.startLine,
              symbol: symbol.name,
              reason: `File path '${symbol.path}' clusters in '${rawFeat}' feature directory`
            }
          });
          continue;
        }

        // 3b. Match path components and symbol names with DOMAIN_KEYWORDS
        const match = bestKeywordMatch(splitWords(symbol.name), splitWords(symbol.path));
        if (match) {
          const cand = getOrCreateCandidate(match.keyword, match.meta.name, match.meta.tags);
          cand.nodes.push({
            node: symbol,
            confidence: match.fromPath ? 'DETECTED' : 'INFERRED',
            score: match.fromPath ? 0.85 : 0.6,
            evidence: {
              type: match.fromPath ? 'directory_cluster' : 'semantic_similarity',
              file: symbol.path,
              line: symbol.startLine,
              symbol: symbol.name,
              reason: match.fromPath
                ? `File path '${symbol.path}' clusters in '${match.keyword}' directory`
                : `Symbol '${symbol.name}' matches '${match.keyword}' domain vocabulary`
            }
          });
        }
      }

      // 4. Process tests
      for (const test of facts.tests) {
        const testMatch = bestKeywordMatch(splitWords(test.name), splitWords(test.path));
        if (testMatch) {
          const cand = getOrCreateCandidate(testMatch.keyword, testMatch.meta.name, testMatch.meta.tags);
          cand.nodes.push({
            node: test,
            confidence: 'DETECTED',
            score: 0.8,
            evidence: {
              type: 'ast_call',
              file: test.path,
              line: test.startLine,
              reason: `Test suite/case '${test.name}' targets '${testMatch.meta.name}' functionality`
            }
          });
        }
      }
    }

    // 5. Load explicit feature definitions
    const { features: explicitFeatures, mappings } = this.explicitLoader.loadExplicitFeatures();
    const finalFeatures: FeatureNode[] = [...explicitFeatures];
    const edges: GraphEdge[] = [];
    let edgeIndex = 1;

    // Apply explicit mappings
    for (const [featUrn, def] of mappings) {
      const explicitFeat = finalFeatures.find((f) => f.urn === featUrn);
      if (!explicitFeat) continue;

      for (const facts of factsList) {
        for (const sym of facts.symbols) {
          if (
            (def.components && def.components.includes(sym.name)) ||
            (def.services && def.services.includes(sym.name))
          ) {
            edges.push({
              id: `edge-exp-${edgeIndex++}`,
              sourceUrn: sym.urn,
              targetUrn: featUrn,
              relationship: 'implements',
              confidence: 'EXPLICIT',
              confidenceScore: 1.0,
              provenance: { source: 'explicit', timestamp: new Date().toISOString() },
              evidence: {
                type: 'explicit_declaration',
                file: sym.path,
                line: sym.startLine,
                symbol: sym.name,
                reason: `Explicitly assigned in feature definition '${def.feature}'`
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
    }

    // Add candidates that aren't already explicitly declared
    for (const cand of candidates.values()) {
      const urn = createFeatureUrn(cand.id);
      let featureNode = finalFeatures.find((f) => f.urn === urn);

      if (!featureNode) {
        featureNode = {
          urn,
          kind: 'feature',
          name: cand.id,
          displayName: cand.name,
          path: '',
          status: 'active',
          aliases: [],
          confidence: cand.confidence,
          confidenceScore: cand.score,
          source: 'ast',
          tags: cand.tags,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        finalFeatures.push(featureNode);
      }

      for (const item of cand.nodes) {
        // Prevent duplicate edges
        if (!edges.some((e) => e.sourceUrn === item.node.urn && e.targetUrn === urn)) {
          edges.push({
            id: `edge-auto-${edgeIndex++}`,
            sourceUrn: item.node.urn,
            targetUrn: urn,
            relationship: 'implements',
            confidence: item.confidence,
            confidenceScore: item.score,
            provenance: { source: 'ast', timestamp: new Date().toISOString() },
            evidence: item.evidence,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    return {
      features: finalFeatures,
      edges
    };
  }
}
