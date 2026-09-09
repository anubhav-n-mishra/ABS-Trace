#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import { execSync } from 'node:child_process';
import path from 'node:path';

console.log('Validating npm package tarball hygiene...');

const packages = ['packages/trace', 'packages/amvelt-trace'];

const FORBIDDEN_IN_PACKAGE = [
  /^tests\//,
  /^fixtures\//,
  /^\.github\//,
  /^\.env/,
  /\.log$/,
  /tsconfig/,
  /tsup\.config/
];

let failed = false;

for (const pkg of packages) {
  const fullPkgPath = path.resolve(process.cwd(), pkg);
  console.log(`Inspecting ${pkg}...`);
  try {
    const output = execSync('npm pack --dry-run --json', {
      cwd: fullPkgPath,
      encoding: 'utf8'
    });
    const parsed = JSON.parse(output);
    const files = parsed[0]?.files?.map((f) => f.path) || [];

    for (const file of files) {
      for (const pattern of FORBIDDEN_IN_PACKAGE) {
        if (pattern.test(file)) {
          console.error(`[ERROR] ${pkg} tarball contains forbidden file: ${file}`);
          failed = true;
        }
      }
    }
  } catch (err) {
    console.error(`Failed to inspect package ${pkg}:`, err.message);
    failed = true;
  }
}

if (failed) {
  console.error('Package hygiene check failed.');
  process.exit(1);
} else {
  console.log('Package hygiene check passed cleanly.');
}
