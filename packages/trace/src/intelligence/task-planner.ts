// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import type { FeatureGraph } from '../core/graph.js';
import { SemanticMatcher } from '../detector/semantic-matcher.js';
import type { FeatureNode, RouteNode, ModelNode, TestNode, SymbolNode } from '../core/types.js';

export interface TaskFileSuggestion {
  path: string;
  role: 'UI' | 'API' | 'Service' | 'Model' | 'Test';
  confidence: 'DETECTED' | 'INFERRED';
  reason: string;
}

export interface TaskMapResult {
  query: string;
  primaryFeature?: FeatureNode;
  likelyFiles: TaskFileSuggestion[];
  existingPatterns: Array<{ name: string; path: string; description: string }>;
  relevantTests: Array<{ name: string; path: string }>;
  suggestedSurface: Array<'UI' | 'API' | 'Service' | 'Model' | 'Test'>;
}

export interface PlanPhase {
  phase: number;
  title: string;
  category: 'DETERMINISTIC' | 'DETECTED' | 'INFERRED' | 'SUGGESTED';
  actions: string[];
  targets: Array<{ name: string; path: string; urn?: string }>;
}

export interface TaskPlanResult {
  query: string;
  currentArchitecture: string;
  affectedFeatures: Array<{ feature: FeatureNode; confidence: 'DETECTED' | 'INFERRED' }>;
  affectedSymbols: SymbolNode[];
  affectedApis: RouteNode[];
  affectedModels: ModelNode[];
  affectedTests: TestNode[];
  potentialRisks: string[];
  suggestedOrder: PlanPhase[];
}

/**
 * Maps a natural-language task description to relevant architecture, reference patterns, and files.
 * TRACE provides architectural navigation; it does not generate code.
 */
