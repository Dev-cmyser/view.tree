import {
	createConnection,
	ProposedFeatures,
	TextDocuments,
	InitializeParams,
	TextDocumentSyncKind,
	CompletionItem,
	SemanticTokens,
	SemanticTokensParams,
	Diagnostic,
	DiagnosticSeverity,
	Hover,
	Definition,
	Location,
	WorkspaceEdit,
	Range,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import $ from 'mol_tree2'
import { parseWithDiagnostics } from './diag/collect'
import type { Ast } from './ast/build'
import { findNodeAtOffset } from './ast/findNode'
import { spanToRange } from './loc/offset'
import { getCompletions } from './completion'
import { updateIndexForDoc, removeFromIndex, findClassDefs, findPropDefs, findRefs } from './indexer'
import { buildSemanticTokens } from './semanticTokens'

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)
const trees = new Map<string, Ast>()

connection.onInitialize((_params: InitializeParams) => ({
	capabilities: {
		textDocumentSync: TextDocumentSyncKind.Incremental,
		completionProvider: { triggerCharacters: ['.', ':'] },
		definitionProvider: true,
		referencesProvider: true,
		renameProvider: { prepareProvider: true },
		semanticTokensProvider: {
			legend: {
				tokenTypes: [
					'namespace', 'type', 'class', 'property', 'variable',
					'string', 'number', 'operator', 'comment', 'keyword',
				],
				tokenModifiers: [],
			},
			range: false,
			full: true,
		},
		hoverProvider: true,
	},
}))

documents.onDidChangeContent(async change => {
	const text = change.document.getText()
	const uri = change.document.uri

	const { tree, diagnostics } = parseWithDiagnostics(text, uri)
	if (tree) {
		trees.set(uri, tree)
		connection.console.log(`[mol_tree2] parsed ${uri}:\n${tree.toString()}`)
	} else {
		trees.delete(uri)
		if (diagnostics[0]) connection.console.log(`[mol_tree2] parse error: ${diagnostics[0].message}`)
	}

	// Update project index using AST + text
	updateIndexForDoc(uri, tree, text)

	connection.sendDiagnostics({ uri, diagnostics })
})

documents.onDidClose(ev => {
	const uri = ev.document.uri
	trees.delete(uri)
	removeFromIndex(uri)
})

connection.onCompletion(params => {
    const uri = params.textDocument.uri
    const doc = documents.get(uri)
    const root = trees.get(uri)
    if (!doc || !root) return []
    return getCompletions(doc, params.position, root)
})

connection.onHover(params => {
    const uri = params.textDocument.uri
    const doc = documents.get(uri)
    if (!doc) return null
    const root = trees.get(uri)
    if (!root) return null

    const offset = doc.offsetAt(params.position)
    const node: any = findNodeAtOffset(root as any, doc, offset)
    if (!node) return null

    const header = node.type ? String(node.type) : '(data)'
    const value = node.value ? ` = ${JSON.stringify(String(node.value))}` : ''
    const preview = typeof node.clone === 'function' ? String(node.clone([])) : ''

    const contents = [
        `view.tree: ${header}${value}`,
        preview && '```view.tree\n' + preview + '\n```',
    ].filter(Boolean).join('\n')

    const range = node.span ? spanToRange(node.span) : undefined
    const hover: Hover = { contents: { kind: 'markdown', value: contents }, range }
    return hover
})

connection.onDefinition(params => {
    const uri = params.textDocument.uri
    const doc = documents.get(uri)
    const root = trees.get(uri)
    if (!doc || !root) return null
    const offset = doc.offsetAt(params.position)
    const node: any = findNodeAtOffset(root as any, doc, offset)
    const token = node ? (node.type || node.value || '') : ''
    if (!token) return null

    const classHits = findClassDefs(token)
    const propHits = findPropDefs(token)

    const locs: Location[] = []
    for (const hit of [...classHits, ...propHits]) {
        locs.push({
            uri: hit.uri,
            range: {
                start: { line: hit.spot.line, character: hit.spot.col },
                end: { line: hit.spot.line, character: hit.spot.col + hit.spot.length },
            },
        })
    }
    return (locs.length ? (locs.length === 1 ? locs[0] : locs) : null) as Definition
})

connection.onReferences(params => {
    const uri = params.textDocument.uri
    const doc = documents.get(uri)
    const root = trees.get(uri)
    if (!doc || !root) return null
    const offset = doc.offsetAt(params.position)
    const node: any = findNodeAtOffset(root as any, doc, offset)
    const token = node ? (node.type || node.value || '') : ''
    if (!token) return []

    const hits = findRefs(token)
    return hits.map(h => ({
        uri: h.uri,
        range: {
            start: { line: h.spot.line, character: h.spot.col },
            end: { line: h.spot.line, character: h.spot.col + h.spot.length },
        },
    }))
})

// Semantic Tokens (full document)
connection.languages.semanticTokens.on((params: SemanticTokensParams): SemanticTokens => {
    const uri = params.textDocument.uri
    const doc = documents.get(uri)
    const root = trees.get(uri)
    const data = buildSemanticTokens(doc as TextDocument, root)
    return { data }
})

// Rename support
function wordRangeAt(doc: TextDocument, offset: number): { range: Range, text: string } | null {
    const text = doc.getText()
    const isWord = (ch: string) => /[A-Za-z0-9_$]/.test(ch)
    if (!text) return null
    let start = offset
    let end = offset
    while (start > 0 && isWord(text[start - 1])) start--
    while (end < text.length && isWord(text[end])) end++
    if (start === end) return null
    // Ensure token starts with letter or $
    const token = text.slice(start, end)
    if (!/^[A-Za-z$][\w$]*$/.test(token)) return null
    return { range: { start: doc.positionAt(start), end: doc.positionAt(end) }, text: token }
}

connection.onPrepareRename(params => {
    const uri = params.textDocument.uri
    const doc = documents.get(uri)
    if (!doc) return null
    const offset = doc.offsetAt(params.position)
    const wr = wordRangeAt(doc, offset)
    if (!wr) return null
    return { range: wr.range, placeholder: wr.text }
})

connection.onRenameRequest(params => {
    const uri = params.textDocument.uri
    const doc = documents.get(uri)
    if (!doc) return null
    const offset = doc.offsetAt(params.position)
    const wr = wordRangeAt(doc, offset)
    if (!wr) return null
    const oldName = wr.text
    const newName = params.newName
    if (oldName === newName) return { changes: {} } as WorkspaceEdit

    const hits = findRefs(oldName)
    const changes: Record<string, { range: Range, newText: string }[]> = {}
    for (const h of hits) {
        const arr = changes[h.uri] ?? []
        arr.push({
            range: {
                start: { line: h.spot.line, character: h.spot.col },
                end: { line: h.spot.line, character: h.spot.col + h.spot.length },
            },
            newText: newName,
        })
        changes[h.uri] = arr
    }
    const edit: WorkspaceEdit = { changes }
    return edit
})

documents.listen(connection)
connection.listen()
