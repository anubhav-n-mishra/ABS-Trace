// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import crypto from 'node:crypto';
import type { LanguageAnalyzer, StructuralFacts, ModuleImport, SymbolCall } from './base.js';
import type { SymbolNode, RouteNode, TestNode } from '../core/types.js';
import { createSymbolUrn, createRouteUrn, createTestUrn, normalizeRepoPath } from '../core/urn.js';

/** func (r *Repo) Save(...) — a method with a receiver. */
const METHOD_RE = /^func\s*\(\s*\w+\s+\*?([A-Za-z_]\w*)\s*\)\s*([A-Za-z_]\w*)\s*\(/;
/** func DoThing(...) — a plain function. */
const FUNC_RE = /^func\s+([A-Za-z_]\w*)\s*\(/;
const TYPE_RE = /^type\s+([A-Za-z_]\w*)\s+(struct|interface)\b/;
const CONST_VAR_RE = /^(?:const|var)\s+([A-Za-z_]\w*)\s*(?:[A-Za-z_*\[\]]+\s*)?=/;
const CALL_RE = /([A-Za-z_][\w.]*)\s*\(/g;

/** net/http: http.HandleFunc("/path", handler) or mux.HandleFunc(...). */
const HANDLE_FUNC_RE = /\b\w*\.?HandleFunc\(\s*"([^"]+)"\s*,\s*([\w.]+)/;
/** chi / gin / echo: r.Get("/path", handler), router.POST("/path", handler). */
const VERB_ROUTE_RE = /\b\w+\.(Get|Post|Put|Delete|Patch|GET|POST|PUT|DELETE|PATCH)\(\s*"([^"]+)"\s*,\s*([\w.]+)/;

const GO_BUILTINS = new Set([
  'if', 'for', 'switch', 'return', 'go', 'defer', 'func', 'make', 'new', 'len',
  'cap', 'append', 'copy', 'delete', 'panic', 'recover', 'print', 'println',
  'string', 'int', 'int64', 'float64', 'bool', 'byte', 'rune', 'error', 'range'
]);

/**
 * Structural analyzer for Go. Like the Python analyzer this is a pattern-based
 * reader rather than a full parser: Go's brace-delimited, one-declaration-per-
 * line style makes declarations, imports, calls and route registrations
 * reliably extractable without pulling in a native toolchain.
 */
export class GoAnalyzer implements LanguageAnalyzer {
  readonly id = 'go';
  readonly name = 'Go';
  readonly supportedExtensions = ['.go'];

  canAnalyze(filePath: string): boolean {
    return filePath.endsWith('.go');
  }

  async extractStructuralFacts(fileContent: string, filePath: string): Promise<StructuralFacts> {
    const normPath = normalizeRepoPath(filePath);
    const lines = fileContent.split('\n');
    const now = new Date().toISOString();

    const symbols: SymbolNode[] = [];
    const routes: RouteNode[] = [];
    const tests: TestNode[] = [];
    const imports: ModuleImport[] = [];
    const calls: SymbolCall[] = [];

    const sliceHash = (start: number, end: number) =>
      crypto.createHash('sha256').update(lines.slice(start - 1, end).join('\n')).digest('hex').slice(0, 16);

    /** A top-level block ends at the first line that is exactly a closing brace. */
    const blockEnd = (startIdx: number): number => {
      for (let i = startIdx + 1; i < lines.length; i++) {
        if (/^\}/.test(lines[i] ?? '')) return i + 1;
      }
      return lines.length;
    };

    let inImportBlock = false;
    let currentFuncUrn: string | undefined;
    let currentFuncEnd = 0;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i] ?? '';
      const line = raw.trim();
      const lineNo = i + 1;
      if (!line || line.startsWith('//')) continue;

      if (lineNo > currentFuncEnd) currentFuncUrn = undefined;

      // --- Imports (single and grouped) ---
      if (line.startsWith('import (')) {
        inImportBlock = true;
        continue;
      }
      if (inImportBlock) {
        if (line === ')') {
          inImportBlock = false;
          continue;
        }
        const spec = line.match(/"([^"]+)"/);
        if (spec) {
          imports.push({
            sourceFile: normPath,
            moduleSpecifier: spec[1]!,
            importedSymbols: [],
            isDefault: false,
            isNamespace: true,
            line: lineNo
          });
        }
        continue;
      }
      const singleImport = line.match(/^import\s+(?:\w+\s+)?"([^"]+)"/);
      if (singleImport) {
        imports.push({
          sourceFile: normPath,
          moduleSpecifier: singleImport[1]!,
          importedSymbols: [],
          isDefault: false,
          isNamespace: true,
          line: lineNo
        });
        continue;
      }

      // --- Methods with receivers ---
      const methodMatch = line.match(METHOD_RE);
      if (methodMatch) {
        const [, receiver, name] = methodMatch;
        const endLine = blockEnd(i);
        const urn = createSymbolUrn(normPath, name!, receiver);
        symbols.push({
          urn,
          kind: 'symbol',
          symbolKind: 'method',
          name: name!,
          path: normPath,
          status: 'active',
          aliases: [],
          startLine: lineNo,
          endLine,
          contentHash: sliceHash(lineNo, endLine),
          isExported: /^[A-Z]/.test(name!),
          enclosingScope: receiver,
          metadata: {},
          createdAt: now,
          updatedAt: now
        });
        currentFuncUrn = urn;
        currentFuncEnd = endLine;
        continue;
      }

      // --- Plain functions ---
      const funcMatch = line.match(FUNC_RE);
      if (funcMatch) {
        const name = funcMatch[1]!;
        const endLine = blockEnd(i);
        const urn = createSymbolUrn(normPath, name);
        symbols.push({
          urn,
          kind: 'symbol',
          symbolKind: 'function',
          name,
          path: normPath,
          status: 'active',
          aliases: [],
          startLine: lineNo,
          endLine,
          contentHash: sliceHash(lineNo, endLine),
          isExported: /^[A-Z]/.test(name),
          metadata: {},
          createdAt: now,
          updatedAt: now
        });
        currentFuncUrn = urn;
        currentFuncEnd = endLine;

        if (/^Test[A-Z_]/.test(name) && normPath.endsWith('_test.go')) {
          tests.push({
            urn: createTestUrn(normPath, name),
            kind: 'test',
            name,
            path: normPath,
            status: 'active',
            aliases: [],
            startLine: lineNo,
            endLine,
            testType: 'case',
            testName: name,
            metadata: {},
            createdAt: now,
            updatedAt: now
          });
        }
        continue;
      }

      // --- Structs and interfaces ---
      const typeMatch = line.match(TYPE_RE);
      if (typeMatch) {
        const [, name, kind] = typeMatch;
        const endLine = blockEnd(i);
        symbols.push({
          urn: createSymbolUrn(normPath, name!),
          kind: 'symbol',
          symbolKind: kind === 'interface' ? 'interface' : 'class',
          name: name!,
          path: normPath,
          status: 'active',
          aliases: [],
          startLine: lineNo,
          endLine,
          contentHash: sliceHash(lineNo, endLine),
          isExported: /^[A-Z]/.test(name!),
          metadata: {},
          createdAt: now,
          updatedAt: now
        });
        continue;
      }

      // --- Package-level constants and vars ---
      if (!raw.startsWith('\t') && !raw.startsWith(' ')) {
        const constMatch = line.match(CONST_VAR_RE);
        if (constMatch) {
          const name = constMatch[1]!;
          symbols.push({
            urn: createSymbolUrn(normPath, name),
            kind: 'symbol',
            symbolKind: 'variable',
            name,
            path: normPath,
            status: 'active',
            aliases: [],
            startLine: lineNo,
            endLine: lineNo,
            contentHash: sliceHash(lineNo, lineNo),
            isExported: /^[A-Z]/.test(name),
            metadata: {},
            createdAt: now,
            updatedAt: now
          });
        }
      }

      // --- Route registrations ---
      const handleFunc = line.match(HANDLE_FUNC_RE);
      if (handleFunc) {
        const [, routePath, handler] = handleFunc;
        routes.push({
          urn: createRouteUrn(normPath, 'ALL', routePath!),
          kind: 'route',
          name: `ALL ${routePath}`,
          path: normPath,
          status: 'active',
          aliases: [],
          httpMethod: 'ALL',
          routePath: routePath!,
          startLine: lineNo,
          endLine: lineNo,
          handlerSymbol: handler!.split('.').pop(),
          metadata: {},
          createdAt: now,
          updatedAt: now
        });
      } else {
        const verbRoute = line.match(VERB_ROUTE_RE);
        if (verbRoute) {
          const [, verb, routePath, handler] = verbRoute;
          const method = verb!.toUpperCase() as RouteNode['httpMethod'];
          routes.push({
            urn: createRouteUrn(normPath, method, routePath!),
            kind: 'route',
            name: `${method} ${routePath}`,
            path: normPath,
            status: 'active',
            aliases: [],
            httpMethod: method,
            routePath: routePath!,
            startLine: lineNo,
            endLine: lineNo,
            handlerSymbol: handler!.split('.').pop(),
            metadata: {},
            createdAt: now,
            updatedAt: now
          });
        }
      }

      // --- Calls, attributed to the enclosing function ---
      CALL_RE.lastIndex = 0;
      let callMatch: RegExpExecArray | null;
      while ((callMatch = CALL_RE.exec(line)) !== null) {
        const rawName = callMatch[1]!;
        const calleeName = rawName.includes('.') ? rawName.split('.').pop()! : rawName;
        if (!calleeName || GO_BUILTINS.has(calleeName) || GO_BUILTINS.has(rawName)) continue;
        calls.push({ calleeName, line: lineNo, callerUrn: currentFuncUrn });
      }
    }

    return { filePath: normPath, symbols, routes, models: [], tests, imports, calls };
  }
}
