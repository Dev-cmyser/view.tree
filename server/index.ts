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
import { parseWithDiagnostics } from './diag/collect'
import type { Ast } from './ast/build'
import { findNodeAtOffset } from './ast/findNode'

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)
const trees = new Map<string, Ast>()

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

	connection.sendDiagnostics({ uri, diagnostics })
})

connection.onCompletion((): CompletionItem[] => {
	// быстрые болванки — потом заменим на контекстные по AST mol_tree2
	return ['view', 'sub', 'attr', 'dom_name'].map(l => ({ label: l }))
})

documents.listen(connection)
connection.listen()
