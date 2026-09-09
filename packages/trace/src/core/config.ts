// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import fs from 'node:fs';
import path from 'node:path';

export interface TraceConfig {
  ignoredDirectories: string[];
  ignoredFiles: string[];
  maxFileSize: number;
  defaultTokenBudget: number;
  confidenceScores: {
    explicit: number;
    detected: number;
    inferred: number;
    unknown: number;
  };
}

export const DEFAULT_CONFIG: TraceConfig = {
  ignoredDirectories: [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.codebase',
    '.agents',
    '.next',
    '.turbo',
    'out',
    '.cache'
  ],
  ignoredFiles: [
    'FEATURE_INDEX.md',
    '.env',
    '.env.*',
    '*.pem',
    '*.key',
    '*.cert',
    '*.crt',
    '*.log',
    '*.tmp'
  ],
  maxFileSize: 2 * 1024 * 1024, // 2MB safety limit
  defaultTokenBudget: 4000,
  confidenceScores: {
    explicit: 1.0,
    detected: 0.85,
    inferred: 0.5,
    unknown: 0.1
  }
};

export function loadConfig(repoRoot: string): TraceConfig {
  const possiblePaths = [
    path.join(repoRoot, '.trace.config.json'),
    path.join(repoRoot, '.codebase', 'config.json')
  ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          confidenceScores: {
            ...DEFAULT_CONFIG.confidenceScores,
            ...(parsed.confidenceScores || {})
          }
        };
      } catch (err) {
        console.warn(`[WARN] Failed to parse config at ${configPath}, using defaults.`);
      }
    }
  }

  return { ...DEFAULT_CONFIG };
}
