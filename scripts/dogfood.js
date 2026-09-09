#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

console.log('Running dogfood validation: Amvelt TRACE indexing itself...');

const cliBin = path.resolve(process.cwd(), 'packages/trace/bin/trace.js');

if (!fs.existsSync(cliBin)) {
  console.log('CLI not built yet, skipping dogfood check.');
  process.exit(0);
}

try {
  execSync(`node "${cliBin}" init`, { stdio: 'inherit', cwd: process.cwd() });
  execSync(`node "${cliBin}" validate`, { stdio: 'inherit', cwd: process.cwd() });
  console.log('Dogfood self-indexing and validation passed.');
} catch (err) {
  console.error('Dogfood validation failed:', err.message);
  process.exit(1);
}
