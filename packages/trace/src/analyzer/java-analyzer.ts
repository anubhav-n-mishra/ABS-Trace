// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import crypto from 'node:crypto';
import type { LanguageAnalyzer, StructuralFacts, ModuleImport, SymbolCall } from './base.js';
import type { SymbolNode, RouteNode, TestNode } from '../core/types.js';
import { createSymbolUrn, createRouteUrn, createTestUrn, normalizeRepoPath } from '../core/urn.js';

const MODIFIERS = '(?:public|private|protected|static|final|abstract|synchronized|native|default)';
const CLASS_RE = new RegExp(`^(?:${MODIFIERS}\\s+)*(class|interface|enum|record)\\s+([A-Za-z_]\\w*)`);
const METHOD_RE = new RegExp(
  `^(?:${MODIFIERS}\\s+)*(?:<[^>]+>\\s*)?[A-Za-z_][\\w.<>\\[\\],\\s?]*\\s+([A-Za-z_]\\w*)\\s*\\(`
);
const FIELD_RE = new RegExp(
  `^(?:${MODIFIERS}\\s+)*(?:static\\s+)?(?:final\\s+)?[A-Za-z_][\\w.<>\\[\\]]*\\s+([A-Z_][A-Z0-9_]*)\\s*=`
);
const IMPORT_RE = /^import\s+(?:static\s+)?([\w.]+(?:\.\*)?)\s*;/;
const CALL_RE = /([A-Za-z_][\w.]*)\s*\(/g;

/** Spring: @GetMapping("/path"), @RequestMapping(value = "/path", method = ...). */
const MAPPING_RE = /@(Get|Post|Put|Delete|Patch|Request)Mapping\s*\(\s*(?:value\s*=\s*)?"([^"]*)"/;
const CLASS_MAPPING_RE = /@RequestMapping\s*\(\s*(?:value\s*=\s*)?"([^"]*)"/;

const JAVA_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'new', 'super', 'this',
  'try', 'synchronized', 'assert', 'throw', 'println', 'print', 'printf',
  'valueOf', 'toString', 'equals', 'hashCode', 'length', 'size', 'get', 'add',
  'put', 'format', 'of', 'stream', 'map', 'filter', 'collect', 'forEach'
]);

/**
 * Structural analyzer for Java. Pattern-based, consistent with the Python, Go
 * and Rust analyzers: declarations, imports, call edges attributed to the
 * enclosing method, Spring request mappings, and JUnit tests — without
 * requiring a JDK or a native parser at index time.
 */
export class JavaAnalyzer implements LanguageAnalyzer {
  readonly id = 'java';
  readonly name = 'Java';
  readonly supportedExtensions = ['.java'];

