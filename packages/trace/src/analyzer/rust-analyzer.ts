// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import crypto from 'node:crypto';
import type { LanguageAnalyzer, StructuralFacts, ModuleImport, SymbolCall } from './base.js';
import type { SymbolNode, RouteNode, TestNode } from '../core/types.js';
import { createSymbolUrn, createRouteUrn, createTestUrn, normalizeRepoPath } from '../core/urn.js';

const FN_RE = /^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?(?:extern\s+"[^"]*"\s+)?fn\s+([A-Za-z_]\w*)/;
const STRUCT_RE = /^(?:pub(?:\([^)]*\))?\s+)?struct\s+([A-Za-z_]\w*)/;
const ENUM_RE = /^(?:pub(?:\([^)]*\))?\s+)?enum\s+([A-Za-z_]\w*)/;
const TRAIT_RE = /^(?:pub(?:\([^)]*\))?\s+)?trait\s+([A-Za-z_]\w*)/;
const IMPL_RE = /^impl(?:\s*<[^>]*>)?\s+(?:([A-Za-z_]\w*)\s+for\s+)?([A-Za-z_]\w*)/;
const CONST_RE = /^(?:pub(?:\([^)]*\))?\s+)?(?:const|static)\s+([A-Z_][A-Z0-9_]*)\s*:/;
const USE_RE = /^use\s+([^;]+);/;
const CALL_RE = /([A-Za-z_][\w:]*)\s*\(/g;

/** axum/actix: .route("/path", get(handler)) or #[get("/path")]. */
const AXUM_ROUTE_RE = /\.route\(\s*"([^"]+)"\s*,\s*(get|post|put|delete|patch)\(\s*([\w:]+)/;
const ACTIX_ATTR_RE = /^#\[(get|post|put|delete|patch)\(\s*"([^"]+)"/;

const RUST_BUILTINS = new Set([
  'if', 'for', 'while', 'match', 'return', 'let', 'fn', 'impl', 'struct', 'enum',
  'println', 'print', 'format', 'write', 'writeln', 'vec', 'panic', 'assert',
  'assert_eq', 'assert_ne', 'unwrap', 'expect', 'clone', 'to_string', 'into',
  'from', 'new', 'iter', 'collect', 'map', 'filter', 'len', 'push', 'insert',
  'get', 'Some', 'None', 'Ok', 'Err', 'String', 'Vec', 'Box', 'Arc', 'Rc'
]);

/**
 * Structural analyzer for Rust. Pattern-based for the same reason as Python and
 * Go: a real parse means pulling in a native toolchain, and TRACE's contract is
 * that it runs offline with none. Extracts declarations, `use` imports, call
 * edges attributed to the enclosing fn, axum/actix routes, and #[test] cases.
 */
export class RustAnalyzer implements LanguageAnalyzer {
  readonly id = 'rust';
  readonly name = 'Rust';
  readonly supportedExtensions = ['.rs'];

  canAnalyze(filePath: string): boolean {
    return filePath.endsWith('.rs');
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

    /** Finds the end of a brace-delimited block by counting depth. */
    const blockEnd = (startIdx: number): number => {
      let depth = 0;
      let opened = false;
      for (let i = startIdx; i < lines.length; i++) {
        const text = lines[i] ?? '';
        for (const ch of text) {
          if (ch === '{') {
            depth++;
            opened = true;
          } else if (ch === '}') {
            depth--;
            if (opened && depth === 0) return i + 1;
          }
        }
        if (opened && depth === 0) return i + 1;
      }
      return lines.length;
    };

    let currentImpl: string | undefined;
    let implEnd = 0;
    let currentFnUrn: string | undefined;
    let currentFnEnd = 0;
    let pendingTest = false;
    let pendingRoute: { method: string; routePath: string; line: number } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i] ?? '';
      const line = raw.trim();
      const lineNo = i + 1;
      if (!line || line.startsWith('//')) continue;

      if (lineNo > implEnd) currentImpl = undefined;
      if (lineNo > currentFnEnd) currentFnUrn = undefined;

