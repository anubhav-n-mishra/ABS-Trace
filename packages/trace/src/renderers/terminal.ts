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

export function renderCyclesReport(report: import('../intelligence/cycles.js').CycleReport): string {
  let out = `\n${pc.bold('DEPENDENCY CYCLE ANALYSIS')}\n\n`;
  if (!report.hasCycles) {
    out += `${pc.green(pc.bold('✔ No dependency cycles detected.'))}\n`;
    out += `${pc.dim('Codebase graph is completely acyclic.')}\n`;
    return out;
  }

  out += `${pc.red(pc.bold(`Found ${report.cycleCount} dependency cycle(s):`))}\n\n`;
  report.cycles.forEach((c, idx) => {
    out += `${idx + 1}. [${pc.yellow(c.level.toUpperCase())}] ${pc.bold(c.chain.join(' → '))}\n`;
    c.nodes.forEach((n) => {
      out += `   - ${n.name} ${pc.dim(`(${n.path || n.urn})`)}\n`;
    });
    out += '\n';
  });

  return out;
}

export function renderHotspotsReport(report: import('../intelligence/hotspots.js').HotspotsReport): string {
  let out = `\n${pc.bold('ARCHITECTURAL COUPLING HOTSPOTS')}\n\n`;
  out += `Formula: ${pc.dim('Score = (2*in) + (1*out) + (3*features) + (2*consumers) + (2*apis)')}\n`;
  out += `Analyzed: ${report.totalAnalyzed} nodes (${pc.red(`${report.highRiskCount} HIGH`)}, ${pc.yellow(`${report.mediumRiskCount} MEDIUM`)}, ${pc.green(`${report.lowRiskCount} LOW`)})\n\n`;

  report.hotspots.forEach((h, idx) => {
    const color = h.couplingRating === 'HIGH' ? pc.red : h.couplingRating === 'MEDIUM' ? pc.yellow : pc.green;
    out += `${idx + 1}. ${pc.bold(h.node.name)} [${color(h.couplingRating)}] ${pc.dim(`(${h.node.path || 'root'})`)}\n`;
    out += `   Coupling Score: ${pc.cyan(h.couplingScore)} | In: ${h.incomingEdges} | Out: ${h.outgoingEdges} | Features: ${h.featureCount} | Consumers: ${h.consumerCount} | Tests: ${h.testCount}\n\n`;
  });

  return out;
}

export function renderDeadCodeReport(report: import('../intelligence/dead-code.js').DeadCodeReport): string {
  let out = `\n${pc.bold('DEAD & ORPHAN CODE DETECTION')}\n\n`;
  out += `${pc.dim('Note: Findings are marked POSSIBLY DEAD because static analysis cannot verify dynamic dispatch.')}\n\n`;

  if (report.totalFindings === 0) {
    out += `${pc.green(pc.bold('✔ No unreferenced symbols or orphan nodes detected.'))}\n`;
    return out;
  }

  out += `${pc.yellow(pc.bold(`Total Findings: ${report.totalFindings}`))}\n\n`;

  if (report.possiblyDeadSymbols.length > 0) {
    out += `${pc.bold(`Unreferenced Symbols (${report.possiblyDeadSymbols.length}):`)}\n`;
    report.possiblyDeadSymbols.slice(0, 10).forEach((s) => {
      out += `  - [${pc.yellow(s.status)}] ${pc.bold(s.name)} in ${pc.dim(s.path)}\n`;
      out += `    ${pc.dim(s.reason)}\n`;
    });
    out += '\n';
  }

  if (report.possiblyDeadFiles.length > 0) {
    out += `${pc.bold(`Unconsumed Files (${report.possiblyDeadFiles.length}):`)}\n`;
    report.possiblyDeadFiles.slice(0, 10).forEach((f) => {
      out += `  - [${pc.yellow(f.status)}] ${pc.bold(f.name)}\n`;
      out += `    ${pc.dim(f.reason)}\n`;
    });
    out += '\n';
  }

  if (report.retiredNodesReferenced.length > 0) {
    out += `${pc.bold(`Retired Nodes Still Referenced (${report.retiredNodesReferenced.length}):`)}\n`;
    report.retiredNodesReferenced.forEach((r) => {
      out += `  - [${pc.red(r.status)}] ${r.name} (${r.path})\n`;
      out += `    ${pc.dim(r.reason)}\n`;
    });
    out += '\n';
  }

  if (report.brokenRelationships.length > 0) {
    out += `${pc.bold(`Broken Relationships (${report.brokenRelationships.length}):`)}\n`;
    report.brokenRelationships.forEach((b) => {
      out += `  - [${pc.red(b.status)}] ${b.name}\n`;
      out += `    ${pc.dim(b.reason)}\n`;
    });
    out += '\n';
  }

  return out;
}

