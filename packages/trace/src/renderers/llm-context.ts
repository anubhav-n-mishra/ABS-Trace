// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import type { FeatureGraph } from '../core/graph.js';
import { TokenBudgetManager, type BudgetableItem } from '../core/token-estimator.js';
import type { FeatureNode, FeatureView } from '../core/types.js';

export interface LLMContextOptions {
  maxTokens?: number;
}

export function generateLLMContext(
  graph: FeatureGraph,
  targetFeatureOrQuery: string,
  options: LLMContextOptions = {}
): string {
  const maxTokens = options.maxTokens || 4000;
  const manager = new TokenBudgetManager();

  const feat = graph.getFeatureByName(targetFeatureOrQuery);

  if (!feat) {
    // If exact feature name didn't match, return concise summary of all features
    const allFeatures = graph.getFeatures();
    let summary = `# Codebase Feature Map\n\n`;
    summary += `Available features in this repository:\n`;
    for (const f of allFeatures) {
      summary += `- **${f.displayName}** (${f.confidence})\n`;
    }
    summary += `\nTo explore a specific feature, request: \`trace context <feature-name>\`.\n`;
    return manager.enforceTokenLimit(summary, maxTokens);
  }

  const view = graph.getFeatureView(feat.urn);

  // Build prioritized items
  const items: BudgetableItem[] = [];

  // Priority 10: Header & Summary
  items.push({
    id: 'header',
    priority: 10,
    text: `# Feature Context: ${feat.displayName}\n` +
      `Confidence: ${feat.confidence} (${Math.round(feat.confidenceScore * 100)}%)\n` +
      (feat.description ? `Description: ${feat.description}\n\n` : '\n')
  });

  // Priority 9: API Endpoints
  if (view.api.length > 0) {
    let apiText = `## API Endpoints\n`;
    for (const item of view.api) {
      apiText += `- ${item.node.httpMethod} ${item.node.routePath} [${item.node.path}:${item.node.startLine}]\n`;
    }
    items.push({ id: 'api', priority: 9, text: apiText + '\n' });
  }

  // Priority 8: Database Models
  if (view.database.length > 0) {
    let dbText = `## Database Models\n`;
    for (const item of view.database) {
      dbText += `- Model: ${item.node.name} [${item.node.path}:${item.node.startLine}]\n`;
      for (const f of item.node.fields.slice(0, 8)) {
        dbText += `  - ${f.name}: ${f.type}${f.isId ? ' (@id)' : ''}\n`;
      }
    }
    items.push({ id: 'database', priority: 8, text: dbText + '\n' });
  }

  // Priority 7: Services & Core Logic
  if (view.services.length > 0) {
    let svcText = `## Core Services & Functions\n`;
    for (const item of view.services) {
      svcText += `- ${item.node.name} (${item.node.symbolKind}) in ${item.node.path}:${item.node.startLine}-${item.node.endLine}\n`;
      if (item.evidence?.reason) {
        svcText += `  - Evidence: ${item.evidence.reason}\n`;
      }
    }
    items.push({ id: 'services', priority: 7, text: svcText + '\n' });
  }

  // Priority 6: UI Components
  if (view.ui.length > 0) {
    let uiText = `## UI Components\n`;
    for (const item of view.ui) {
      uiText += `- ${item.node.name} in ${item.node.path}:${item.node.startLine}-${item.node.endLine}\n`;
    }
    items.push({ id: 'ui', priority: 6, text: uiText + '\n' });
  }

  // Priority 5: Tests
  if (view.tests.length > 0) {
    let testText = `## Related Tests\n`;
    for (const item of view.tests) {
      testText += `- ${item.node.name} [${item.node.path}:${item.node.startLine}]\n`;
    }
    items.push({ id: 'tests', priority: 5, text: testText + '\n' });
  }

  // Priority 4: Consumers
  if (view.consumers.length > 0) {
    let conText = `## Dependent Consumers\n`;
    for (const c of view.consumers) {
      conText += `- ${c.featureName}\n`;
    }
    items.push({ id: 'consumers', priority: 4, text: conText + '\n' });
  }

  // Pack items within token budget
  const { packed } = manager.packItems(items, maxTokens);
  // Maintain logical reading order (by priority descending)
  const fullText = packed.map((item) => item.text).join('\n');

  // Strict upper bound guarantee
  return manager.enforceTokenLimit(fullText, maxTokens);
}
