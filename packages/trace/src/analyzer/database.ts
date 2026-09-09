// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import type { ModelNode, ModelField } from '../core/types.js';
import { createModelUrn, normalizeRepoPath } from '../core/urn.js';

export function parsePrismaSchema(content: string, filePath: string): ModelNode[] {
  const normPath = normalizeRepoPath(filePath);
  const lines = content.split('\n');
  const models: ModelNode[] = [];

  let currentModel: { name: string; startLine: number; fields: ModelField[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    const lineNum = i + 1;

    // Check for model declaration: e.g. "model Payment {"
    const modelMatch = line.match(/^model\s+([A-Za-z0-9_]+)\s*\{/);
    if (modelMatch) {
      currentModel = {
        name: modelMatch[1]!,
        startLine: lineNum,
        fields: []
      };
      continue;
    }

    if (currentModel && line.startsWith('}')) {
      models.push({
        urn: createModelUrn(normPath, currentModel.name),
        kind: 'model',
        name: currentModel.name,
        path: normPath,
        status: 'active',
        aliases: [],
        fields: currentModel.fields,
        startLine: currentModel.startLine,
        endLine: lineNum,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      currentModel = null;
      continue;
    }

    if (currentModel && line && !line.startsWith('//') && !line.startsWith('@@')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const fieldName = parts[0]!;
        const fieldType = parts[1]!;
        const isId = line.includes('@id');
        const isRelation = line.includes('@relation');

        currentModel.fields.push({
          name: fieldName,
          type: fieldType,
          isId,
          isRelation
        });
      }
    }
  }

  return models;
}
