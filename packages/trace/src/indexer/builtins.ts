// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import path from 'node:path';

/**
 * Comprehensive set of standard JavaScript, TypeScript, Node.js, and common runtime
 * built-in methods, global properties, and test runner keywords.
 *
 * AST call invocations to these identifiers must NOT be resolved to user-defined symbols
 * in other files to prevent phantom cross-module edges and false-positive cycles.
 */
export const JS_TS_STANDARD_BUILTINS = new Set<string>([
  // Array / Collection prototype methods
  'filter',
  'map',
  'reduce',
  'reduceRight',
  'forEach',
  'slice',
  'splice',
  'push',
  'pop',
  'shift',
  'unshift',
  'includes',
  'indexOf',
  'lastIndexOf',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'some',
  'every',
  'fill',
  'copyWithin',
  'flat',
  'flatMap',
  'sort',
  'reverse',
  'join',
  'keys',
  'values',
  'entries',
  'at',
  'concat',

  // String prototype methods
  'split',
  'replace',
  'replaceAll',
  'match',
  'matchAll',
  'search',
  'trim',
  'trimStart',
  'trimEnd',
  'trimLeft',
  'trimRight',
  'padStart',
  'padEnd',
  'repeat',
  'startsWith',
  'endsWith',
  'toLowerCase',
  'toUpperCase',
  'toLocaleLowerCase',
  'toLocaleUpperCase',
  'charAt',
  'charCodeAt',
  'codePointAt',
  'normalize',
  'localeCompare',

  // Object / Function prototype methods
  'assign',
  'create',
  'freeze',
  'seal',
  'hasOwn',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toString',
  'valueOf',
  'toLocaleString',
  'bind',
  'call',
  'apply',
  'getPrototypeOf',
  'setPrototypeOf',
  'getOwnPropertyNames',
  'getOwnPropertySymbols',
  'getOwnPropertyDescriptor',
  'getOwnPropertyDescriptors',
  'defineProperties',
  'defineProperty',
  'preventExtensions',
  'isExtensible',
  'isFrozen',
  'isSealed',

  // Map / Set / WeakMap / WeakSet methods
  'has',
  'set',
  'get',
  'delete',
  'clear',
  'add',
  'size',

  // Promise / Async methods
  'then',
  'catch',
  'finally',
  'resolve',
  'reject',
  'all',
  'allSettled',
  'race',
  'any',

  // JSON & Math
  'parse',
  'stringify',
  'min',
  'max',
  'floor',
  'ceil',
  'round',
  'abs',
  'random',
  'sqrt',
  'pow',
  'trunc',

  // Console methods
  'log',
  'info',
  'warn',
  'error',
  'debug',
  'trace',
  'dir',
  'dirxml',
  'table',
  'time',
  'timeEnd',
  'timeLog',
  'group',
  'groupCollapsed',
  'groupEnd',
  'count',
  'countReset',
  'assert',
  'profile',
  'profileEnd',

  // Node.js Path / Stream / HTTP / Net methods
  'dirname',
  'basename',
  'extname',
  'relative',
  'resolve',
  'normalize',
  'isAbsolute',
  'format',
  'emit',
  'on',
  'once',
  'off',
  'addListener',
  'removeListener',
  'removeAllListeners',
  'pipe',
  'unpipe',
  'write',
  'end',
  'send',
  'json',
  'status',
  'sendStatus',
  'setHeader',
  'getHeader',
  'writeHead',
  'listen',
  'close',
  'destroy',
  'pause',
  'resume',

  // Common Timers & Globals
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'setImmediate',
  'clearImmediate',
  'fetch',
  'require',
  'import',
  'eval',
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  'encodeURI',
  'encodeURIComponent',
  'decodeURI',
  'decodeURIComponent',

  // Test runners (Vitest, Jest, Mocha)
  'describe',
  'it',
  'test',
  'expect',
  'beforeEach',
  'afterEach',
  'beforeAll',
  'afterAll',
  'suite',
  'setup',
  'teardown',

  // Node.js core module identifiers
  'path',
  'fs',
  'crypto',
  'http',
  'https',
  'url',
  'util',
  'os',
  'events',
  'stream',
  'buffer',
  'process',
  'child_process',
  'cluster',
  'dns',
  'net',
  'tls',
  'readline',
  'zlib',
  'perf_hooks',
  'worker_threads'
]);

