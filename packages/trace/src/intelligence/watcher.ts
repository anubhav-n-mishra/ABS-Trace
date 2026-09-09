// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import type { CodebaseIndexer } from '../indexer/indexer.js';
import { loadConfig } from '../core/config.js';

export interface WatcherOptions {
  debounceMs?: number;
  onUpdate?: (updatedCount: number, retiredCount: number, features: string[]) => void;
}

/**
 * Native filesystem watcher for real-time incremental codebase index synchronization.
 */
export class CodebaseWatcher {
  private watcher?: fs.FSWatcher;
  private timer?: NodeJS.Timeout;
  private pendingChanges = new Set<string>();
  private isUpdating = false;

  constructor(
    private repoRoot: string,
    private indexer: CodebaseIndexer,
    private options: WatcherOptions = {}
  ) {}

  start(): void {
    const config = loadConfig(this.repoRoot);
    const ignoredPatterns = [
      '.git',
      '.codebase',
      'node_modules',
      'dist',
      'build',
      '.gemini',
      '.vscode',
      'coverage',
      ...config.ignoredDirectories
    ];

    console.log(pc.bold(pc.cyan(`\nWatching for file changes in: ${this.repoRoot}`)));
    console.log(pc.dim('Press Ctrl+C to stop watching.\n'));

    try {
      this.watcher = fs.watch(
        this.repoRoot,
        { recursive: true },
        (_eventType, filename) => {
          if (!filename) return;

          const normFile = filename.replace(/\\/g, '/');

          // Ignore metadata, hidden temp files, and ignored directories
          if (
            ignoredPatterns.some((p) => normFile.includes(p)) ||
            normFile.endsWith('~') ||
            normFile.endsWith('.swp') ||
            normFile.startsWith('.')
          ) {
            return;
          }

          this.pendingChanges.add(normFile);
          this.scheduleReconciliation();
        }
      );
    } catch (err: any) {
      console.error(pc.red(`Failed to start native filesystem watcher: ${err.message}`));
    }
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
    console.log(pc.dim('\nStopped TRACE watcher.'));
  }

  private scheduleReconciliation(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    const debounceTime = this.options.debounceMs || 500;
    this.timer = setTimeout(() => {
      this.reconcile();
    }, debounceTime);
  }

  private async reconcile(): Promise<void> {
    if (this.isUpdating) {
      this.scheduleReconciliation();
      return;
    }

    const changes = Array.from(this.pendingChanges);
    this.pendingChanges.clear();

    if (changes.length === 0) return;

    this.isUpdating = true;
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${pc.dim(timestamp)}] Detected changes in ${pc.cyan(changes.length)} file(s)...`);

    try {
      const { graph, updatedCount, retiredCount } = await this.indexer.runIncrementalUpdate();

      // Find affected features
      const affectedFeatures = new Set<string>();
      for (const file of changes) {
        for (const node of graph.getActiveNodes()) {
          if (node.path === file) {
            const exp = graph.explain(node.urn);
            for (const r of exp.relatedFeatures) {
              affectedFeatures.add(r.feature.displayName);
            }
          }
        }
      }

      const featureList = Array.from(affectedFeatures);
      console.log(
        `[${pc.dim(timestamp)}] ${pc.green('✔')} Index synchronized (${pc.cyan(updatedCount)} updated, ${pc.yellow(retiredCount)} retired).`
      );

      if (featureList.length > 0) {
        console.log(`  Affected features: ${featureList.map((f) => pc.magenta(f)).join(', ')}`);
      }

      if (this.options.onUpdate) {
        this.options.onUpdate(updatedCount, retiredCount, featureList);
      }
    } catch (err: any) {
      console.error(pc.red(`Incremental update failed during watch: ${err.message}`));
    } finally {
      this.isUpdating = false;
    }
  }
}