      // --- Attributes: #[test], #[get("/path")] ---
      if (line.startsWith('#[')) {
        if (/#\[(?:tokio::)?test\]/.test(line)) pendingTest = true;
        const actix = line.match(ACTIX_ATTR_RE);
        if (actix) {
          pendingRoute = { method: actix[1]!.toUpperCase(), routePath: actix[2]!, line: lineNo };
        }
        continue;
      }

      // --- use statements ---
      const useMatch = line.match(USE_RE);
      if (useMatch) {
        const spec = useMatch[1]!.trim();
        // use crate::auth::{verify_credentials, login_user};
        const braced = spec.match(/^(.*?)::\{(.+)\}$/);
        if (braced) {
          const base = braced[1]!.trim();
          const names = braced[2]!
            .split(',')
            .map((s) => s.trim().split(/\s+as\s+/)[0]!.trim())
            .filter(Boolean);
          imports.push({
            sourceFile: normPath,
            moduleSpecifier: base.replace(/::/g, '/'),
            importedSymbols: names,
            isDefault: false,
            isNamespace: false,
            line: lineNo
          });
        } else {
          const parts = spec.split('::');
          const last = parts.pop()!.trim();
          imports.push({
            sourceFile: normPath,
            moduleSpecifier: parts.join('/'),
            importedSymbols: last === '*' ? [] : [last],
            isDefault: false,
            isNamespace: last === '*',
            line: lineNo
          });
        }
        continue;
      }

      // --- impl blocks give methods their receiver type ---
      const implMatch = line.match(IMPL_RE);
      if (implMatch) {
        currentImpl = implMatch[2];
        implEnd = blockEnd(i);
        continue;
      }

      // --- Functions and methods ---
      const fnMatch = line.match(FN_RE);
      if (fnMatch) {
        const name = fnMatch[1]!;
        const endLine = blockEnd(i);
        const urn = createSymbolUrn(normPath, name, currentImpl);
        symbols.push({
          urn,
          kind: 'symbol',
          symbolKind: currentImpl ? 'method' : 'function',
          name,
          path: normPath,
          status: 'active',
          aliases: [],
          startLine: lineNo,
          endLine,
          contentHash: sliceHash(lineNo, endLine),
          isExported: line.startsWith('pub'),
          enclosingScope: currentImpl,
          metadata: {},
          createdAt: now,
          updatedAt: now
        });
        currentFnUrn = urn;
        currentFnEnd = endLine;

        if (pendingTest) {
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
          pendingTest = false;
        }

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
        continue;
      }

      // --- Types ---
      const typeMatch = line.match(STRUCT_RE) || line.match(ENUM_RE) || line.match(TRAIT_RE);
      if (typeMatch) {
        const name = typeMatch[1]!;
        const endLine = line.includes(';') ? lineNo : blockEnd(i);
        symbols.push({
          urn: createSymbolUrn(normPath, name),
          kind: 'symbol',
          symbolKind: TRAIT_RE.test(line) ? 'interface' : 'class',
          name,
          path: normPath,
          status: 'active',
          aliases: [],
          startLine: lineNo,
          endLine,
          contentHash: sliceHash(lineNo, endLine),
          isExported: line.startsWith('pub'),
          metadata: {},
          createdAt: now,
          updatedAt: now
        });
        continue;
      }

      // --- Constants ---
      const constMatch = line.match(CONST_RE);
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
          isExported: line.startsWith('pub'),
          metadata: {},
          createdAt: now,
          updatedAt: now
        });
      }

      // --- axum-style route registration ---
      const axum = line.match(AXUM_ROUTE_RE);
      if (axum) {
        const [, routePath, verb, handler] = axum;
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
          handlerSymbol: handler!.split('::').pop(),
          metadata: {},
          createdAt: now,
          updatedAt: now
        });
      }

      // --- Calls, attributed to the enclosing fn ---
      CALL_RE.lastIndex = 0;
      let callMatch: RegExpExecArray | null;
      while ((callMatch = CALL_RE.exec(line)) !== null) {
        const rawName = callMatch[1]!;
        const calleeName = rawName.includes('::') ? rawName.split('::').pop()! : rawName;
        if (!calleeName || RUST_BUILTINS.has(calleeName) || RUST_BUILTINS.has(rawName)) continue;
        if (calleeName.endsWith('!')) continue;
        calls.push({ calleeName, line: lineNo, callerUrn: currentFnUrn });
      }
    }

    return { filePath: normPath, symbols, routes, models: [], tests, imports, calls };
  }
}
