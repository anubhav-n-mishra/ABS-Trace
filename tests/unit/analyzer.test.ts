// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import { describe, it, expect } from 'vitest';
import { JavaScriptTypeScriptAnalyzer } from '../../packages/trace/src/analyzer/js-ts-analyzer.js';
import { parsePrismaSchema } from '../../packages/trace/src/analyzer/database.js';
import { SecretFilter } from '../../packages/trace/src/analyzer/secrets.js';
import { DEFAULT_CONFIG } from '../../packages/trace/src/core/config.js';
import { RustAnalyzer } from '../../packages/trace/src/analyzer/rust-analyzer.js';
import { JavaAnalyzer } from '../../packages/trace/src/analyzer/java-analyzer.js';
import { GoAnalyzer } from '../../packages/trace/src/analyzer/go-analyzer.js';
import { PythonAnalyzer } from '../../packages/trace/src/analyzer/python-analyzer.js';
import { splitWords, bestKeywordMatch } from '../../packages/trace/src/detector/auto-detector.js';

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

describe('Standard Builtins & Route Sanitization', () => {
  it('identifies standard methods and Node built-ins accurately', async () => {
    const { isStandardBuiltin } = await import('../../packages/trace/src/indexer/builtins.js');
    expect(isStandardBuiltin('filter')).toBe(true);
    expect(isStandardBuiltin('map')).toBe(true);
    expect(isStandardBuiltin('slice')).toBe(true);
    expect(isStandardBuiltin('path')).toBe(true);
    expect(isStandardBuiltin('fs')).toBe(true);
    expect(isStandardBuiltin('processPayment')).toBe(false);
    expect(isStandardBuiltin('calculateTotal')).toBe(false);
  });

  it('sanitizes route domains and ignores static metadata extensions', async () => {
    const { FeatureDetector } = await import('../../packages/trace/src/detector/auto-detector.js');
    const detector = new FeatureDetector(process.cwd());

    const facts = [
      {
        filePath: 'src/app/api/contact/route.ts',
        symbols: [],
        routes: [
          {
            urn: 'urn:trace:route:src/app/api/contact/route.ts#POST./api/contact',
            kind: 'route' as const,
            name: 'POST /api/contact',
            path: 'src/app/api/contact/route.ts',
            status: 'active' as const,
            aliases: [],
            httpMethod: 'POST' as const,
            routePath: '/api/contact',
            startLine: 1,
            endLine: 10,
            handlerSymbol: 'POST',
            metadata: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            urn: 'urn:trace:route:src/app/api/rss.xml/route.ts#GET./api/rss.xml',
            kind: 'route' as const,
            name: 'GET /api/rss.xml',
            path: 'src/app/api/rss.xml/route.ts',
            status: 'active' as const,
            aliases: [],
            httpMethod: 'GET' as const,
            routePath: '/api/rss.xml',
            startLine: 1,
            endLine: 5,
            handlerSymbol: 'GET',
            metadata: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        models: [],
        tests: [],
        imports: [],
        calls: []
      }
    ];

    const { features } = detector.detectFeatures(facts);
    expect(features.some((f) => f.name === 'contact')).toBe(true);
    expect(features.some((f) => f.name.includes('rss'))).toBe(false);
  });

  it('renders PASSED WITH WARNINGS when rule check has only warnings', async () => {
    const { renderRuleCheckReport } = await import('../../packages/trace/src/renderers/terminal.js');
    const rendered = renderRuleCheckReport({
      totalRules: 2,
      passedRules: 2,
      failedRules: 0,
      isCompliant: true,
      violations: [
        {
          ruleName: 'Require Service Tests',
          severity: 'WARNING',
          message: 'Missing test coverage',
          evidence: 'Target requires test relationships'
        }
      ]
    });

    expect(rendered).toContain('PASSED WITH WARNINGS: 1 architectural warning(s) detected.');
    expect(rendered).not.toContain('FAILED: 0 rule violation(s)');
  });
});

describe('Domain Vocabulary Matching', () => {
  it('splits identifiers on camelCase, snake_case and separators', () => {
    expect(splitWords('authorizeCharge')).toEqual(['authorize', 'charge']);
    expect(splitWords('LEGACY_LOGIN_SALT')).toEqual(['legacy', 'login', 'salt']);
    expect(splitWords('src/services/paymentsService.js')).toEqual([
      'src',
      'services',
      'payments',
      'service',
      'js'
    ]);
  });

  it('does not let a short keyword match inside an unrelated word', () => {
    // 'ai' must not match 'email' / 'details', which silently misfiled whole
    // domains into AI & Intelligence.
    expect(bestKeywordMatch(splitWords('detailedNodes'), splitWords('src/cycles.ts'))).toBeNull();
    expect(bestKeywordMatch(splitWords('available'), splitWords('src/util.ts'))).toBeNull();
  });

  it('prefers an exact domain word in the path over a fuzzy prefix in the name', () => {
    // 'auth' is only a prefix of 'authorize', while 'payments' is an exact
    // (plural) path word, so this belongs to Payments.
    const match = bestKeywordMatch(
      splitWords('authorizeCharge'),
      splitWords('src/services/paymentsService.js')
    );
    expect(match?.meta.name).toBe('Payments');
  });

  it('still classifies genuine auth symbols by prefix', () => {
    const match = bestKeywordMatch(
      splitWords('authenticateOperator'),
      splitWords('src/admin/operatorAccess.js')
    );
    expect(match?.meta.name).toBe('Authentication');
  });
});

describe('Python Analyzer', () => {
  const analyzer = new PythonAnalyzer();

  const SOURCE = [
    'from app.models.user import User',
    'import bcrypt',
    '',
    'MIN_PASSWORD_LENGTH = 8',
    '',
    '',
    'def verify_credentials(email, password):',
    '    user = User.find_by_email(email)',
    '    return {"ok": True, "user": user}',
    '',
    '',
    'def login_user(email, password):',
    '    result = verify_credentials(email, password)',
    '    return result',
    '',
    '',
    'class SessionStore:',
    '    def revoke(self, session_id):',
    '        return True',
    ''
  ].join('\n');

  it('extracts functions, classes, methods and module constants', async () => {
    const facts = await analyzer.extractStructuralFacts(SOURCE, 'app/services/auth_service.py');
    const byName = new Map(facts.symbols.map((s) => [s.name, s]));

    expect(byName.get('verify_credentials')?.symbolKind).toBe('function');
    expect(byName.get('SessionStore')?.symbolKind).toBe('class');
    expect(byName.get('revoke')?.symbolKind).toBe('method');
    expect(byName.get('revoke')?.enclosingScope).toBe('SessionStore');
    expect(byName.get('MIN_PASSWORD_LENGTH')?.symbolKind).toBe('variable');
  });

  it('attributes calls to the enclosing function', async () => {
    const facts = await analyzer.extractStructuralFacts(SOURCE, 'app/services/auth_service.py');
    const call = facts.calls.find((c) => c.calleeName === 'verify_credentials');

    expect(call).toBeDefined();
    expect(call?.callerUrn).toContain('login_user');
  });

  it('parses imports', async () => {
    const facts = await analyzer.extractStructuralFacts(SOURCE, 'app/services/auth_service.py');
    const fromImport = facts.imports.find((i) => i.moduleSpecifier === 'app.models.user');

    expect(fromImport?.importedSymbols).toContain('User');
    expect(facts.imports.some((i) => i.moduleSpecifier === 'bcrypt')).toBe(true);
  });

  it('detects Flask routes and their HTTP method', async () => {
    const routeSource = [
      "@app.route('/api/auth/login', methods=['POST'])",
      'def login():',
      '    return 1',
      '',
      "@app.get('/api/auth/profile')",
      'def profile():',
      '    return 2',
      ''
    ].join('\n');

    const facts = await analyzer.extractStructuralFacts(routeSource, 'app/api/auth_routes.py');
    const login = facts.routes.find((r) => r.routePath === '/api/auth/login');
    const profile = facts.routes.find((r) => r.routePath === '/api/auth/profile');

    expect(login?.httpMethod).toBe('POST');
    expect(login?.handlerSymbol).toBe('login');
    expect(profile?.httpMethod).toBe('GET');
  });

  it('detects pytest test cases', async () => {
    const testSource = ['def test_login_rejects_bad_password():', '    assert True', ''].join('\n');
    const facts = await analyzer.extractStructuralFacts(testSource, 'tests/test_auth.py');

    expect(facts.tests.map((t) => t.name)).toContain('test_login_rejects_bad_password');
  });
});

describe('Go Analyzer', () => {
  const analyzer = new GoAnalyzer();

  const SOURCE = [
    'package auth',
    '',
    'import (',
    '\t"errors"',
    '\t"net/http"',
    ')',
    '',
    'const MinPasswordLength = 8',
    '',
    'type User struct {',
    '\tID string',
    '}',
    '',
    'func VerifyCredentials(email string) bool {',
    '\treturn FindByEmail(email)',
    '}',
    '',
    'func (s *Store) Save(u *User) error {',
    '\treturn nil',
    '}',
    ''
  ].join('\n');

  it('extracts functions, methods with receivers, structs and constants', async () => {
    const facts = await analyzer.extractStructuralFacts(SOURCE, 'internal/auth/service.go');
    const byName = new Map(facts.symbols.map((s) => [s.name, s]));

    expect(byName.get('VerifyCredentials')?.symbolKind).toBe('function');
    expect(byName.get('User')?.symbolKind).toBe('class');
    expect(byName.get('Save')?.symbolKind).toBe('method');
    expect(byName.get('Save')?.enclosingScope).toBe('Store');
    expect(byName.get('MinPasswordLength')?.symbolKind).toBe('variable');
  });

  it('treats capitalised identifiers as exported', async () => {
    const facts = await analyzer.extractStructuralFacts(SOURCE, 'internal/auth/service.go');
    expect(facts.symbols.find((s) => s.name === 'VerifyCredentials')?.isExported).toBe(true);
  });

  it('parses grouped imports', async () => {
    const facts = await analyzer.extractStructuralFacts(SOURCE, 'internal/auth/service.go');
    const specs = facts.imports.map((i) => i.moduleSpecifier);
    expect(specs).toContain('errors');
    expect(specs).toContain('net/http');
  });

  it('attributes calls to the enclosing function', async () => {
    const facts = await analyzer.extractStructuralFacts(SOURCE, 'internal/auth/service.go');
    const call = facts.calls.find((c) => c.calleeName === 'FindByEmail');
    expect(call?.callerUrn).toContain('VerifyCredentials');
  });

  it('detects net/http and verb-style route registrations', async () => {
    const routeSource = [
      'package api',
      '',
      'func RegisterRoutes(mux *http.ServeMux) {',
      '\tmux.HandleFunc("/api/auth/login", LoginHandler)',
      '}',
      '',
      'func Setup(r chi.Router) {',
      '\tr.Post("/api/orders", CreateOrder)',
      '}',
      ''
    ].join('\n');

    const facts = await analyzer.extractStructuralFacts(routeSource, 'api/routes.go');
    const login = facts.routes.find((r) => r.routePath === '/api/auth/login');
    const orders = facts.routes.find((r) => r.routePath === '/api/orders');

    expect(login?.handlerSymbol).toBe('LoginHandler');
    expect(orders?.httpMethod).toBe('POST');
  });

  it('detects Go test functions only in _test.go files', async () => {
    const testSource = ['package auth', '', 'func TestLoginRejects(t *testing.T) {', '}', ''].join('\n');

    const inTestFile = await analyzer.extractStructuralFacts(testSource, 'internal/auth/service_test.go');
    const inNormalFile = await analyzer.extractStructuralFacts(testSource, 'internal/auth/service.go');

    expect(inTestFile.tests.map((t) => t.name)).toContain('TestLoginRejects');
    expect(inNormalFile.tests.length).toBe(0);
  });
});

describe('Rust Analyzer', () => {
  const analyzer = new RustAnalyzer();

  const SOURCE = [
    'use crate::auth::session::{create_session, revoke_session};',
    '',
    'pub const MIN_PASSWORD_LENGTH: usize = 8;',
    '',
    'pub struct User {',
    '    pub id: String,',
    '}',
    '',
    'pub trait Authenticator {',
    '    fn check(&self) -> bool;',
    '}',
    '',
    'pub fn verify_credentials(email: &str) -> bool {',
    '    find_by_email(email)',
    '}',
    '',
    'impl User {',
    '    pub fn is_admin(&self) -> bool {',
    '        true',
    '    }',
    '}',
    '',
    '#[test]',
    'fn test_rejects_bad_password() {',
    '    assert!(true);',
    '}',
    ''
  ].join('\n');

  it('extracts functions, structs, traits, impl methods and constants', async () => {
    const facts = await analyzer.extractStructuralFacts(SOURCE, 'src/auth/service.rs');
    const byName = new Map(facts.symbols.map((s) => [s.name, s]));

    expect(byName.get('verify_credentials')?.symbolKind).toBe('function');
    expect(byName.get('User')?.symbolKind).toBe('class');
    expect(byName.get('Authenticator')?.symbolKind).toBe('interface');
    expect(byName.get('is_admin')?.symbolKind).toBe('method');
    expect(byName.get('is_admin')?.enclosingScope).toBe('User');
    expect(byName.get('MIN_PASSWORD_LENGTH')?.symbolKind).toBe('variable');
  });

  it('marks pub items as exported', async () => {
    const facts = await analyzer.extractStructuralFacts(SOURCE, 'src/auth/service.rs');
    expect(facts.symbols.find((s) => s.name === 'verify_credentials')?.isExported).toBe(true);
  });

  it('parses braced use statements', async () => {
    const facts = await analyzer.extractStructuralFacts(SOURCE, 'src/auth/service.rs');
    const imp = facts.imports[0];
    expect(imp?.importedSymbols).toContain('create_session');
    expect(imp?.importedSymbols).toContain('revoke_session');
  });

  it('attributes calls to the enclosing fn', async () => {
    const facts = await analyzer.extractStructuralFacts(SOURCE, 'src/auth/service.rs');
    const call = facts.calls.find((c) => c.calleeName === 'find_by_email');
    expect(call?.callerUrn).toContain('verify_credentials');
  });

  it('detects #[test] functions and axum routes', async () => {
    const facts = await analyzer.extractStructuralFacts(SOURCE, 'src/auth/service.rs');
    expect(facts.tests.map((t) => t.name)).toContain('test_rejects_bad_password');

    const routeSource = [
      'pub fn build_router() -> Router {',
      '    Router::new()',
      '        .route("/api/auth/login", post(login_handler))',
      '}',
      ''
    ].join('\n');
    const routeFacts = await analyzer.extractStructuralFacts(routeSource, 'src/routes.rs');
    expect(routeFacts.routes[0]?.httpMethod).toBe('POST');
    expect(routeFacts.routes[0]?.routePath).toBe('/api/auth/login');
  });
});

describe('Java Analyzer', () => {
  const analyzer = new JavaAnalyzer();

  const SOURCE = [
    'package com.shop.auth;',
    '',
    'import com.shop.auth.SessionService;',
    '',
    'public class AuthService {',
    '    public static final int MIN_PASSWORD_LENGTH = 8;',
    '',
    '    public AuthResult verifyCredentials(String email) {',
    '        return findByEmail(email);',
    '    }',
    '',
    '    private User findByEmail(String email) {',
    '        return null;',
    '    }',
    '}',
    ''
  ].join('\n');

  it('extracts classes, methods and constant fields', async () => {
    const facts = await analyzer.extractStructuralFacts(SOURCE, 'src/main/java/com/shop/auth/AuthService.java');
    const byName = new Map(facts.symbols.map((s) => [s.name, s]));

    expect(byName.get('AuthService')?.symbolKind).toBe('class');
    expect(byName.get('verifyCredentials')?.symbolKind).toBe('method');
    expect(byName.get('verifyCredentials')?.enclosingScope).toBe('AuthService');
    expect(byName.get('MIN_PASSWORD_LENGTH')?.symbolKind).toBe('variable');
  });

  it('distinguishes public from private members', async () => {
    const facts = await analyzer.extractStructuralFacts(SOURCE, 'src/main/java/com/shop/auth/AuthService.java');
    expect(facts.symbols.find((s) => s.name === 'verifyCredentials')?.isExported).toBe(true);
    expect(facts.symbols.find((s) => s.name === 'findByEmail')?.isExported).toBe(false);
  });

  it('attributes calls to the enclosing method', async () => {
    const facts = await analyzer.extractStructuralFacts(SOURCE, 'src/main/java/com/shop/auth/AuthService.java');
    const call = facts.calls.find((c) => c.calleeName === 'findByEmail');
    expect(call?.callerUrn).toContain('verifyCredentials');
  });

  it('combines class-level and method-level Spring mappings', async () => {
    const controller = [
      'package com.shop.auth;',
      '',
      '@RestController',
      '@RequestMapping("/api/auth")',
      'public class AuthController {',
      '    @PostMapping("/login")',
      '    public String login(String email) {',
      '        return "ok";',
      '    }',
      '}',
      ''
    ].join('\n');

    const facts = await analyzer.extractStructuralFacts(controller, 'src/main/java/com/shop/auth/AuthController.java');
    expect(facts.routes[0]?.routePath).toBe('/api/auth/login');
    expect(facts.routes[0]?.httpMethod).toBe('POST');
    expect(facts.routes[0]?.handlerSymbol).toBe('login');
  });

  it('detects JUnit tests', async () => {
    const testSource = [
      'package com.shop.auth;',
      '',
      'public class AuthServiceTest {',
      '    @Test',
      '    public void loginRejectsBadPassword() {',
      '        assert true;',
      '    }',
      '}',
      ''
    ].join('\n');

    const facts = await analyzer.extractStructuralFacts(testSource, 'src/test/java/com/shop/auth/AuthServiceTest.java');
    expect(facts.tests.map((t) => t.name)).toContain('loginRejectsBadPassword');
    expect(facts.tests[0]?.suiteName).toBe('AuthServiceTest');
  });
});
