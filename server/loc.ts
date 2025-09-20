import { Position, Range } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

type SpanLike = { row: number; col: number; length: number }

export function offsetOfPosition(doc: TextDocument, pos: Position): number {
  return doc.offsetAt(pos)
}

export function spanStartPosition(span: SpanLike): Position {
  return { line: Math.max(0, span.row - 1), character: Math.max(0, span.col - 1) }
}

export function spanEndPosition(span: SpanLike): Position {
  return { line: Math.max(0, span.row - 1), character: Math.max(0, span.col - 1 + (span.length ?? 1)) }
}

export function spanToRange(span: SpanLike): Range {
  return { start: spanStartPosition(span), end: spanEndPosition(span) }
}

export function spanContainsOffset(doc: TextDocument, span: SpanLike, offset: number): boolean {
  const start = doc.offsetAt(spanStartPosition(span))
  const end = doc.offsetAt(spanEndPosition(span))
  return offset >= start && offset <= end
}