export function mapTaskArchitecture(graph: FeatureGraph, taskDescription: string): TaskMapResult {
  const matcher = new SemanticMatcher(graph);
  const searchResults = matcher.search(taskDescription, 15);

  // Find best matching feature
  const features = graph.getFeatures();
  const queryLower = taskDescription.toLowerCase();

  let primaryFeature: FeatureNode | undefined = features.find((f) =>
    queryLower.includes(f.displayName.toLowerCase())
  );

  if (!primaryFeature && searchResults.length > 0) {
    for (const r of searchResults) {
      if (r.node.kind === 'feature') {
        primaryFeature = r.node as FeatureNode;
        break;
      }
      const exp = graph.explain(r.node.urn);
      if (exp.relatedFeatures.length > 0) {
        primaryFeature = exp.relatedFeatures[0]?.feature;
        break;
      }
    }
  }

  // Collect files and roles
  const fileSuggestions: TaskFileSuggestion[] = [];
  const seenPaths = new Set<string>();

  if (primaryFeature) {
    const view = graph.getFeatureView(primaryFeature.urn);

    for (const u of view.ui) {
      if (!seenPaths.has(u.node.path)) {
        seenPaths.add(u.node.path);
        fileSuggestions.push({
          path: u.node.path,
          role: 'UI',
          confidence: 'DETECTED',
          reason: `UI component '${u.node.name}' belongs to feature '${primaryFeature.displayName}'`
        });
      }
    }
    for (const a of view.api) {
      if (!seenPaths.has(a.node.path)) {
        seenPaths.add(a.node.path);
        fileSuggestions.push({
          path: a.node.path,
          role: 'API',
          confidence: 'DETECTED',
          reason: `Route '${a.node.httpMethod} ${a.node.routePath}' serves feature '${primaryFeature.displayName}'`
        });
      }
    }
    for (const s of view.services) {
      if (!seenPaths.has(s.node.path)) {
        seenPaths.add(s.node.path);
        fileSuggestions.push({
          path: s.node.path,
          role: 'Service',
          confidence: 'DETECTED',
          reason: `Service symbol '${s.node.name}' implements '${primaryFeature.displayName}' logic`
        });
      }
    }
    for (const m of view.database) {
      if (!seenPaths.has(m.node.path)) {
        seenPaths.add(m.node.path);
        fileSuggestions.push({
          path: m.node.path,
          role: 'Model',
          confidence: 'DETECTED',
          reason: `Database model '${m.node.name}' supports '${primaryFeature.displayName}' data`
        });
      }
    }
  }

  // Also include files from search results if not already present
  for (const r of searchResults.slice(0, 5)) {
    if (r.node.path && !seenPaths.has(r.node.path)) {
      seenPaths.add(r.node.path);
      let role: TaskFileSuggestion['role'] = 'Service';
      if (r.node.kind === 'route') role = 'API';
      else if (r.node.kind === 'model') role = 'Model';
      else if (r.node.kind === 'test') role = 'Test';
      else if (r.node.path.includes('component') || r.node.path.endsWith('.tsx') || r.node.path.endsWith('.jsx')) role = 'UI';

      fileSuggestions.push({
        path: r.node.path,
        role,
        confidence: 'INFERRED',
        reason: `Matched search query with relevance score ${Math.round(r.score * 100)}%`
      });
    }
  }

  // Find existing patterns (e.g. existing providers, services, endpoints)
  const existingPatterns: Array<{ name: string; path: string; description: string }> = [];
  const allActive = graph.getActiveNodes();

  for (const node of allActive) {
    if (node.path.includes('/providers/') || node.path.includes('/strategies/')) {
      existingPatterns.push({
        name: node.name,
        path: node.path,
        description: `Existing provider/strategy pattern in ${node.path}`
      });
    } else if (node.kind === 'symbol' && (node.name.endsWith('Service') || node.name.endsWith('Client'))) {
      if (existingPatterns.length < 4) {
        existingPatterns.push({
          name: node.name,
          path: node.path,
          description: `Existing service architecture in ${node.path}`
        });
      }
    }
  }

  // Relevant tests
  const relevantTests: Array<{ name: string; path: string }> = [];
  if (primaryFeature) {
    const view = graph.getFeatureView(primaryFeature.urn);
    for (const t of view.tests) {
      relevantTests.push({ name: t.node.name, path: t.node.path });
    }
  }

  const suggestedSurface: Array<'UI' | 'API' | 'Service' | 'Model' | 'Test'> = [];
  if (fileSuggestions.some((f) => f.role === 'Model')) suggestedSurface.push('Model');
  if (fileSuggestions.some((f) => f.role === 'Service')) suggestedSurface.push('Service');
  if (fileSuggestions.some((f) => f.role === 'API')) suggestedSurface.push('API');
  if (fileSuggestions.some((f) => f.role === 'UI')) suggestedSurface.push('UI');
  suggestedSurface.push('Test');

  return {
    query: taskDescription,
    primaryFeature,
    likelyFiles: fileSuggestions,
    existingPatterns: existingPatterns.slice(0, 3),
    relevantTests: relevantTests.slice(0, 5),
    suggestedSurface
  };
}

/**
 * Generates an evidence-backed step-by-step implementation plan distinguishing
 * deterministic facts from suggested phases.
 */
