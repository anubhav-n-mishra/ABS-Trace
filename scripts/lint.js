#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import fs from 'node:fs';
import path from 'node:path';

console.log('Running Amvelt TRACE repository lint check...');

const FORBIDDEN_PATTERNS = [
  /BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[0-9a-zA-Z]{36}/
];

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.codebase'
]);

let errors = 0;

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile()) {
      // Check for secret extensions
      if (entry.name.startsWith('.env') && entry.name !== '.env.example') {
        console.error(`[ERROR] Secret file found: ${fullPath}`);
        errors++;
      }
      // Check file contents
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(content)) {
            console.error(`[ERROR] Secret pattern matched in: ${fullPath}`);
            errors++;
          }
        }
      } catch {
        // Binary file or non-readable
      }
    }
  }
}

scanDir(process.cwd());

if (errors > 0) {
  console.error(`Lint failed with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log('Lint check passed with zero issues.');
}
