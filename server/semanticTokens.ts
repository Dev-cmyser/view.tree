import { TextDocument } from 'vscode-languageserver-textdocument'

import type { Ast } from './ast/build'

// Must match the legend order declared in onInitialize
const tokenTypeOrder = [
	'namespace',
	'type',
	'class',
	'property',
	'variable',
	'string',
	'number',
	'operator',
	'comment',
	'keyword',
] as const
const typeIndex = new Map<string, number>(tokenTypeOrder.map((t, i) => [t, i]))

type RawToken = { line: number; char: number; length: number; type: string }

function classify(node: any): string | null {
	const t: string = String(node.type ?? '')
	const v: string = String(node.value ?? '')

	if (t) {
		if (/^(\/|\*|\^|=|<=|<=>)$/.test(t)) return 'operator'
		if (/^\$?[A-Z]/.test(t)) return 'class'
		if (/^[a-z]/.test(t)) return 'property'
		return null
	}

	if (v) {
		if (/^(?:true|false|null|NaN|[+-]?Infinity)$/.test(v)) return 'keyword'
		if (/^[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(v)) return 'number'
		return 'string'
	}

	return null
}

function collect(node: Ast, out: RawToken[]) {
	const kind = classify(node)
	const span = node.span
	if (kind && span) {
		const line = Math.max(0, Number(span.row || 1) - 1)
		const char = Math.max(0, Number(span.col || 1) - 1)
		const length = Math.max(1, Number(span.length || 1))
		out.push({ line, char, length, type: kind })
	}
	const kids: Ast[] = (node.kids || []) as any
	for (const k of kids) collect(k, out)
}

export function buildSemanticTokens(doc: TextDocument, root: Ast | null | undefined): number[] {
	if (!doc || !root) return []
	const raw: RawToken[] = []
	collect(root, raw)
	raw.sort((a, b) => a.line - b.line || a.char - b.char)

	let prevLine = 0
	let prevChar = 0
	const data: number[] = []
	for (const tok of raw) {
		const deltaLine = tok.line - prevLine
		const deltaStart = deltaLine === 0 ? tok.char - prevChar : tok.char
		prevLine = tok.line
		prevChar = tok.char

		const typeId = typeIndex.get(tok.type) ?? typeIndex.get('variable')!
		const modifiers = 0
		data.push(deltaLine, deltaStart, tok.length, typeId, modifiers)
	}
	return data
}