export function generateTaskPlan(graph: FeatureGraph, taskDescription: string): TaskPlanResult {
  const taskMap = mapTaskArchitecture(graph, taskDescription);

  const affectedFeatures: Array<{ feature: FeatureNode; confidence: 'DETECTED' | 'INFERRED' }> = [];
  if (taskMap.primaryFeature) {
    affectedFeatures.push({
      feature: taskMap.primaryFeature,
      confidence: taskMap.primaryFeature.confidence === 'EXPLICIT' ? 'DETECTED' : 'INFERRED'
    });
  }

  const affectedSymbols: SymbolNode[] = [];
  const affectedApis: RouteNode[] = [];
  const affectedModels: ModelNode[] = [];
  const affectedTests: TestNode[] = [];

  const targetFileSet = new Set(taskMap.likelyFiles.map((f) => f.path));
  for (const node of graph.getActiveNodes()) {
    if (targetFileSet.has(node.path)) {
      if (node.kind === 'symbol') affectedSymbols.push(node as SymbolNode);
      else if (node.kind === 'route') affectedApis.push(node as RouteNode);
      else if (node.kind === 'model') affectedModels.push(node as ModelNode);
      else if (node.kind === 'test') affectedTests.push(node as TestNode);
    }
  }

  // Identify potential risks
  const potentialRisks: string[] = [];
  if (affectedModels.length > 0) {
    potentialRisks.push(`Database model modifications may require migrations (${affectedModels.map((m) => m.name).join(', ')}).`);
  }
  if (affectedApis.length > 0) {
    potentialRisks.push(`API contract changes may impact frontend clients or external consumers.`);
  }
  if (affectedTests.length === 0) {
    potentialRisks.push(`No existing tests found for this feature area. New tests must be written.`);
  }

  // Structure suggested implementation phases
  const suggestedOrder: PlanPhase[] = [];
  let phaseNum = 1;

  if (affectedModels.length > 0) {
    suggestedOrder.push({
      phase: phaseNum++,
      title: 'Database & Data Models',
      category: 'DETERMINISTIC',
      actions: ['Review schema definitions and relations', 'Prepare necessary migrations'],
      targets: affectedModels.map((m) => ({ name: m.name, path: m.path, urn: m.urn }))
    });
  }

  const serviceSymbols = affectedSymbols.filter((s) => !s.path.includes('component') && !s.path.includes('.tsx'));
  if (serviceSymbols.length > 0) {
    suggestedOrder.push({
      phase: phaseNum++,
      title: 'Core Business Logic & Services',
      category: 'DETECTED',
      actions: ['Implement or adapt service methods', 'Ensure error handling and validation'],
      targets: serviceSymbols.slice(0, 5).map((s) => ({ name: s.name, path: s.path, urn: s.urn }))
    });
  }

  if (affectedApis.length > 0) {
    suggestedOrder.push({
      phase: phaseNum++,
      title: 'API Endpoints & Handlers',
      category: 'DETERMINISTIC',
      actions: ['Define or update HTTP route handlers', 'Validate input payloads and return types'],
      targets: affectedApis.map((a) => ({ name: `${a.httpMethod} ${a.routePath}`, path: a.path, urn: a.urn }))
    });
  }

  const uiSymbols = affectedSymbols.filter((s) => s.path.includes('component') || s.path.endsWith('.tsx') || s.path.endsWith('.jsx'));
  if (uiSymbols.length > 0) {
    suggestedOrder.push({
      phase: phaseNum++,
      title: 'UI Components & Hooks',
      category: 'INFERRED',
      actions: ['Connect UI components to updated APIs or state handlers'],
      targets: uiSymbols.slice(0, 5).map((u) => ({ name: u.name, path: u.path, urn: u.urn }))
    });
  }

  suggestedOrder.push({
    phase: phaseNum++,
    title: 'Verification, Tests & Index Sync',
    category: 'SUGGESTED',
    actions: [
      'Execute existing and new unit/integration tests',
      "Run 'trace update' to reconcile codebase map",
      "Run 'trace validate' to confirm index health"
    ],
    targets: affectedTests.slice(0, 5).map((t) => ({ name: t.name, path: t.path, urn: t.urn }))
  });

  return {
    query: taskDescription,
    currentArchitecture: taskMap.primaryFeature
      ? `Feature '${taskMap.primaryFeature.displayName}' with ${taskMap.likelyFiles.length} participant files`
      : 'Distributed services across matched symbols',
    affectedFeatures,
    affectedSymbols,
    affectedApis,
    affectedModels,
    affectedTests,
    potentialRisks,
    suggestedOrder
  };
}
