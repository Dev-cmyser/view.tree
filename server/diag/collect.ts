import $ from 'mol_tree2'
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node'

export type ParseResult = {
  tree: any | null
  diagnostics: Diagnostic[]
}

export function parseWithDiagnostics(text: string, uri: string): ParseResult {
  try {
    const tree = $.$mol_tree2.fromString(text, uri)
    return { tree, diagnostics: [] }
  } catch (err: any) {
    const span = err?.span as undefined | { row: number; col: number; length: number }
    const message = (err?.reason ?? err?.message ?? 'Syntax error').toString()

    if (span && typeof span.row === 'number' && typeof span.col === 'number') {
      const line = Math.max(0, span.row - 1)
      const character = Math.max(0, span.col - 1)
      const length = Math.max(1, Number(span.length ?? 1))
      return {
        tree: null,
        diagnostics: [{
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line, character },
            end: { line, character: character + length },
          },
          message,
          source: 'mol_tree2',
        }],
      }
    }

    return {
      tree: null,
      diagnostics: [{
        severity: DiagnosticSeverity.Error,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        message,
        source: 'mol_tree2',
      }],
    }
  }
}

