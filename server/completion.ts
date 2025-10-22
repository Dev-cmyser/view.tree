import { CompletionItem, CompletionItemKind, Position } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import type { Ast } from './ast/build'
import { getAllClasses, getAllProps, getComponentProps } from './indexer'

export function getCompletions(doc: TextDocument, position: Position, _root: Ast | null | undefined): CompletionItem[] {
	const text = doc.getText()
	const offset = doc.offsetAt(position)
	const lines = text.replace(/\r\n?/g, '\n').split('\n')
	const lineIndex = Math.min(Math.max(0, position.line), Math.max(0, lines.length - 1))
	const lineText = lines[lineIndex] ?? ''
	const trimmedLine = lineText.trim()

	const operators: CompletionItem[] = [
		{ label: '/', kind: CompletionItemKind.Operator },
		{ label: '*', kind: CompletionItemKind.Operator },
		{ label: '^', kind: CompletionItemKind.Operator },
		{ label: '=', kind: CompletionItemKind.Operator },
		{ label: '<=', kind: CompletionItemKind.Operator },
		{ label: '<=>', kind: CompletionItemKind.Operator },
		{ label: '@', kind: CompletionItemKind.Operator },
		{ label: '\\', kind: CompletionItemKind.Operator },
	]

	const classes = getAllClasses().map(label => ({ label, kind: CompletionItemKind.Class }))

	// If current token starts with '$' => suggest classes
	const slice = text.slice(Math.max(0, offset - 128), offset)
	const tokenMatch = /([A-Za-z0-9_$]+)$/.exec(slice)
	if (tokenMatch && tokenMatch[1].startsWith('$')) {
		return [...classes, ...operators]
	}

	// Determine current component context
	const binding = findBinding(lineText)
	let currentComponent: string | null = null
	if (binding) {
		if (position.character > binding.end) {
			currentComponent = getRootComponent(lines)
		} else {
			currentComponent = getNearestComponentAbove(lines, lineIndex - 1)
		}
	} else {
		currentComponent = getNearestComponentAbove(lines, lineIndex)
	}

	const baseProps: CompletionItem[] = [
		{ label: 'sub', kind: CompletionItemKind.Property },
		{ label: 'content', kind: CompletionItemKind.Property },
		{ label: 'attr', kind: CompletionItemKind.Property },
		{ label: 'dom_name', kind: CompletionItemKind.Property },
	]

	if (currentComponent) {
		const compProps = getComponentProps(currentComponent)
		const propItems: CompletionItem[] = (compProps.length ? compProps : getAllProps()).map(label => ({
			label,
			kind: CompletionItemKind.Property,
		}))
		return [...propItems, ...baseProps, ...operators, ...classes]
	}

	// Default suggestions
	const props = getAllProps().map(label => ({ label, kind: CompletionItemKind.Property }))
	return [...classes, ...props, ...baseProps, ...operators]
}

// Helpers (pure text-based; no VSCode API on server)
function findBinding(text: string): { start: number; end: number; op: string } | null {
	const re = /<=>|<=|=>/g
	const m = re.exec(text)
	return m ? { op: m[0], start: m.index, end: m.index + m[0].length } : null
}

function getRootComponent(lines: string[]): string | null {
	const first = (lines[0] || '').replace(/^\uFEFF/, '')
	const token = first.trim().split(/\s+/)[0] || ''
	return token || null
}

function getNearestComponentAbove(lines: string[], startLine: number): string | null {
	for (let i = Math.min(startLine, lines.length - 1); i >= 0; i--) {
		const text = lines[i] || ''
		const t = text.trim()
		if (!t) continue
		if (t.startsWith('-')) continue
		if (/(<=|=>|<=>)/.test(text) && !/\$[A-Za-z0-9_]+/.test(text)) continue
		const m = text.match(/\$[A-Za-z0-9_]+/)
		if (m) return m[0]
	}
	return null
}
