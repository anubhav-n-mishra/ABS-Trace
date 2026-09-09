// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import crypto from 'node:crypto';
import path from 'node:path';
import { parse as babelParse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type {
  LanguageAnalyzer,
  StructuralFacts,
  ModuleImport,
  SymbolCall
} from './base.js';
import type {
  SymbolNode,
  RouteNode,
  TestNode,
  SymbolKind
} from '../core/types.js';
import {
  createSymbolUrn,
  createRouteUrn,
  createTestUrn,
  normalizeRepoPath
} from '../core/urn.js';

// Workaround for ESM/CJS interop with @babel/traverse default export
const traverse = (traverseModule as any).default || traverseModule;

export class JavaScriptTypeScriptAnalyzer implements LanguageAnalyzer {
  readonly id = 'javascript-typescript';
  readonly name = 'JavaScript & TypeScript Analyzer';
  readonly supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

  canAnalyze(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  async extractStructuralFacts(fileContent: string, filePath: string): Promise<StructuralFacts> {
    const normPath = normalizeRepoPath(filePath);
    const symbols: SymbolNode[] = [];
    const routes: RouteNode[] = [];
    const tests: TestNode[] = [];
    const imports: ModuleImport[] = [];
    const calls: SymbolCall[] = [];

    let ast: t.File;
    try {
      ast = babelParse(fileContent, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          ['decorators', { decoratorsBeforeExport: true }],
          'classProperties',
          'classPrivateProperties',
          'classPrivateMethods',
          'dynamicImport',
          'exportDefaultFrom'
        ],
        errorRecovery: true
      });
    } catch (err: any) {
      // If module parsing fails completely, try script mode
      try {
        ast = babelParse(fileContent, {
          sourceType: 'script',
          plugins: ['jsx', 'classProperties'],
          errorRecovery: true
        });
      } catch {
        // Return empty facts for unparseable file
        return {
          filePath: normPath,
          symbols,
          routes,
          models: [],
          tests,
          imports,
          calls
        };
      }
    }

    const lines = fileContent.split('\n');

    function getSliceHash(startLine: number, endLine: number): string {
      const slice = lines.slice(startLine - 1, endLine).join('\n');
      return crypto.createHash('sha256').update(slice).digest('hex').slice(0, 16);
    }

    // Next.js App Router Route Detection (e.g. app/api/payment/route.ts)
    const isNextAppRoute = /(?:^|\/)app\/(.+)\/route\.[jt]sx?$/.test(normPath);
    const nextRoutePrefix = isNextAppRoute
      ? '/' + normPath.match(/(?:^|\/)app\/(.+)\/route\.[jt]sx?$/)![1]
      : '';

    traverse(ast, {
      // 1. Imports
      ImportDeclaration(pathObj: NodePath<t.ImportDeclaration>) {
        const node = pathObj.node;
        const moduleSpecifier = node.source.value;
        const importedSymbols: string[] = [];
        let isDefault = false;
        let isNamespace = false;

        for (const spec of node.specifiers) {
          if (t.isImportDefaultSpecifier(spec)) {
            isDefault = true;
            importedSymbols.push(spec.local.name);
          } else if (t.isImportNamespaceSpecifier(spec)) {
            isNamespace = true;
            importedSymbols.push(spec.local.name);
          } else if (t.isImportSpecifier(spec)) {
            const importedName = t.isIdentifier(spec.imported)
              ? spec.imported.name
              : spec.imported.value;
            importedSymbols.push(importedName);
          }
        }

        imports.push({
          sourceFile: normPath,
          moduleSpecifier,
          importedSymbols,
          isDefault,
          isNamespace,
          line: node.loc?.start.line || 1
        });
      },

      // 2. Functions
      FunctionDeclaration(pathObj: NodePath<t.FunctionDeclaration>) {
        const node = pathObj.node;
        if (!node.id) return;
        const name = node.id.name;
        const startLine = node.loc?.start.line || 1;
        const endLine = node.loc?.end.line || startLine;
        const isExported =
          t.isExportNamedDeclaration(pathObj.parent) ||
          t.isExportDefaultDeclaration(pathObj.parent);

        // Check if React component (starts with uppercase)
        const isComponent = /^[A-Z][A-Za-z0-9]*$/.test(name);
        const isHook = /^use[A-Z][A-Za-z0-9]*$/.test(name);
        const symbolKind: SymbolKind = isComponent ? 'component' : isHook ? 'hook' : 'function';

        symbols.push({
          urn: createSymbolUrn(normPath, name),
          kind: 'symbol',
          symbolKind,
          name,
          path: normPath,
          status: 'active',
          aliases: [],
          startLine,
          endLine,
          startCol: node.loc?.start.column,
          endCol: node.loc?.end.column,
          contentHash: getSliceHash(startLine, endLine),
          isExported,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // Next.js App Router handler export
        if (isNextAppRoute && isExported && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(name)) {
          routes.push({
            urn: createRouteUrn(normPath, name, nextRoutePrefix),
            kind: 'route',
            name: `${name} ${nextRoutePrefix}`,
            path: normPath,
            status: 'active',
            aliases: [],
            httpMethod: name as any,
            routePath: nextRoutePrefix,
            startLine,
            endLine,
            handlerSymbol: name,
            metadata: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      },

      // 3. Classes
      ClassDeclaration(pathObj: NodePath<t.ClassDeclaration>) {
        const node = pathObj.node;
        if (!node.id) return;
        const className = node.id.name;
        const classStart = node.loc?.start.line || 1;
        const classEnd = node.loc?.end.line || classStart;
        const isExported =
          t.isExportNamedDeclaration(pathObj.parent) ||
          t.isExportDefaultDeclaration(pathObj.parent);

        symbols.push({
          urn: createSymbolUrn(normPath, className),
          kind: 'symbol',
          symbolKind: 'class',
          name: className,
          path: normPath,
          status: 'active',
          aliases: [],
          startLine: classStart,
          endLine: classEnd,
          contentHash: getSliceHash(classStart, classEnd),
          isExported,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // Extract class methods
        for (const member of node.body.body) {
          if (t.isClassMethod(member) && t.isIdentifier(member.key)) {
            const methodName = member.key.name;
            const mStart = member.loc?.start.line || classStart;
            const mEnd = member.loc?.end.line || mStart;

            symbols.push({
              urn: createSymbolUrn(normPath, methodName, className),
              kind: 'symbol',
              symbolKind: 'method',
              name: methodName,
              path: normPath,
              status: 'active',
              aliases: [],
              enclosingScope: className,
              startLine: mStart,
              endLine: mEnd,
              contentHash: getSliceHash(mStart, mEnd),
              isExported,
              metadata: {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
      },

      // 4. Variables / Arrow functions
      VariableDeclaration(pathObj: NodePath<t.VariableDeclaration>) {
        const isExported = t.isExportNamedDeclaration(pathObj.parent);
        for (const decl of pathObj.node.declarations) {
          if (t.isIdentifier(decl.id)) {
            const name = decl.id.name;
            const startLine = decl.loc?.start.line || 1;
            const endLine = decl.loc?.end.line || startLine;

            let symbolKind: SymbolKind = 'variable';
            if (t.isArrowFunctionExpression(decl.init) || t.isFunctionExpression(decl.init)) {
              if (/^[A-Z][A-Za-z0-9]*$/.test(name)) {
                symbolKind = 'component';
              } else if (/^use[A-Z][A-Za-z0-9]*$/.test(name)) {
                symbolKind = 'hook';
              } else {
                symbolKind = 'function';
              }
            }

            symbols.push({
              urn: createSymbolUrn(normPath, name),
              kind: 'symbol',
              symbolKind,
              name,
              path: normPath,
              status: 'active',
              aliases: [],
              startLine,
              endLine,
              contentHash: getSliceHash(startLine, endLine),
              isExported,
              metadata: {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });

            // Next.js App Router const GET = async () => ...
            if (isNextAppRoute && isExported && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(name)) {
              routes.push({
                urn: createRouteUrn(normPath, name, nextRoutePrefix),
                kind: 'route',
                name: `${name} ${nextRoutePrefix}`,
                path: normPath,
                status: 'active',
                aliases: [],
                httpMethod: name as any,
                routePath: nextRoutePrefix,
                startLine,
                endLine,
                handlerSymbol: name,
                metadata: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            }
          }
        }
      },

      // 5. Interfaces and Type Aliases
      TSInterfaceDeclaration(pathObj: NodePath<t.TSInterfaceDeclaration>) {
        const node = pathObj.node;
        const name = node.id.name;
        const startLine = node.loc?.start.line || 1;
        const endLine = node.loc?.end.line || startLine;

        symbols.push({
          urn: createSymbolUrn(normPath, name),
          kind: 'symbol',
          symbolKind: 'interface',
          name,
          path: normPath,
          status: 'active',
          aliases: [],
          startLine,
          endLine,
          contentHash: getSliceHash(startLine, endLine),
          isExported: t.isExportNamedDeclaration(pathObj.parent),
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      },

      TSTypeAliasDeclaration(pathObj: NodePath<t.TSTypeAliasDeclaration>) {
        const node = pathObj.node;
        const name = node.id.name;
        const startLine = node.loc?.start.line || 1;
        const endLine = node.loc?.end.line || startLine;

        symbols.push({
          urn: createSymbolUrn(normPath, name),
          kind: 'symbol',
          symbolKind: 'type',
          name,
          path: normPath,
          status: 'active',
          aliases: [],
          startLine,
          endLine,
          contentHash: getSliceHash(startLine, endLine),
          isExported: t.isExportNamedDeclaration(pathObj.parent),
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      },

      // 6. Express / Fastify Routes: app.get('/api/...', ...), router.post(...)
      CallExpression(pathObj: NodePath<t.CallExpression>) {
        const node = pathObj.node;
        const startLine = node.loc?.start.line || 1;
        const endLine = node.loc?.end.line || startLine;

        // Route calls: router.get('/path', handler)
        if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.property)) {
          const method = node.callee.property.name.toUpperCase();
          const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'USE', 'ALL'];

          if (validMethods.includes(method) && node.arguments.length >= 1) {
            const firstArg = node.arguments[0];
            if (t.isStringLiteral(firstArg) && firstArg.value.startsWith('/')) {
              const routePath = firstArg.value;
              routes.push({
                urn: createRouteUrn(normPath, method, routePath),
                kind: 'route',
                name: `${method} ${routePath}`,
                path: normPath,
                status: 'active',
                aliases: [],
                httpMethod: method as any,
                routePath,
                startLine,
                endLine,
                metadata: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            }
          }

          // General method calls: someObj.someMethod()
          const objName = t.isIdentifier(node.callee.object) ? node.callee.object.name : '';
          const propName = node.callee.property.name;
          const calleeName = objName ? `${objName}.${propName}` : propName;
          calls.push({ calleeName, line: startLine });
        } else if (t.isIdentifier(node.callee)) {
          // Direct function calls: callee()
          const calleeName = node.callee.name;
          calls.push({ calleeName, line: startLine });

          // Test Detection: describe('...', () => {}), it('...', () => {}), test('...', () => {})
          if (['describe', 'suite'].includes(calleeName) && node.arguments.length >= 1) {
            const firstArg = node.arguments[0];
            const suiteName = t.isStringLiteral(firstArg) ? firstArg.value : 'Test Suite';
            tests.push({
              urn: createTestUrn(normPath, suiteName),
              kind: 'test',
              name: suiteName,
              path: normPath,
              status: 'active',
              aliases: [],
              testType: 'suite',
              suiteName,
              testName: suiteName,
              startLine,
              endLine,
              metadata: {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          } else if (['it', 'test'].includes(calleeName) && node.arguments.length >= 1) {
            const firstArg = node.arguments[0];
            const testName = t.isStringLiteral(firstArg) ? firstArg.value : 'Test Case';
            tests.push({
              urn: createTestUrn(normPath, testName),
              kind: 'test',
              name: testName,
              path: normPath,
              status: 'active',
              aliases: [],
              testType: 'case',
              testName,
              startLine,
              endLine,
              metadata: {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
    });

    return {
      filePath: normPath,
      symbols,
      routes,
      models: [],
      tests,
      imports,
      calls
    };
  }
}
