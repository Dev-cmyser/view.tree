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
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import $ from 'mol_tree2'

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

connection.onInitialize((_params: InitializeParams) => ({
	capabilities: {
		textDocumentSync: TextDocumentSyncKind.Incremental,
		completionProvider: { triggerCharacters: ['.', ':'] },
		definitionProvider: false,
		referencesProvider: false,
		renameProvider: { prepareProvider: false },
		semanticTokensProvider: {
			legend: {
				tokenTypes: [
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
				],
				tokenModifiers: [],
			},
			range: false,
			full: true,
		},
	},
}))

// Minimal semantic tokens: return empty list to satisfy client.
connection.languages.semanticTokens.on((_params: SemanticTokensParams): SemanticTokens => ({ data: [] }))

documents.onDidChangeContent(async change => {
	const text = change.document.getText()
	const uri = change.document.uri

	const diagnostics: Diagnostic[] = []

	try {
		// Parse with mol_tree2. Throws $mol_error_syntax on invalid input.
		const tree = $.$mol_tree2.fromString(text, uri)
		void tree // placeholder: keep AST for future features
	} catch (err: any) {
		const span = err?.span as undefined | { row: number; col: number; length: number }
		const reason = (err?.reason ?? err?.message ?? 'Syntax error').toString()
		if (span && typeof span.row === 'number' && typeof span.col === 'number') {
			const line = Math.max(0, span.row - 1)
			const character = Math.max(0, span.col - 1)
			const length = Math.max(1, Number(span.length ?? 1))
			diagnostics.push({
				severity: DiagnosticSeverity.Error,
				range: {
					start: { line, character },
					end: { line, character: character + length },
				},
				message: reason,
				source: 'mol_tree2',
			})
		} else {
			diagnostics.push({
				severity: DiagnosticSeverity.Error,
				range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
				message: reason,
				source: 'mol_tree2',
			})
		}
	}

	connection.sendDiagnostics({ uri, diagnostics })
})

connection.onCompletion((): CompletionItem[] => {
	// быстрые болванки — потом заменим на контекстные по AST mol_tree2
	return ['view', 'sub', 'attr', 'dom_name'].map(l => ({ label: l }))
})

documents.listen(connection)
connection.listen()
