// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import type { ConfidenceLevel, EvidenceType } from '../core/types.js';

export interface ConfidenceScoreResult {
  confidence: ConfidenceLevel;
  score: number;
}

export function calculateConfidence(
  evidenceTypes: EvidenceType[],
  isExplicit = false
): ConfidenceScoreResult {
  if (isExplicit || evidenceTypes.includes('explicit_declaration')) {
    return { confidence: 'EXPLICIT', score: 1.0 };
  }

  // Strong structural evidence
  if (
    evidenceTypes.includes('route_match') ||
    evidenceTypes.includes('directory_cluster') ||
    evidenceTypes.includes('model_ref')
  ) {
    return { confidence: 'DETECTED', score: 0.85 };
  }

  // Intermediate call / import evidence
  if (evidenceTypes.includes('ast_import') || evidenceTypes.includes('ast_call')) {
    return { confidence: 'DETECTED', score: 0.75 };
  }

  // Inferred semantic or keyword similarity
  if (evidenceTypes.includes('semantic_similarity')) {
    return { confidence: 'INFERRED', score: 0.5 };
  }

  return { confidence: 'UNKNOWN', score: 0.1 };
}
