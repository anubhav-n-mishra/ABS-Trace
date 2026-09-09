// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export interface GitWorkingTreeStatus {
  isGitRepo: boolean;
  currentCommit: string;
  modified: string[];
  added: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
}

export function getGitStatus(repoRoot: string): GitWorkingTreeStatus {
  const gitDir = path.join(repoRoot, '.git');
  if (!fs.existsSync(gitDir)) {
    return {
      isGitRepo: false,
      currentCommit: 'non-git',
      modified: [],
      added: [],
      deleted: [],
      renamed: []
    };
  }

  let currentCommit = 'uncommitted';
  try {
    currentCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    currentCommit = 'uncommitted';
  }

  const modified: string[] = [];
  const added: string[] = [];
  const deleted: string[] = [];
  const renamed: Array<{ from: string; to: string }> = [];

  try {
    const rawStatus = execFileSync('git', ['status', '--porcelain', '-z'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });

    const entries = rawStatus.split('\0').filter(Boolean);
    let i = 0;
    while (i < entries.length) {
      const entry = entries[i]!;
      const code = entry.slice(0, 2).trim();
      const filePath = entry.slice(3);

      if (code === 'R' || code.includes('R')) {
        // In porcelain format, rename entry is followed by the new path
        const nextPath = entries[i + 1] || '';
        renamed.push({ from: filePath, to: nextPath });
        i += 2;
        continue;
      } else if (code === 'M' || code.includes('M')) {
        modified.push(filePath);
      } else if (code === '?' || code.includes('A')) {
        added.push(filePath);
      } else if (code === 'D' || code.includes('D')) {
        deleted.push(filePath);
      }
      i++;
    }
  } catch {
    // Non-fatal if git status fails
  }

  return {
    isGitRepo: true,
    currentCommit,
    modified,
    added,
    deleted,
    renamed
  };
}

export function getGitFeatureHistory(repoRoot: string, filePaths: string[]): Array<{ commit: string; date: string; message: string; author: string }> {
  if (filePaths.length === 0) return [];

  try {
    const output = execFileSync(
      'git',
      ['log', '-n', '10', '--pretty=format:%h|%ad|%an|%s', '--date=short', '--', ...filePaths],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }
    );

    return output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [commit, date, author, message] = line.split('|');
        return {
          commit: commit || '',
          date: date || '',
          author: author || '',
          message: message || ''
        };
      });
  } catch {
    return [];
  }
}