export function renderArchitecturalDiffReport(report: import('../intelligence/architectural-diff.js').ArchitecturalDiffReport): string {
  let out = `\n${pc.bold('TRACE ARCHITECTURAL DIFF')}\n\n`;

  const riskColor = report.riskRating === 'HIGH' ? pc.red : report.riskRating === 'MEDIUM' ? pc.yellow : pc.green;
  out += `Target Ref:     ${pc.cyan(report.ref)}\n`;
  out += `Potential Risk: [${riskColor(report.riskRating)}] ${pc.dim(`- ${report.riskRationale}`)}\n\n`;

  out += `${pc.bold('Changed Files & Symbols:')}\n`;
  out += `  Files modified:   ${pc.cyan(report.filesChanged.length)}\n`;
  out += `  Symbols modified: ${pc.cyan(report.symbolsChanged.length)}\n`;
  report.symbolsChanged.slice(0, 6).forEach((s) => {
    out += `    - ${s.name} ${pc.dim(`(${s.path}:${s.startLine})`)}\n`;
  });

  if (report.affectedFeatures.length > 0) {
    out += `\n${pc.bold('Affected Features:')}\n`;
    report.affectedFeatures.forEach((f) => {
      out += `  - ${pc.magenta(f.displayName)}\n`;
    });
  }

  if (report.apisChanged.length > 0) {
    out += `\n${pc.bold('Changed APIs:')}\n`;
    report.apisChanged.forEach((a) => {
      out += `  - ${pc.green(a.httpMethod)} ${a.routePath} ${pc.dim(`(${a.path})`)}\n`;
    });
  }

  if (report.modelsChanged.length > 0) {
    out += `\n${pc.bold('Changed Models:')}\n`;
    report.modelsChanged.forEach((m) => {
      out += `  - ${pc.cyan(m.name)} model ${pc.dim(`(${m.path})`)}\n`;
    });
  }

  out += `\n${pc.bold('Tests Impacted:')}\n`;
  if (report.affectedTests.length === 0) {
    out += `  ${pc.dim('(None)')}\n`;
  } else {
    out += `  ${report.affectedTests.length} related test(s)\n`;
    report.affectedTests.slice(0, 5).forEach((t) => {
      out += `    - ${t.name} ${pc.dim(`(${t.path})`)}\n`;
    });
  }

  if (report.potentialConcerns.length > 0) {
    out += `\n${pc.bold('Potential Concerns:')}\n`;
    report.potentialConcerns.forEach((c) => {
      out += `  ${pc.yellow('⚠')} ${c}\n`;
    });
  }

  out += '\n';
  return out;
}

export function renderTaskMapReport(result: import('../intelligence/task-planner.js').TaskMapResult): string {
  let out = `\n${pc.bold('TRACE TASK MAP')}\n\n`;
  out += `Task: ${pc.cyan(`"${result.query}"`)}\n\n`;

  if (result.primaryFeature) {
    out += `${pc.bold('Matched Feature:')}\n`;
    out += `  ${pc.magenta(pc.bold(result.primaryFeature.displayName))} [${pc.cyan(result.primaryFeature.confidence)}]\n\n`;
  }

  out += `${pc.bold('Likely Implementation Files:')}\n`;
  result.likelyFiles.forEach((f) => {
    out += `  - [${pc.cyan(f.role)}] ${f.path}\n`;
    out += `    ${pc.dim(f.reason)}\n`;
  });

  if (result.existingPatterns.length > 0) {
    out += `\n${pc.bold('Existing Architectural Patterns:')}\n`;
    result.existingPatterns.forEach((p) => {
      out += `  - ${pc.bold(p.name)} in ${pc.dim(p.path)}\n`;
      out += `    ${pc.dim(p.description)}\n`;
    });
  }

  if (result.relevantTests.length > 0) {
    out += `\n${pc.bold('Relevant Tests:')}\n`;
    result.relevantTests.forEach((t) => {
      out += `  - ${t.name} ${pc.dim(`(${t.path})`)}\n`;
    });
  }

  out += `\n${pc.bold('Suggested Implementation Surface:')}\n`;
  out += `  ${result.suggestedSurface.map((s) => pc.green(s)).join(' → ')}\n\n`;

  return out;
}

