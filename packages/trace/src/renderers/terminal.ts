// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import pc from 'picocolors';
import type { FeatureView, DriftReport } from '../core/types.js';
import type { ValidationReport } from '../indexer/validator.js';
import type { FeatureGraph } from '../core/graph.js';
import type { SearchResult } from '../detector/semantic-matcher.js';

export function renderFeatureView(view: FeatureView, showEvidence = true): string {
  const feat = view.feature;
  const confColor =
    feat.confidence === 'EXPLICIT'
      ? pc.green
      : feat.confidence === 'DETECTED'
      ? pc.cyan
      : feat.confidence === 'INFERRED'
      ? pc.yellow
      : pc.gray;

  let out = `\n${pc.bold(pc.magenta(feat.displayName.toUpperCase()))} [Confidence: ${confColor(
    `${feat.confidence} (${Math.round(feat.confidenceScore * 100)}%)`
  )}]\n`;

  if (feat.description) {
    out += `${pc.dim(feat.description)}\n`;
  }

  out += `\n${pc.bold('Implementation')}\n`;

  const sections: Array<{ title: string; items: Array<{ loc: string; desc: string; evidence?: string }> }> = [];

  if (view.ui.length > 0) {
    sections.push({
      title: 'UI',
      items: view.ui.map((i) => ({
        loc: `${i.node.path}:${i.node.startLine}-${i.node.endLine}`,
        desc: `${i.node.name} (${i.node.symbolKind})`,
        evidence: i.evidence?.reason
      }))
    });
  }

  if (view.api.length > 0) {
    sections.push({
      title: 'API',
      items: view.api.map((i) => ({
        loc: `${i.node.path}:${i.node.startLine}`,
        desc: `${i.node.httpMethod} ${i.node.routePath}`,
        evidence: i.evidence?.reason
      }))
    });
  }

  if (view.services.length > 0) {
    sections.push({
      title: 'Services',
      items: view.services.map((i) => ({
        loc: `${i.node.path}:${i.node.startLine}-${i.node.endLine}`,
        desc: `${i.node.name} (${i.node.symbolKind})`,
        evidence: i.evidence?.reason
      }))
    });
  }

  if (view.database.length > 0) {
    sections.push({
      title: 'Database',
      items: view.database.map((i) => ({
        loc: `${i.node.path}:${i.node.startLine}`,
        desc: `${i.node.name} model`,
        evidence: i.evidence?.reason
      }))
    });
  }

  if (view.tests.length > 0) {
    sections.push({
      title: 'Tests',
      items: view.tests.map((i) => ({
        loc: `${i.node.path}:${i.node.startLine}`,
        desc: i.node.name,
        evidence: i.evidence?.reason
      }))
    });
  }

  if (sections.length === 0) {
    out += `└── ${pc.dim('(No implementation files connected yet)')}\n`;
  } else {
    sections.forEach((sec, secIdx) => {
      const isLastSec = secIdx === sections.length - 1;
      const secBranch = isLastSec ? '└── ' : '├── ';
      const secPipe = isLastSec ? '    ' : '│   ';

      out += `${secBranch}${pc.bold(sec.title)}\n`;
      sec.items.forEach((item, itemIdx) => {
        const isLastItem = itemIdx === sec.items.length - 1;
        const itemBranch = isLastItem ? '└── ' : '├── ';
        out += `${secPipe}${itemBranch}${pc.cyan(item.loc)} ${pc.white(item.desc)}\n`;
        if (showEvidence && item.evidence) {
          const evPipe = isLastItem ? '    ' : '│   ';
          out += `${secPipe}${evPipe}${pc.dim(`[Evidence: ${item.evidence}]`)}\n`;
        }
      });
    });
  }

  if (view.consumers.length > 0) {
    out += `\n${pc.bold('Consumers')}\n`;
    view.consumers.forEach((c, idx) => {
      const isLast = idx === view.consumers.length - 1;
      const branch = isLast ? '└── ' : '├── ';
      out += `${branch}${pc.yellow(c.featureName)}\n`;
    });
  }

  return out;
}