  canAnalyze(filePath: string): boolean {
    return filePath.endsWith('.java');
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
      }
      return lines.length;
    };

    let currentClass: string | undefined;
    let classEnd = 0;
    let currentMethodUrn: string | undefined;
    let currentMethodEnd = 0;
    let pendingTest = false;
    let pendingRoute: { method: string; routePath: string; line: number } | null = null;
    let classRoutePrefix = '';
    let pendingClassPrefix = '';

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i] ?? '';
      const line = raw.trim();
      const lineNo = i + 1;
      if (!line || line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue;

      if (lineNo > classEnd) {
        currentClass = undefined;
        classRoutePrefix = '';
      }
      if (lineNo > currentMethodEnd) currentMethodUrn = undefined;

      // --- Annotations ---
      if (line.startsWith('@')) {
        if (/@Test\b|@ParameterizedTest\b/.test(line)) pendingTest = true;
        const mapping = line.match(MAPPING_RE);
        if (mapping) {
          const verb = mapping[1]!;
          const method = verb === 'Request' ? 'ALL' : verb.toUpperCase();
          if (verb === 'Request' && !currentClass) {
            // Annotations precede the class they decorate, so a bare
            // @RequestMapping here is the controller-wide path prefix.
            const classMapping = line.match(CLASS_MAPPING_RE);
            if (classMapping) pendingClassPrefix = classMapping[1]!;
          } else {
            pendingRoute = { method, routePath: mapping[2]!, line: lineNo };
          }
        }
        continue;
      }

      // --- Imports ---
      const importMatch = line.match(IMPORT_RE);
      if (importMatch) {
        const spec = importMatch[1]!;
        const isWildcard = spec.endsWith('.*');
        const parts = spec.replace(/\.\*$/, '').split('.');
        const typeName = parts[parts.length - 1]!;
        imports.push({
          sourceFile: normPath,
          moduleSpecifier: spec.replace(/\.\*$/, ''),
          importedSymbols: isWildcard ? [] : [typeName],
          isDefault: false,
          isNamespace: isWildcard,
          line: lineNo
        });
        continue;
      }

      // --- Classes, interfaces, enums, records ---
      const classMatch = line.match(CLASS_RE);
      if (classMatch) {
        const [, kind, name] = classMatch;
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
          isExported: line.includes('public'),
          metadata: {},
          createdAt: now,
          updatedAt: now
        });
        currentClass = name;
        classEnd = endLine;
        classRoutePrefix = pendingClassPrefix;
        pendingClassPrefix = '';
        continue;
      }

      // --- Methods ---
      const methodMatch = line.match(METHOD_RE);
      if (methodMatch && !line.endsWith(';') && currentClass) {
        const name = methodMatch[1]!;
        if (name === currentClass || JAVA_KEYWORDS.has(name)) {
          // Constructor or control-flow keyword, not a declaration worth mapping.
          if (name !== currentClass) continue;
        }
        const endLine = blockEnd(i);
        const urn = createSymbolUrn(normPath, name, currentClass);
        symbols.push({
          urn,
          kind: 'symbol',
          symbolKind: 'method',
          name,
          path: normPath,
          status: 'active',
          aliases: [],
          startLine: lineNo,
          endLine,
          contentHash: sliceHash(lineNo, endLine),
          isExported: line.includes('public'),
          enclosingScope: currentClass,
          metadata: {},
          createdAt: now,
          updatedAt: now
        });
        currentMethodUrn = urn;
        currentMethodEnd = endLine;

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
            suiteName: currentClass,
            metadata: {},
            createdAt: now,
            updatedAt: now
          });
          pendingTest = false;
        }

        if (pendingRoute) {
          const fullPath = (classRoutePrefix + pendingRoute.routePath) || '/';
          routes.push({
            urn: createRouteUrn(normPath, pendingRoute.method, fullPath),
            kind: 'route',
            name: `${pendingRoute.method} ${fullPath}`,
            path: normPath,
            status: 'active',
            aliases: [],
            httpMethod: pendingRoute.method as RouteNode['httpMethod'],
            routePath: fullPath,
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

      // --- Constant fields ---
      const fieldMatch = line.match(FIELD_RE);
      if (fieldMatch) {
        const name = fieldMatch[1]!;
        symbols.push({
          urn: createSymbolUrn(normPath, name, currentClass),
          kind: 'symbol',
          symbolKind: 'variable',
          name,
          path: normPath,
          status: 'active',
          aliases: [],
          startLine: lineNo,
          endLine: lineNo,
          contentHash: sliceHash(lineNo, lineNo),
          isExported: line.includes('public'),
          enclosingScope: currentClass,
          metadata: {},
          createdAt: now,
          updatedAt: now
        });
      }

      // --- Calls, attributed to the enclosing method ---
      CALL_RE.lastIndex = 0;
      let callMatch: RegExpExecArray | null;
      while ((callMatch = CALL_RE.exec(line)) !== null) {
        const rawName = callMatch[1]!;
        const calleeName = rawName.includes('.') ? rawName.split('.').pop()! : rawName;
        if (!calleeName || JAVA_KEYWORDS.has(calleeName) || JAVA_KEYWORDS.has(rawName)) continue;
        calls.push({ calleeName, line: lineNo, callerUrn: currentMethodUrn });
      }
    }

    return { filePath: normPath, symbols, routes, models: [], tests, imports, calls };
  }
}