export function renderTaskPlanReport(result: import('../intelligence/task-planner.js').TaskPlanResult): string {
  let out = `\n${pc.bold('TRACE TASK PLAN')}\n\n`;
  out += `Task: ${pc.cyan(`"${result.query}"`)}\n`;
  out += `Context: ${pc.dim(result.currentArchitecture)}\n\n`;

  out += `${pc.bold('Suggested Implementation Order:')}\n\n`;
  result.suggestedOrder.forEach((p) => {
    const catColor =
      p.category === 'DETERMINISTIC'
        ? pc.green
        : p.category === 'DETECTED'
        ? pc.cyan
        : p.category === 'INFERRED'
        ? pc.yellow
        : pc.magenta;

    out += `${p.phase}. ${pc.bold(p.title)} [${catColor(p.category)}]\n`;
    p.actions.forEach((a) => (out += `   • ${a}\n`));
    if (p.targets.length > 0) {
      out += `   Targets: ${p.targets.map((t) => pc.dim(`${t.name} (${t.path})`)).join(', ')}\n`;
    }
    out += '\n';
  });

  if (result.potentialRisks.length > 0) {
    out += `${pc.bold('Potential Architectural Risks:')}\n`;
    result.potentialRisks.forEach((r) => {
      out += `  ${pc.yellow('⚠')} ${r}\n`;
    });
    out += '\n';
  }

  return out;
}

export function renderCoverageReports(reports: import('../intelligence/coverage.js').FeatureCoverageReport[]): string {
  let out = `\n${pc.bold('FEATURE TRACEABILITY COVERAGE')}\n\n`;

  reports.forEach((r) => {
    out += `${pc.bold(pc.magenta(r.feature.displayName.toUpperCase()))} [Completeness: ${pc.cyan(`${r.completenessScore}%`)}]\n`;
    r.dimensions.forEach((d) => {
      const symColor = d.status === 'COMPLETE' ? pc.green : d.status === 'PARTIAL' ? pc.yellow : pc.red;
      out += `  ${d.dimension.padEnd(16)} ${symColor(d.symbol)}  ${pc.dim(d.details)}\n`;
    });
    out += '\n';
  });

  return out;
}

export function renderRuleCheckReport(report: import('../intelligence/rules.js').RuleCheckReport): string {
  let out = `\n${pc.bold('ARCHITECTURE RULES VALIDATION')}\n\n`;

  if (report.isCompliant) {
    if (report.violations.length === 0) {
      out += `${pc.green(pc.bold('PASSED: All architecture rules satisfied.'))}\n`;
      out += `${pc.dim(`${report.passedRules}/${report.totalRules} rule(s) checked with zero violations.`)}\n`;
      return out;
    } else {
      out += `${pc.yellow(pc.bold(`PASSED WITH WARNINGS: ${report.violations.length} architectural warning(s) detected.`))}\n\n`;
    }
  } else {
    out += `${pc.red(pc.bold(`FAILED: ${report.failedRules} rule violation(s) detected.`))}\n\n`;
  }

  report.violations.forEach((v, idx) => {
    const sevColor = v.severity === 'ERROR' ? pc.red : pc.yellow;
    out += `${idx + 1}. [${sevColor(v.severity)}] ${pc.bold(v.ruleName)}\n`;
    out += `   ${v.message}\n`;
    if (v.file) out += `   File:     ${v.file}${v.line ? `:${v.line}` : ''}\n`;
    out += `   Evidence: ${pc.dim(v.evidence)}\n\n`;
  });

  return out;
}

export function renderUsageSummary(summary: import('../intelligence/telemetry.js').TokenUsageSummary): string {
  let out = `\n${pc.bold('LOCAL TOKEN USAGE & SESSION TELEMETRY')}\n\n`;
  out += `Total Sessions:         ${pc.cyan(summary.totalSessions)}\n`;
  out += `Total TRACE Invocations:${pc.cyan(summary.totalInvocations)}\n`;
  out += `Total Tokens Generated: ${pc.cyan(summary.totalTokensGenerated.toLocaleString())}\n\n`;

  out += `${pc.bold('Invocations by Command:')}\n`;
  Object.entries(summary.byCommand).forEach(([cmd, count]) => {
    out += `  - ${cmd.padEnd(16)} ${pc.cyan(count)}\n`;
  });

  out += `\n${pc.bold('Tokens by Date:')}\n`;
  Object.entries(summary.byDay).forEach(([day, tokens]) => {
    out += `  - ${day.padEnd(16)} ${pc.cyan(tokens.toLocaleString())} tokens\n`;
  });

  out += `\n${pc.dim('Zero data leaves your machine. Stored locally in .codebase/usage.json.')}\n\n`;
  return out;
}