export function renderDriftStatus(report: DriftReport): string {
  let out = `\n${pc.bold('TRACE STATUS')}\n\n`;

  if (!report.isStale) {
    out += `${pc.green(pc.bold('INDEX: CURRENT'))}\n`;
    out += `${pc.dim('The feature index matches the working tree.')}\n`;
    return out;
  }

  out += `${pc.yellow(pc.bold('INDEX: STALE'))}\n\n`;

  out += `${pc.bold('Working tree:')}\n`;
  if (report.workingTree.modified.length > 0) {
    out += `  ${pc.yellow('Modified:')} ${report.workingTree.modified.length} file(s)\n`;
    report.workingTree.modified.slice(0, 5).forEach((f) => (out += `    - ${f}\n`));
  }
  if (report.workingTree.added.length > 0) {
    out += `  ${pc.green('Added:')} ${report.workingTree.added.length} file(s)\n`;
    report.workingTree.added.slice(0, 5).forEach((f) => (out += `    - ${f}\n`));
  }
  if (report.workingTree.deleted.length > 0) {
    out += `  ${pc.red('Deleted:')} ${report.workingTree.deleted.length} file(s)\n`;
    report.workingTree.deleted.slice(0, 5).forEach((f) => (out += `    - ${f}\n`));
  }
  if (report.workingTree.renamed.length > 0) {
    out += `  ${pc.cyan('Renamed:')} ${report.workingTree.renamed.length} file(s)\n`;
    report.workingTree.renamed.forEach((r) => (out += `    - ${r.from} -> ${r.to}\n`));
  }

  out += `\n${pc.bold('Git:')}\n`;
  out += `  Indexed commit: ${pc.dim(report.git.indexedCommit)}\n`;
  out += `  HEAD commit:    ${pc.dim(report.git.headCommit)}\n`;

  if (report.recommendations.length > 0) {
    out += `\n${pc.bold('Recommended Action:')}\n`;
    report.recommendations.forEach((r) => (out += `  ${pc.cyan(r)}\n`));
  }

  return out;
}

export function renderValidationReport(report: ValidationReport): string {
  let out = `\n${pc.bold('TRACE VALIDATION')}\n\n`;

  if (report.isValid && report.warningCount === 0) {
    out += `${pc.green(pc.bold('PASSED: Index is completely healthy.'))}\n`;
    return out;
  }

  if (!report.isValid) {
    out += `${pc.red(pc.bold(`FAILED: ${report.errorCount} error(s), ${report.warningCount} warning(s).`))}\n\n`;
  } else {
    out += `${pc.yellow(pc.bold(`WARNING: ${report.warningCount} warning(s) found.`))}\n\n`;
  }

  report.issues.forEach((issue, idx) => {
    const color = issue.severity === 'error' ? pc.red : pc.yellow;
    out += `${idx + 1}. [${color(issue.severity.toUpperCase())}] ${issue.message}\n`;
    if (issue.file) out += `   File: ${issue.file}\n`;
    if (issue.urn) out += `   URN:  ${pc.dim(issue.urn)}\n`;
    out += `   ${pc.cyan(`Action: ${issue.suggestedAction}`)}\n\n`;
  });

  return out;
}

export function renderSearchResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return `${pc.dim('No matches found.')}\n`;
  }

  let out = `\n${pc.bold(`Search Results (${results.length})`)}\n\n`;
  results.forEach((r, idx) => {
    const kindBadge = pc.cyan(`[${r.node.kind}]`);
    out += `${idx + 1}. ${kindBadge} ${pc.bold(r.node.name)} (${pc.dim(r.node.path || 'root')})\n`;
    out += `   ${pc.dim(`Match: ${r.matchReason}`)}\n`;
    out += `   URN: ${pc.dim(r.node.urn)}\n\n`;
  });

  return out;
}
