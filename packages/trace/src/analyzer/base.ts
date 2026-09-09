// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import type {
  SymbolNode,
  RouteNode,
  ModelNode,
  TestNode
} from '../core/types.js';

export interface ModuleImport {
  sourceFile: string;
  moduleSpecifier: string; // e.g. './payment.js' or 'stripe'
  importedSymbols: string[]; // e.g. ['processUPIPayment']
  isDefault: boolean;
  isNamespace: boolean;
  line: number;
}

export interface SymbolCall {
  callerUrn?: string;
  calleeName: string; // e.g. 'processUPIPayment' or 'paymentService.processUPIPayment'
  line: number;
}

export interface StructuralFacts {
  filePath: string;
  symbols: SymbolNode[];
  routes: RouteNode[];
  models: ModelNode[];
  tests: TestNode[];
  imports: ModuleImport[];
  calls: SymbolCall[];
}

export interface LanguageAnalyzer {
  readonly id: string;
  readonly name: string;
  readonly supportedExtensions: string[];

  canAnalyze(filePath: string): boolean;
  extractStructuralFacts(fileContent: string, filePath: string): Promise<StructuralFacts>;
}
