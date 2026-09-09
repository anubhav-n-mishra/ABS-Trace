// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import fs from 'node:fs';
import path from 'node:path';

export type TokenType = 'ESTIMATED' | 'ACTUAL' | 'TRACE-GENERATED' | 'PROVIDER-REPORTED';

export interface TokenUsageRecord {
  id: string;
  sessionId: string;
  timestamp: string;
  command: string;
  tokensRequested?: number;
  tokensGenerated: number;
  tokenType: TokenType;
  filesIncluded: number;
  symbolsIncluded: number;
  query?: string;
  details?: Record<string, unknown>;
}

export interface TokenUsageSummary {
  totalSessions: number;
  totalInvocations: number;
  totalTokensGenerated: number;
  records: TokenUsageRecord[];
  byDay: Record<string, number>;
  byCommand: Record<string, number>;
}

export interface TokenUsageProvider {
  name: string;
  getUsage(sessionId?: string): Promise<TokenUsageRecord | null>;
}

/**
 * Provider-neutral local token usage ledger stored strictly in .codebase/usage.json.
 * Zero data leaves the local machine.
 */
export class LocalUsageLedger {
  private ledgerPath: string;

  constructor(private repoRoot: string) {
    this.ledgerPath = path.join(repoRoot, '.codebase', 'usage.json');
  }

  record(entry: Omit<TokenUsageRecord, 'id' | 'timestamp'>): TokenUsageRecord {
    const records = this.loadRecords();

    const record: TokenUsageRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };

    records.push(record);
    this.saveRecords(records);
    return record;
  }

  getSummary(options?: { sessionId?: string; today?: boolean }): TokenUsageSummary {
    let records = this.loadRecords();

    if (options?.sessionId) {
      records = records.filter((r) => r.sessionId === options.sessionId);
    }

    if (options?.today) {
      const todayStr = new Date().toISOString().slice(0, 10);
      records = records.filter((r) => r.timestamp.startsWith(todayStr));
    }

    const uniqueSessions = new Set(records.map((r) => r.sessionId));
    const byDay: Record<string, number> = {};
    const byCommand: Record<string, number> = {};
    let totalTokens = 0;

    for (const r of records) {
      const day = r.timestamp.slice(0, 10);
      byDay[day] = (byDay[day] || 0) + r.tokensGenerated;
      byCommand[r.command] = (byCommand[r.command] || 0) + 1;
      totalTokens += r.tokensGenerated;
    }

    return {
      totalSessions: uniqueSessions.size,
      totalInvocations: records.length,
      totalTokensGenerated: totalTokens,
      records,
      byDay,
      byCommand
    };
  }

  reset(): void {
    if (fs.existsSync(this.ledgerPath)) {
      fs.unlinkSync(this.ledgerPath);
    }
  }

  private loadRecords(): TokenUsageRecord[] {
    if (!fs.existsSync(this.ledgerPath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(this.ledgerPath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveRecords(records: TokenUsageRecord[]): void {
    const codebaseDir = path.dirname(this.ledgerPath);
    if (!fs.existsSync(codebaseDir)) {
      fs.mkdirSync(codebaseDir, { recursive: true });
    }
    fs.writeFileSync(this.ledgerPath, JSON.stringify(records, null, 2), 'utf8');
  }
}
