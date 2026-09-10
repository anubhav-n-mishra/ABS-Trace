// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import crypto from 'node:crypto';
import type { LanguageAnalyzer, StructuralFacts, ModuleImport, SymbolCall } from './base.js';
import type { SymbolNode, RouteNode, TestNode, SymbolKind } from '../core/types.js';
import { createSymbolUrn, createRouteUrn, createTestUrn, normalizeRepoPath } from '../core/urn.js';

const DEF_RE = /^(\s*)(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/;
const CLASS_RE = /^(\s*)class\s+([A-Za-z_]\w*)\s*[:(]/;
const ASSIGN_RE = /^([A-Za-z_]\w*)\s*(?::[^=]+)?=\s*[^=]/;
const IMPORT_RE = /^\s*import\s+(.+)$/;
const FROM_IMPORT_RE = /^\s*from\s+([.\w]+)\s+import\s+(.+)$/;
const CALL_RE = /([A-Za-z_][\w.]*)\s*\(/g;

/** Decorator route forms: @app.route('/x'), @app.get('/x'), @router.post("/x"). */
const DECORATOR_ROUTE_RE = /^\s*@(\w+)\.(route|get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]([^)]*)\)/;
/** Django urls.py: path('users/', view) or re_path(r'^users/$', view). */
const DJANGO_PATH_RE = /^\s*(?:re_)?path\(\s*r?['"]([^'"]+)['"]\s*,\s*([\w.]+)/;

const CALL_KEYWORDS = new Set([
  'if', 'elif', 'while', 'for', 'return', 'yield', 'assert', 'with', 'except',
  'print', 'len', 'str', 'int', 'float', 'bool', 'list', 'dict', 'set', 'tuple',
  'range', 'enumerate', 'zip', 'open', 'super', 'isinstance', 'type', 'sorted',
  'min', 'max', 'sum', 'any', 'all', 'map', 'filter', 'format', 'repr', 'hash',
  'getattr', 'setattr', 'hasattr', 'staticmethod', 'classmethod', 'property'
]);

interface Scope {
  indent: number;
  name: string;
  kind: 'class' | 'def';
  urn: string;
}

/**
 * Structural analyzer for Python. This is a deliberate indentation-and-pattern
 * parser rather than a full AST: TRACE only needs declarations, imports, call
 * edges, routes and tests, and shipping a real Python AST would mean either a
 * native tree-sitter dependency or a Python runtime, both of which break the
 * zero-dependency, air-gapped guarantee. Findings from this analyzer are
 * structural facts, not type-resolved semantics.
 */
export class PythonAnalyzer implements LanguageAnalyzer {
  readonly id = 'python';
  readonly name = 'Python';
  readonly supportedExtensions = ['.py'];

  canAnalyze(filePath: string): boolean {
    return filePath.endsWith('.py');
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

    const isTestFile = /(^|\/)test_[^/]*\.py$|_test\.py$/.test(normPath);

    const sliceHash = (start: number, end: number) =>
      crypto.createHash('sha256').update(lines.slice(start - 1, end).join('\n')).digest('hex').slice(0, 16);

    /** A block ends at the next non-blank line indented no deeper than its header. */
    const blockEnd = (startIdx: number, indent: number): number => {
      for (let i = startIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line || !line.trim() || line.trim().startsWith('#')) continue;
        const lineIndent = line.length - line.trimStart().length;
        if (lineIndent <= indent) return i;
      }
      return lines.length;
    };

    const scopes: Scope[] = [];
    let pendingRoute: { method: string; routePath: string; line: number } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineNo = i + 1;
      const trimmed = line.trim();
      if (!trimmed) continue;

      const indent = line.length - line.trimStart().length;
      while (scopes.length > 0 && indent <= scopes[scopes.length - 1]!.indent) scopes.pop();

      // --- Imports ---
      const fromMatch = trimmed.match(FROM_IMPORT_RE);
      if (fromMatch) {
        const [, moduleSpecifier, rest] = fromMatch;
        const importedSymbols = rest!
          .replace(/[()]/g, '')
          .split(',')
          .map((s) => s.trim().split(/\s+as\s+/)[0]!.trim())
          .filter(Boolean);
        imports.push({
          sourceFile: normPath,
          moduleSpecifier: moduleSpecifier!,
          importedSymbols,
          isDefault: false,
          isNamespace: importedSymbols.includes('*'),
          line: lineNo
        });
        continue;
      }

      const importMatch = trimmed.match(IMPORT_RE);
      if (importMatch && !trimmed.startsWith('from ')) {
        for (const part of importMatch[1]!.split(',')) {
          const moduleSpecifier = part.trim().split(/\s+as\s+/)[0]!.trim();
          if (!moduleSpecifier) continue;
          imports.push({
            sourceFile: normPath,
            moduleSpecifier,
            importedSymbols: [],
            isDefault: false,
            isNamespace: true,
            line: lineNo
          });
        }
        continue;
      }

      // --- Route decorators (apply to the def that follows) ---
      const decoratorMatch = line.match(DECORATOR_ROUTE_RE);
      if (decoratorMatch) {
        const [, , verb, routePath, tail] = decoratorMatch;
        let method = verb!.toUpperCase();
        if (verb === 'route') {
          const methodsMatch = tail?.match(/methods\s*=\s*\[\s*['"](\w+)['"]/);
          method = methodsMatch ? methodsMatch[1]!.toUpperCase() : 'GET';
        }
        pendingRoute = { method, routePath: routePath!, line: lineNo };
        continue;
      }

      // --- Django URL table ---
      const djangoMatch = line.match(DJANGO_PATH_RE);
      if (djangoMatch) {
        const [, routePath, handler] = djangoMatch;
        const cleanPath = '/' + routePath!.replace(/^\^?\/?/, '').replace(/\$$/, '');
        routes.push({
          urn: createRouteUrn(normPath, 'ALL', cleanPath),
          kind: 'route',
          name: `ALL ${cleanPath}`,
          path: normPath,
          status: 'active',
          aliases: [],
          httpMethod: 'ALL',
          routePath: cleanPath,
          startLine: lineNo,
          endLine: lineNo,
          handlerSymbol: handler,
          metadata: {},
          createdAt: now,
          updatedAt: now
        });
        continue;
      }

      // --- Classes ---
      const classMatch = line.match(CLASS_RE);
      if (classMatch) {
        const name = classMatch[2]!;
        const endLine = blockEnd(i, indent);
        const urn = createSymbolUrn(normPath, name);
        symbols.push({
          urn,
          kind: 'symbol',
          symbolKind: 'class',
          name,
          path: normPath,
          status: 'active',
          aliases: [],
          startLine: lineNo,
          endLine,
          contentHash: sliceHash(lineNo, endLine),
          isExported: !name.startsWith('_'),
          metadata: {},
          createdAt: now,
          updatedAt: now
        });

        if (isTestFile && /^Test/.test(name)) {
          tests.push({
            urn: createTestUrn(normPath, name),
            kind: 'test',
            name,
            path: normPath,
            status: 'active',
            aliases: [],
            startLine: lineNo,
            endLine,
            testType: 'suite',
            testName: name,
            metadata: {},
            createdAt: now,
            updatedAt: now
          });
        }

        scopes.push({ indent, name, kind: 'class', urn });
        continue;
      }

      // --- Functions and methods ---
      const defMatch = line.match(DEF_RE);
      if (defMatch) {
        const name = defMatch[2]!;
        const endLine = blockEnd(i, indent);
        const enclosingClass = [...scopes].reverse().find((s) => s.kind === 'class');
        const symbolKind: SymbolKind = enclosingClass ? 'method' : 'function';
        const urn = createSymbolUrn(normPath, name, enclosingClass?.name);

        symbols.push({
          urn,
          kind: 'symbol',
          symbolKind,
          name,
          path: normPath,
          status: 'active',
          aliases: [],
          startLine: lineNo,
          endLine,
          contentHash: sliceHash(lineNo, endLine),
          isExported: !name.startsWith('_'),
          enclosingScope: enclosingClass?.name,
          metadata: {},
          createdAt: now,
          updatedAt: now
        });

        if (pendingRoute) {
          routes.push({
            urn: createRouteUrn(normPath, pendingRoute.method, pendingRoute.routePath),
            kind: 'route',
            name: `${pendingRoute.method} ${pendingRoute.routePath}`,
            path: normPath,
            status: 'active',
            aliases: [],
            httpMethod: pendingRoute.method as RouteNode['httpMethod'],
            routePath: pendingRoute.routePath,
            startLine: pendingRoute.line,
            endLine,
            handlerSymbol: name,
            metadata: {},
            createdAt: now,
            updatedAt: now
          });
          pendingRoute = null;
        }

        if (name.startsWith('test_')) {
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
            suiteName: enclosingClass?.name,
            metadata: {},
            createdAt: now,
            updatedAt: now
          });
        }

        scopes.push({ indent, name, kind: 'def', urn });
        continue;
      }

      // --- Module-level constants and singletons ---
      if (indent === 0) {
        const assignMatch = trimmed.match(ASSIGN_RE);
        if (assignMatch) {
          const name = assignMatch[1]!;
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
            isExported: !name.startsWith('_'),
            metadata: {},
            createdAt: now,
            updatedAt: now
          });
        }
      }

      // --- Calls, attributed to the innermost enclosing def ---
      if (trimmed.startsWith('#')) continue;
      const enclosingDef = [...scopes].reverse().find((s) => s.kind === 'def');
      CALL_RE.lastIndex = 0;
      let callMatch: RegExpExecArray | null;
      while ((callMatch = CALL_RE.exec(line)) !== null) {
        const raw = callMatch[1]!;
        const calleeName = raw.includes('.') ? raw.split('.').pop()! : raw;
        if (!calleeName || CALL_KEYWORDS.has(calleeName) || CALL_KEYWORDS.has(raw)) continue;
        if (/^(def|class)$/.test(raw)) continue;
        calls.push({ calleeName, line: lineNo, callerUrn: enclosingDef?.urn });
      }
    }

    return { filePath: normPath, symbols, routes, models: [], tests, imports, calls };
  }
}
