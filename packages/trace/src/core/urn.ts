// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import path from 'node:path';
import type { NodeKind } from './types.js';

export function normalizeRepoPath(filePath: string): string {
  // Convert Windows backslashes to forward slashes and trim leading slashes
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function createSymbolUrn(
  filePath: string,
  symbolName: string,
  enclosingScope?: string
): string {
  const normPath = normalizeRepoPath(filePath);
  const qualName = enclosingScope ? `${enclosingScope}.${symbolName}` : symbolName;
  return `urn:trace:symbol:${normPath}#${qualName}`;
}

export function createRouteUrn(
  filePath: string,
  httpMethod: string,
  routePath: string
): string {
  const normPath = normalizeRepoPath(filePath);
  const cleanRoute = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return `urn:trace:route:${normPath}#${httpMethod.toUpperCase()}:${cleanRoute}`;
}

export function createModelUrn(filePath: string, modelName: string): string {
  const normPath = normalizeRepoPath(filePath);
  return `urn:trace:model:${normPath}#${modelName}`;
}

export function createTestUrn(
  filePath: string,
  testName: string,
  suiteName?: string
): string {
  const normPath = normalizeRepoPath(filePath);
  const qualTest = suiteName ? `${suiteName} > ${testName}` : testName;
  return `urn:trace:test:${normPath}#${qualTest}`;
}

export function createFeatureUrn(featureId: string): string {
  const slug = featureId
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `urn:trace:feature:${slug}`;
}

export function createFileUrn(filePath: string): string {
  const normPath = normalizeRepoPath(filePath);
  return `urn:trace:file:${normPath}`;
}

export interface ParsedUrn {
  urn: string;
  kind: NodeKind;
  path: string;
  identifier: string;
}

export function parseUrn(urn: string): ParsedUrn {
  const match = urn.match(/^urn:trace:([a-z]+):([^#]+)(?:#(.*))?$/);
  if (!match) {
    throw new Error(`Invalid TRACE URN format: "${urn}"`);
  }
  const [, kindStr, filePath, identifier] = match;
  return {
    urn,
    kind: (kindStr || 'file') as NodeKind,
    path: filePath || '',
    identifier: identifier || ''
  };
}
