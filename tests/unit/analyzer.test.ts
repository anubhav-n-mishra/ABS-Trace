// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import { describe, it, expect } from 'vitest';
import { JavaScriptTypeScriptAnalyzer } from '../../packages/trace/src/analyzer/js-ts-analyzer.js';
import { parsePrismaSchema } from '../../packages/trace/src/analyzer/database.js';
import { SecretFilter } from '../../packages/trace/src/analyzer/secrets.js';
import { DEFAULT_CONFIG } from '../../packages/trace/src/core/config.js';

describe('JavaScriptTypeScriptAnalyzer', () => {
  const analyzer = new JavaScriptTypeScriptAnalyzer();

  it('extracts classes, methods, and functions from TypeScript', async () => {
    const code = `
      export interface PaymentPayload {
        amount: number;
        currency: string;
      }

      export class PaymentService {
        async processUPIPayment(payload: PaymentPayload): Promise<boolean> {
          console.log("Processing UPI");
          return true;
        }
      }

      export function verifyUPIResponse(responseId: string): boolean {
        return responseId.length > 0;
      }
    `;

    const facts = await analyzer.extractStructuralFacts(code, 'src/services/payment.ts');

    expect(facts.symbols.length).toBe(4); // interface + class + method + function
    const method = facts.symbols.find((s) => s.name === 'processUPIPayment');
    expect(method).toBeDefined();
    expect(method?.symbolKind).toBe('method');
    expect(method?.enclosingScope).toBe('PaymentService');
    expect(method?.urn).toBe('urn:trace:symbol:src/services/payment.ts#PaymentService.processUPIPayment');
  });

  it('detects Express and Next.js routes', async () => {
    const expressCode = `
      import express from 'express';
      const router = express.Router();
      router.post('/api/payment/upi', (req, res) => res.json({ ok: true }));
      router.get('/api/payment/status', (req, res) => res.json({ status: 'pending' }));
    `;

    const facts = await analyzer.extractStructuralFacts(expressCode, 'src/api/payment.ts');
    expect(facts.routes.length).toBe(2);
    expect(facts.routes[0]?.httpMethod).toBe('POST');
    expect(facts.routes[0]?.routePath).toBe('/api/payment/upi');
    expect(facts.routes[1]?.httpMethod).toBe('GET');
  });

  it('detects React components and hooks', async () => {
    const reactCode = `
      import React, { useState } from 'react';

      export function usePaymentStatus(id: string) {
        return { status: 'success' };
      }

      export const PaymentForm = () => {
        return <div className="payment-form">UPI Form</div>;
      };
    `;

    const facts = await analyzer.extractStructuralFacts(reactCode, 'src/components/PaymentForm.tsx');
    const hook = facts.symbols.find((s) => s.name === 'usePaymentStatus');
    const comp = facts.symbols.find((s) => s.name === 'PaymentForm');

    expect(hook?.symbolKind).toBe('hook');
    expect(comp?.symbolKind).toBe('component');
  });

  it('detects test suites and cases', async () => {
    const testCode = `
      describe('UPI Payment Flow', () => {
        it('processes valid UPI id', () => {
          expect(true).toBe(true);
        });
      });
    `;

    const facts = await analyzer.extractStructuralFacts(testCode, 'tests/payment/upi.test.ts');
    expect(facts.tests.length).toBe(2);
    expect(facts.tests[0]?.testType).toBe('suite');
    expect(facts.tests[0]?.name).toBe('UPI Payment Flow');
    expect(facts.tests[1]?.testType).toBe('case');
    expect(facts.tests[1]?.name).toBe('processes valid UPI id');
  });
});

describe('Database Model Extractor', () => {
  it('parses Prisma schema models and relations', () => {
    const schema = `
      datasource db {
        provider = "postgresql"
        url      = env("DATABASE_URL")
      }

      model Payment {
        id        String   @id @default(uuid())
        amount    Float
        userId    String
        user      User     @relation(fields: [userId], references: [id])
        createdAt DateTime @default(now())
      }

      model User {
        id    String    @id
        email String    @unique
        payments Payment[]
      }
    `;

    const models = parsePrismaSchema(schema, 'prisma/schema.prisma');
    expect(models.length).toBe(2);
    expect(models[0]?.name).toBe('Payment');
    expect(models[0]?.fields.length).toBe(5);
    expect(models[0]?.fields.find((f) => f.name === 'id')?.isId).toBe(true);
    expect(models[0]?.fields.find((f) => f.name === 'user')?.isRelation).toBe(true);
  });
});

describe('SecretFilter', () => {
  it('filters out .env, private keys, and ignored directories', () => {
    const filter = new SecretFilter(process.cwd(), DEFAULT_CONFIG);

    expect(filter.isIgnored('.env')).toBe(true);
    expect(filter.isIgnored('.env.local')).toBe(true);
    expect(filter.isIgnored('server.key')).toBe(true);
    expect(filter.isIgnored('cert.pem')).toBe(true);
    expect(filter.isIgnored('node_modules/express/index.js')).toBe(true);
    expect(filter.isIgnored('.codebase/graph.json')).toBe(true);
    expect(filter.isIgnored('src/services/payment.ts')).toBe(false);
  });
});
