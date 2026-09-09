// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import fs from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';
import type { TraceConfig } from '../core/config.js';
import { normalizeRepoPath } from '../core/urn.js';

export class SecretFilter {
  private ig = ignore();
  private config: TraceConfig;
  private secretPatterns = [
    /^\.env(\..+)?$/,
    /\.pem$/i,
    /\.key$/i,
    /\.pkcs12$/i,
    /\.pfx$/i,
    /id_rsa/i,
    /credentials/i
  ];

  constructor(repoRoot: string, config: TraceConfig) {
    this.config = config;

    // Add configured ignore directories and files
    for (const dir of config.ignoredDirectories) {
      this.ig.add(`${dir}/`);
      this.ig.add(`**/${dir}/**`);
    }
    for (const file of config.ignoredFiles) {
      this.ig.add(file);
    }

    // Load .gitignore if present
    const gitignorePath = path.join(repoRoot, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      try {
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        this.ig.add(gitignoreContent);
      } catch {
        // Ignore read errors
      }
    }
  }

  isIgnored(relativeFilePath: string): boolean {
    const normalized = normalizeRepoPath(relativeFilePath);
    if (!normalized) return true;

    // Check directory name parts
    const parts = normalized.split('/');
    for (const part of parts) {
      if (this.config.ignoredDirectories.includes(part)) {
        return true;
      }
    }

    // Check if filename matches secret patterns
    const fileName = path.basename(normalized);
    for (const pattern of this.secretPatterns) {
      if (pattern.test(fileName)) {
        return true;
      }
    }

    // Check with ignore instance
    try {
      return this.ig.ignores(normalized);
    } catch {
      return false;
    }
  }
}
