import {
	createConnection,
	ProposedFeatures,
	TextDocuments,
	InitializeParams,
	TextDocumentSyncKind,
	CompletionItem,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import Parser from 'tree-sitter'
import ViewTreeLang from 'tree-sitter-viewtree'

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

const parser = new Parser()
parser.setLanguage(ViewTreeLang as any)

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

documents.onDidChangeContent(async change => {
	const text = change.document.getText()
	const tree = parser.parse(text)

	// тут можно делать валидации по синтаксису и присылать diagnostics
	connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] })

	// (по желанию) connection.console.log(JSON.stringify(tree.rootNode.toString()))
})

connection.onCompletion((): CompletionItem[] => {
	// быстрые болванки — потом заменишь на контекстные по AST
	return ['view', 'sub', 'attr', 'dom_name'].map(l => ({ label: l }))
})

documents.listen(connection)
connection.listen()