/**
 * Checks if an identifier or member function name is a standard JS/TS/Node built-in.
 */
export function isStandardBuiltin(name: string): boolean {
  if (!name) return false;
  const clean = name.includes('.') ? name.split('.').pop()! : name;
  return JS_TS_STANDARD_BUILTINS.has(clean);
}

/**
 * Resolves a module specifier (relative, alias, or file path) to a known repository file path.
 */
export function resolveImportTargetFile(
  currentFilePath: string,
  specifier: string,
  knownFiles: Set<string>
): string | null {
  if (!specifier) return null;

  // 1. Relative import (./ or ../)
  if (specifier.startsWith('.')) {
    const dir = path.posix.dirname(currentFilePath.replace(/\\/g, '/'));
    const candidate = path.posix.normalize(path.posix.join(dir, specifier));
    const extensions = [
      '',
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.mjs',
      '.cjs',
      '/index.ts',
      '/index.tsx',
      '/index.js',
      '/index.jsx'
    ];
    for (const ext of extensions) {
      const full = candidate + ext;
      if (knownFiles.has(full)) return full;
    }
  }

  // 2. Monorepo / Next.js / Vite alias (@/...)
  if (specifier.startsWith('@/')) {
    const trimmed = specifier.slice(2);
    const extensions = [
      '',
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.mjs',
      '.cjs',
      '/index.ts',
      '/index.tsx',
      '/index.js',
      '/index.jsx'
    ];
    for (const ext of extensions) {
      const direct = trimmed + ext;
      if (knownFiles.has(direct)) return direct;
      const withSrc = 'src/' + trimmed + ext;
      if (knownFiles.has(withSrc)) return withSrc;
    }
  }

  // 3. Exact match against known files
  if (knownFiles.has(specifier)) return specifier;

  // 4. Dotted module paths (Python, Java): app.services.auth_service ->
  //    app/services/auth_service.py. Without this, calls in these languages
  //    fall back to matching by bare name, which mislinks same-named functions
  //    living in different packages.
  if (/^[A-Za-z_][\w.]*$/.test(specifier) && specifier.includes('.')) {
    const asPath = specifier.replace(/\./g, '/');
    for (const ext of ['.py', '.java', '/__init__.py']) {
      const full = asPath + ext;
      if (knownFiles.has(full)) return full;
    }
    // Java imports name the type, not the file: com.shop.auth.AuthService
    const javaByType = asPath + '.java';
    if (knownFiles.has(javaByType)) return javaByType;
  }

  // 5. Go package import paths (example.com/mod/internal/auth) name a
  //    directory, not a file. Resolve to any .go file inside that directory.
  if (specifier.includes('/') && !specifier.startsWith('.')) {
    const segments = specifier.split('/');
    for (let start = 0; start < segments.length; start++) {
      const suffix = segments.slice(start).join('/');
      if (!suffix) continue;
      for (const file of knownFiles) {
        if (!file.endsWith('.go')) continue;
        const dir = path.posix.dirname(file);
        if (dir === suffix || dir.endsWith('/' + suffix)) return file;
      }
    }
  }

  return null;
}

/**
 * Go and Python import whole modules rather than individual symbols, so a call
 * resolves against every file in the imported package. Returns all candidate
 * files an import specifier could contribute symbols from.
 */
export function resolveImportTargetFiles(
  currentFilePath: string,
  specifier: string,
  knownFiles: Set<string>
): string[] {
  const single = resolveImportTargetFile(currentFilePath, specifier, knownFiles);
  const results = new Set<string>();
  if (single) results.add(single);

  if (specifier.includes('/') && !specifier.startsWith('.')) {
    const segments = specifier.split('/');
    for (let start = 0; start < segments.length; start++) {
      const suffix = segments.slice(start).join('/');
      if (!suffix) continue;
      let matched = false;
      for (const file of knownFiles) {
        if (!file.endsWith('.go')) continue;
        const dir = path.posix.dirname(file);
        if (dir === suffix || dir.endsWith('/' + suffix)) {
          results.add(file);
          matched = true;
        }
      }
      if (matched) break;
    }
  }

  return Array.from(results);
}
