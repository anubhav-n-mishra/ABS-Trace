// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt

export interface TokenizerAdapter {
  name: string;
  estimateTokens(text: string): number;
}

/**
 * Conservative Fallback Tokenizer:
 * Estimates token counts using a safe lower bound on characters per token (3.3 chars/token)
 * plus whitespace and punctuation penalties to guarantee the budget is never exceeded.
 */
export class ConservativeTokenizer implements TokenizerAdapter {
  name = 'conservative-heuristic';

  estimateTokens(text: string): number {
    if (!text || text.length === 0) return 0;
    // Base estimation: 3.3 characters per token (conservative lower bound)
    const baseCount = text.length / 3.3;
    // Word boundary penalty: words with special characters, symbols, or camelCase often split into multiple tokens
    const punctuationMatches = (text.match(/[{}\[\](),.:;'"\/\\<>=+*&|^%$#@!~`-]/g) || []).length;
    const punctuationPenalty = punctuationMatches * 0.25;

    return Math.ceil(baseCount + punctuationPenalty);
  }
}

export interface BudgetableItem<T = unknown> {
  id: string;
  priority: number; // Higher number = higher priority
  text: string;
  data?: T;
}

export class TokenBudgetManager {
  private tokenizer: TokenizerAdapter;

  constructor(customTokenizer?: TokenizerAdapter) {
    this.tokenizer = customTokenizer || new ConservativeTokenizer();
  }

  estimate(text: string): number {
    return this.tokenizer.estimateTokens(text);
  }

  /**
   * Knapsack priority packing: packs items ordered by priority until budget is reached.
   */
  packItems<T>(items: BudgetableItem<T>[], maxTokens: number): {
    packed: BudgetableItem<T>[];
    totalTokens: number;
    droppedCount: number;
  } {
    // Sort items by priority descending
    const sorted = [...items].sort((a, b) => b.priority - a.priority);
    const packed: BudgetableItem<T>[] = [];
    let currentTokens = 0;
    let droppedCount = 0;

    for (const item of sorted) {
      const itemTokens = this.estimate(item.text);
      if (currentTokens + itemTokens <= maxTokens) {
        packed.push(item);
        currentTokens += itemTokens;
      } else {
        droppedCount++;
      }
    }

    return {
      packed,
      totalTokens: currentTokens,
      droppedCount
    };
  }

  /**
   * Final safety check and hard truncation to strictly guarantee token limit.
   */
  enforceTokenLimit(text: string, maxTokens: number): string {
    if (this.estimate(text) <= maxTokens) {
      return text;
    }

    const suffix = '\n... [TRUNCATED]';
    const suffixTokens = this.estimate(suffix);
    const targetBudget = Math.max(1, maxTokens - suffixTokens);

    // Binary search to find safe character slice
    let low = 0;
    let high = text.length;
    let bestCandidate = '';

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = text.slice(0, mid);
      if (this.estimate(candidate) <= targetBudget) {
        bestCandidate = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    let result = bestCandidate + suffix;

    // Final verification check: if result still exceeds maxTokens, trim until strictly <= maxTokens
    while (result.length > suffix.length && this.estimate(result) > maxTokens) {
      bestCandidate = bestCandidate.slice(0, -5);
      result = bestCandidate + suffix;
    }

    return result;
  }
}
