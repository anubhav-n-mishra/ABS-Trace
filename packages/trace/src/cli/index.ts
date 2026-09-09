// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import path from 'node:path';
import fs from 'node:fs';
import { Command } from 'commander';
import pc from 'picocolors';
import { CodebaseIndexer } from '../indexer/indexer.js';
import { FeatureGraph } from '../core/graph.js';
import { IndexValidator } from '../indexer/validator.js';
import { SemanticMatcher } from '../detector/semantic-matcher.js';
import { getGitFeatureHistory, getGitStatus } from '../git/git-status.js';
import {
  renderFeatureView,
  renderDriftStatus,
  renderValidationReport,
  renderSearchResults,
  renderCyclesReport,
  renderHotspotsReport,
  renderDeadCodeReport,
  renderArchitecturalDiffReport,
  renderTaskMapReport,
  renderTaskPlanReport,
  renderCoverageReports,
  renderRuleCheckReport,
  renderUsageSummary
} from '../renderers/terminal.js';
import { generateLLMContext } from '../renderers/llm-context.js';
import { generateFeatureIndexMarkdown } from '../renderers/markdown.js';
import { startGraphServer } from '../graph-ui/server.js';
import { detectCycles } from '../intelligence/cycles.js';
import { analyzeHotspots } from '../intelligence/hotspots.js';
import { detectDeadCode } from '../intelligence/dead-code.js';
import { computeArchitecturalDiff } from '../intelligence/architectural-diff.js';
import { mapTaskArchitecture, generateTaskPlan } from '../intelligence/task-planner.js';
import { evaluateFeatureCoverage } from '../intelligence/coverage.js';
import { checkArchitectureRules } from '../intelligence/rules.js';
import { LocalUsageLedger } from '../intelligence/telemetry.js';
import { CodebaseWatcher } from '../intelligence/watcher.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('trace')
    .description('Amvelt TRACE — The living codebase map for humans and AI agents')
    .version('0.1.0')
    .option('-r, --root <path>', 'Repository root directory', process.cwd())
    .option('-v, --verbose', 'Show verbose error details and stack traces', false);

  // 1. init
  program
    .command('init')
    .description('Initialize .codebase/ index and map repository features')
    .option('-f, --force', 'Force full re-indexing even if already initialized', false)
    .action(async (_options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      console.log(pc.bold(pc.cyan(`\nInitializing Amvelt TRACE in: ${repoRoot}...`)));
      try {
        const { metadata } = await indexer.runFullIndex();
        console.log(pc.green(pc.bold('Initialization complete!')));
        console.log(`- Files indexed:   ${pc.cyan(metadata.stats.fileCount)}`);
        console.log(`- Features mapped: ${pc.cyan(metadata.stats.featureCount)}`);
        console.log(`- Symbols indexed: ${pc.cyan(metadata.stats.symbolCount)}`);
        console.log(`- Graph nodes:     ${pc.cyan(metadata.stats.nodeCount)}`);
        console.log(`- Graph edges:     ${pc.cyan(metadata.stats.edgeCount)}`);
        console.log(`\nGenerated:\n- ${pc.dim('FEATURE_INDEX.md')}\n- ${pc.dim('.agents/skills/trace/SKILL.md')}`);
        console.log(pc.dim(`\nRun 'trace features' to view detected features.\n`));
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
      }
    });

  // 2. update
  program
    .command('update')
    .description('Incrementally update index with recent file modifications and renames')
    .action(async (_options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      console.log(pc.dim('Updating TRACE index...'));
      try {
        const { metadata, updatedCount, retiredCount } = await indexer.runIncrementalUpdate();
        console.log(pc.green(pc.bold('Index updated!')));
        console.log(`- Reconciled nodes: ${pc.cyan(updatedCount)}`);
        console.log(`- Retired nodes:    ${pc.yellow(retiredCount)}`);
        console.log(`- Active features:  ${pc.cyan(metadata.stats.featureCount)}`);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
      }
    });

  // 3. rebuild
  program
    .command('rebuild')
    .description('Cleanly delete existing index and rebuild from scratch')
    .action(async (_options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      console.log(pc.yellow('Cleaning existing .codebase/ and rebuilding...'));
      indexer.getStore().clean();
      try {
        const { metadata } = await indexer.runFullIndex();
        console.log(pc.green(pc.bold('Index rebuild complete!')));
        console.log(`- Features mapped: ${pc.cyan(metadata.stats.featureCount)}`);
        console.log(`- Symbols indexed: ${pc.cyan(metadata.stats.symbolCount)}`);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
      }
    });

  // 4. status
  program
    .command('status')
    .description('Check if index is current or has drifted from filesystem/git')
    .option('--json', 'Output report as JSON')
    .action(async (options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const status = indexer.checkStatus();
      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(renderDriftStatus(status));
      }
    });

  // 5. features
  program
    .command('features')
    .description('List all mapped features and confidence ratings')
    .option('--json', 'Output features as JSON')
    .action(async (options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      const features = graph.getFeatures();
      if (options.json) {
        console.log(JSON.stringify(features, null, 2));
      } else {
        console.log(pc.bold(`\nMapped Features (${features.length}):\n`));
        for (const feat of features) {
          const confColor =
            feat.confidence === 'EXPLICIT'
              ? pc.green
              : feat.confidence === 'DETECTED'
              ? pc.cyan
              : pc.yellow;
          console.log(
            `- ${pc.bold(feat.displayName)} [${confColor(feat.confidence)} (${Math.round(
              feat.confidenceScore * 100
            )}%)]`
          );
          if (feat.tags?.length) {
            console.log(`  ${pc.dim(`Tags: ${feat.tags.join(', ')}`)}`);
          }
        }
        console.log(pc.dim(`\nView detailed feature map: 'trace feature <name>'\n`));
      }
    });

  // 6. feature <name>
  program
    .command('feature <name>')
    .description('Display complete implementation surface area for a feature')
    .option('--json', 'Output feature details as JSON')
    .option('--no-evidence', 'Hide evidence annotations')
    .action(async (name, options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      const feat = graph.getFeatureByName(name);
      if (!feat) {
        console.error(pc.red(`Feature '${name}' not found. Run 'trace features' to list all features.`));
        process.exit(1);
      }

      const view = graph.getFeatureView(feat.urn);
      if (options.json) {
        console.log(JSON.stringify(view, null, 2));
      } else {
        console.log(renderFeatureView(view, options.evidence !== false));
      }
    });

  // 7. explain <target>
  program
    .command('explain <target>')
    .description('Explain WHY a feature relationship exists, displaying confidence and evidence')
    .option('--json', 'Output explanation as JSON')
    .action(async (target, options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      // Try finding by name or URN
      let targetNode = graph.getActiveNodes().find((n) => n.name === target || n.urn === target);
      if (!targetNode) {
        // Fallback: search for symbol
        const matcher = new SemanticMatcher(graph);
        const searchRes = matcher.search(target, 1);
        if (searchRes.length > 0) {
          targetNode = searchRes[0]?.node;
        }
      }

      if (!targetNode) {
        console.error(pc.red(`Node or symbol '${target}' not found.`));
        process.exit(1);
      }

      const exp = graph.explain(targetNode.urn);

      if (options.json) {
        console.log(JSON.stringify(exp, null, 2));
      } else {
        console.log(`\n${pc.bold('EXPLANATION FOR:')} ${pc.cyan(targetNode.name)} (${targetNode.kind})`);
        console.log(`Path: ${targetNode.path || 'root'}\n`);

        if (exp.relatedFeatures.length === 0) {
          console.log(pc.dim('No direct feature relationships recorded.'));
        } else {
          console.log(pc.bold('Related Features:'));
          for (const rel of exp.relatedFeatures) {
            console.log(`\n  ${pc.magenta(pc.bold(rel.feature.displayName))}`);
            console.log(`  Confidence: ${pc.cyan(`${rel.confidence} (${Math.round(rel.score * 100)}%)`)}`);
            console.log(`  Evidence:`);
            for (const ev of rel.evidence) {
              console.log(`    - ${ev.reason}`);
            }
          }
        }
        console.log();
      }
    });

  // 8. search <query>
  program
    .command('search <query>')
    .description('Semantic and keyword search across features, symbols, and routes')
    .option('--json', 'Output search results as JSON')
    .action(async (query, options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      const matcher = new SemanticMatcher(graph);
      const results = matcher.search(query);

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(renderSearchResults(results));
      }
    });

  // 9. where <concept>
  program
    .command('where <concept>')
    .description('Find where a feature, API, or concept is implemented')
    .option('--json', 'Output matches as JSON')
    .action(async (concept, options, cmd) => {
      // Forward to search with focused limit
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      // First check if exact feature
      const feat = graph.getFeatureByName(concept);
      if (feat) {
        const view = graph.getFeatureView(feat.urn);
        if (options.json) {
          console.log(JSON.stringify(view, null, 2));
        } else {
          console.log(renderFeatureView(view));
        }
        return;
      }

      const matcher = new SemanticMatcher(graph);
      const results = matcher.search(concept, 5);

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(renderSearchResults(results));
      }
    });

  // 10. impact <target>
  program
    .command('impact <target>')
    .description('Compute direct and indirect consumers affected by modifying a symbol or file')
    .option('--json', 'Output impact graph as JSON')
    .action(async (target, options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      let targetNode = graph.getActiveNodes().find((n) => n.name === target || n.urn === target || n.path === target);
      if (!targetNode) {
        const matcher = new SemanticMatcher(graph);
        const searchRes = matcher.search(target, 1);
        if (searchRes.length > 0) {
          targetNode = searchRes[0]?.node;
        }
      }

      if (!targetNode) {
        console.error(pc.red(`Target '${target}' not found.`));
        process.exit(1);
      }

      const impact = graph.getImpact(targetNode.urn);

      if (options.json) {
        console.log(JSON.stringify(impact, null, 2));
      } else {
        console.log(`\n${pc.bold('IMPACT ANALYSIS FOR:')} ${pc.cyan(targetNode.name)} (${targetNode.path || targetNode.urn})\n`);
        console.log(pc.bold('Direct Consumers:'));
        if (impact.directConsumers.length === 0) {
          console.log(`  ${pc.dim('(None)')}`);
        } else {
          impact.directConsumers.forEach((c) => console.log(`  - ${c.name} [${c.path || c.urn}]`));
        }

        console.log(`\n${pc.bold('Indirect Consumers:')}`);
        if (impact.indirectConsumers.length === 0) {
          console.log(`  ${pc.dim('(None)')}`);
        } else {
          impact.indirectConsumers.forEach((c) => console.log(`  - ${c.name} [${c.path || c.urn}]`));
        }

        console.log(`\n${pc.bold('Affected Features:')}`);
        if (impact.affectedFeatures.length === 0) {
          console.log(`  ${pc.dim('(None)')}`);
        } else {
          impact.affectedFeatures.forEach((f) => console.log(`  - ${pc.magenta(f.displayName)}`));
        }

        console.log(`\n${pc.bold('Affected Tests:')}`);
        if (impact.affectedTests.length === 0) {
          console.log(`  ${pc.dim('(None)')}`);
        } else {
          impact.affectedTests.forEach((t) => console.log(`  - ${pc.yellow(t.name)} [${t.path}]`));
        }
        console.log();
      }
    });

  // 11. context <query>
  program
    .command('context <query>')
    .description('Generate token-budgeted markdown context for AI coding agents')
    .option('-t, --tokens <count>', 'Maximum token budget ceiling', '4000')
    .option('--json', 'Output context as JSON')
    .action(async (query, options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      const maxTokens = parseInt(options.tokens, 10) || 4000;
      const contextText = generateLLMContext(graph, query, { maxTokens });

      try {
        const ledger = new LocalUsageLedger(repoRoot);
        ledger.record({
          sessionId: process.env.TRACE_SESSION_ID || 'default',
          command: 'context',
          tokensRequested: maxTokens,
          tokensGenerated: Math.ceil(contextText.length / 3.8),
          tokenType: 'ESTIMATED',
          filesIncluded: (contextText.match(/## File:/g) || []).length,
          symbolsIncluded: (contextText.match(/### /g) || []).length,
          query
        });
      } catch {
        // Non-fatal telemetry recording
      }

      if (options.json) {
        console.log(JSON.stringify({ query, maxTokens, context: contextText }, null, 2));
      } else {
        console.log(contextText);
      }
    });

  // 12. validate
  program
    .command('validate')
    .description('Verify index health (stale line ranges, broken links, orphan nodes)')
    .option('--json', 'Output validation report as JSON')
    .action(async (options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      const validator = new IndexValidator(repoRoot);
      const report = validator.validate(graph);

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(renderValidationReport(report));
      }

      if (!report.isValid) {
        process.exit(1);
      }
    });

  // 13. doctor
  program
    .command('doctor')
    .description('Diagnostic check of repository setup, parsers, and git integration')
    .option('--json', 'Output diagnostics as JSON')
    .action(async (options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const git = getGitStatus(repoRoot);
      const store = new CodebaseIndexer(repoRoot).getStore();

      const diagnostics = {
        repoRoot,
        nodeVersion: process.version,
        isGitRepo: git.isGitRepo,
        currentCommit: git.currentCommit,
        indexInitialized: store.isInitialized(),
        codebaseDir: store.getCodebaseDir(),
        nodeModulesPresent: fs.existsSync(path.join(repoRoot, 'node_modules'))
      };

      if (options.json) {
        console.log(JSON.stringify(diagnostics, null, 2));
      } else {
        console.log(`\n${pc.bold('AMVELT TRACE DOCTOR')}\n`);
        console.log(`- Node.js Version:      ${pc.cyan(diagnostics.nodeVersion)}`);
        console.log(`- Git Integration:      ${diagnostics.isGitRepo ? pc.green('Active') : pc.yellow('Not a git repository')}`);
        console.log(`- Index Initialized:    ${diagnostics.indexInitialized ? pc.green('Yes') : pc.yellow('No (run trace init)')}`);
        console.log(`- Repository Directory: ${pc.dim(diagnostics.repoRoot)}\n`);
      }
    });

  // 14. history <feature>
  program
    .command('history <feature>')
    .description('Show recent Git commits affecting this feature')
    .option('--json', 'Output commit history as JSON')
    .action(async (featureName, options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      const feat = graph.getFeatureByName(featureName);
      if (!feat) {
        console.error(pc.red(`Feature '${featureName}' not found.`));
        process.exit(1);
      }

      const view = graph.getFeatureView(feat.urn);
      const files = Array.from(
        new Set([
          ...view.ui.map((i) => i.node.path),
          ...view.api.map((i) => i.node.path),
          ...view.services.map((i) => i.node.path),
          ...view.database.map((i) => i.node.path),
          ...view.tests.map((i) => i.node.path)
        ])
      );

      const history = getGitFeatureHistory(repoRoot, files);

      if (options.json) {
        console.log(JSON.stringify(history, null, 2));
      } else {
        console.log(`\n${pc.bold(`Git History for ${feat.displayName}:`)}\n`);
        if (history.length === 0) {
          console.log(pc.dim('No recent commits found for this feature.'));
        } else {
          history.forEach((h) => {
            console.log(`- ${pc.yellow(h.commit)} ${pc.dim(h.date)} by ${pc.cyan(h.author)}: ${h.message}`);
          });
        }
        console.log();
      }
    });

  // 15. export
  program
    .command('export')
    .description('Export full graph projection as JSON or Markdown')
    .option('-f, --format <format>', 'Export format: markdown or json', 'markdown')
    .action(async (options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      if (options.format === 'json') {
        const data = {
          nodes: graph.getAllNodes(),
          edges: graph.getAllEdges()
        };
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(generateFeatureIndexMarkdown(graph));
      }
    });

  // 16. graph
  program
    .command('graph')
    .description('Launch local interactive codebase visualizer')
    .option('-p, --port <number>', 'Port for local visualizer server', '4321')
    .option('--no-open', 'Do not automatically open browser')
    .option('--feature <name>', 'Focus graph view on specific feature')
    .option('--symbol <name>', 'Focus graph view on specific symbol')
    .option('--impact <name>', 'Focus graph view on blast radius of symbol')
    .option('--models', 'Show data model nodes by default (default: false)', false)
    .option('--json', 'Export graph visualization payload as JSON instead of starting server')
    .action(async (options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      if (options.json) {
        const payload = {
          nodes: graph.getActiveNodes(),
          edges: graph.getAllEdges(),
          features: graph.getFeatures()
        };
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      try {
        await startGraphServer(repoRoot, graph, {
          port: parseInt(options.port, 10) || 4321,
          openBrowser: options.open !== false,
          focusFeature: options.feature,
          focusSymbol: options.symbol,
          focusImpact: options.impact,
          showModels: Boolean(options.models)
        });
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
      }
    });

  // 17. diff [ref]
  program
    .command('diff [ref]')
    .description('Architectural interpretation of Git diff or working tree changes')
    .option('--json', 'Output diff analysis as JSON')
    .action(async (ref, options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      const report = computeArchitecturalDiff(repoRoot, graph, ref);
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(renderArchitecturalDiffReport(report));
      }
    });

  // 18. review [ref]
  program
    .command('review [ref]')
    .description('Review proposed changes against features, APIs, models, and tests')
    .option('--json', 'Output review report as JSON')
    .action(async (ref, options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      const report = computeArchitecturalDiff(repoRoot, graph, ref);
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(renderArchitecturalDiffReport(report));
      }
    });

  // 19. dead / orphan
  program
    .command('dead')
    .alias('orphan')
    .description('Detect unreferenced symbols, unconsumed files, and orphan graph nodes')
    .option('--json', 'Output findings as JSON')
    .action(async (options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      const report = detectDeadCode(graph);
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(renderDeadCodeReport(report));
      }
    });

  // 20. hotspots
  program
    .command('hotspots')
    .description('Identify highly coupled architectural nodes with documented formulas')
    .option('-n, --top <number>', 'Number of hotspots to display', '10')
    .option('--json', 'Output hotspots as JSON')
    .action(async (options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      const limit = parseInt(options.top, 10) || 10;
      const report = analyzeHotspots(graph, limit);
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(renderHotspotsReport(report));
      }
    });

  // 21. cycles
  program
    .command('cycles')
    .description('Detect circular dependencies at symbol and file levels')
    .option('--json', 'Output cycle chains as JSON')
    .action(async (options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      const report = detectCycles(graph);
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(renderCyclesReport(report));
      }
    });

  // 22. task <query>
  program
    .command('task <query>')
    .description('Map likely architecture, files, and reference patterns for a task')
    .option('--json', 'Output task map as JSON')
    .action(async (query, options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      const result = mapTaskArchitecture(graph, query);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(renderTaskMapReport(result));
      }
    });

  // 23. plan <query>
  program
    .command('plan <query>')
    .description('Generate an evidence-backed implementation plan')
    .option('--json', 'Output plan as JSON')
    .action(async (query, options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      const result = generateTaskPlan(graph, query);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(renderTaskPlanReport(result));
      }
    });

  // 24. coverage [feature]
  program
    .command('coverage [feature]')
    .description('Evaluate feature architectural traceability across 6 core dimensions')
    .option('--json', 'Output coverage as JSON')
    .action(async (feature, options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      const reports = evaluateFeatureCoverage(repoRoot, graph, feature);
      if (options.json) {
        console.log(JSON.stringify(reports, null, 2));
      } else {
        console.log(renderCoverageReports(reports));
      }
    });

  // 25. check
  program
    .command('check')
    .description('Validate architecture rules against codebase map')
    .option('-c, --config <path>', 'Custom rules file path')
    .option('--json', 'Output violations as JSON')
    .action(async (options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);

      const graph = new FeatureGraph();
      try {
        indexer.getStore().loadGraph(graph);
      } catch (err: any) {
        handleError(err, cmd.optsWithGlobals().verbose);
        return;
      }

      const report = checkArchitectureRules(repoRoot, graph, options.config);
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(renderRuleCheckReport(report));
      }

      if (!report.isCompliant) {
        process.exit(1);
      }
    });

  // 26. watch
  program
    .command('watch')
    .description('Watch repository filesystem and incrementally re-index on changes')
    .option('-d, --debounce <ms>', 'Debounce interval in milliseconds', '500')
    .action(async (options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const indexer = new CodebaseIndexer(repoRoot);
      const debounceMs = parseInt(options.debounce, 10) || 500;

      const watcher = new CodebaseWatcher(repoRoot, indexer, { debounceMs });
      watcher.start();

      process.on('SIGINT', () => {
        watcher.stop();
        process.exit(0);
      });
      process.on('SIGTERM', () => {
        watcher.stop();
        process.exit(0);
      });
    });

  // 27. usage
  program
    .command('usage')
    .description('View local token telemetry and agent session usage')
    .option('--session [id]', 'Filter by session ID')
    .option('--today', 'Show usage for today')
    .option('--reset', 'Reset local usage ledger')
    .option('--json', 'Output usage as JSON')
    .action(async (options, cmd) => {
      const repoRoot = path.resolve(cmd.optsWithGlobals().root);
      const ledger = new LocalUsageLedger(repoRoot);

      if (options.reset) {
        ledger.reset();
        console.log(pc.green('Local usage ledger has been reset.'));
        return;
      }

      const summary = ledger.getSummary({
        sessionId: typeof options.session === 'string' ? options.session : undefined,
        today: options.today
      });

      if (options.json) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        console.log(renderUsageSummary(summary));
      }
    });

  return program;
}

function handleError(err: any, verbose = false): void {
  console.error(pc.red(pc.bold(`\nERROR: ${err.message || 'Operation failed.'}`)));
  if (verbose && err.stack) {
    console.error(pc.dim(err.stack));
  }
  process.exit(1);
}

export function runCLI(): void {
  const program = createProgram();
  program.parse(process.argv);
}
