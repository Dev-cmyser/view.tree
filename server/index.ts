import {
	createConnection,
	ProposedFeatures,
	TextDocuments,
	InitializeParams,
	TextDocumentSyncKind,
	CompletionItem,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import Parser = require('tree-sitter')
const ViewTree = require('../tree-sitter-view.tree') // скомпилированный парсер

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)
const parser = new Parser()
parser.setLanguage(ViewTree)

connection.onInitialize((_params: InitializeParams) => ({
	capabilities: {
		textDocumentSync: TextDocumentSyncKind.Incremental,
		completionProvider: { triggerCharacters: ['.', ':'] },
		definitionProvider: true,
		referencesProvider: true,
		renameProvider: { prepareProvider: true },
		semanticTokensProvider: {
			legend: { tokenTypes: ['variable', 'function', 'keyword', 'string', 'number'], tokenModifiers: [] },
			range: false,
			full: true,
		},
	},
}))

documents.onDidChangeContent(change => {
	const text = change.document.getText()
	const tree = parser.parse(text)
	connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] })
})

connection.onCompletion((): CompletionItem[] => {
	return ['view', 'sub', 'attr', 'dom_name'].map(l => ({ label: l }))
})

documents.listen(connection)
connection.listen()
