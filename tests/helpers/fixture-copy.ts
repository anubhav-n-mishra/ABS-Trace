// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

export interface TempFixture {
  dir: string;
  cleanup: () => void;
}

/**
 * Creates an isolated temporary directory copy of a fixture directory.
 * Prevents test runs from modifying tracked git repository files.
 */
export function createTempFixture(fixtureRelativePath: string): TempFixture {
  const sourceDir = path.resolve(process.cwd(), fixtureRelativePath);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `trace-fix-${path.basename(fixtureRelativePath)}-`));
  fs.cpSync(sourceDir, tempDir, { recursive: true });

  return {
    dir: tempDir,
    cleanup: () => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 });
      } catch {
        // Ignored on Windows transient file locks
      }
    }
  };
}
