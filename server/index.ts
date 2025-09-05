import * as path from 'path'
import {
	createConnection,
	ProposedFeatures,
	TextDocuments,
	InitializeParams,
	TextDocumentSyncKind,
	CompletionItem,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import Parser from 'web-tree-sitter'

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

const wasmPath = path.join(__dirname, '..', 'tree-sitter', 'tree-sitter-viewtree.wasm')

let parser: any
let parserReady: Promise<void> = (async () => {
	await Parser.init()
	const Lang = await Parser.Language.load(wasmPath)
	parser = new Parser()
	parser.setLanguage(Lang)
})()

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

documents.onDidChangeContent(async change => {
	await parserReady
	const text = change.document.getText()
	const tree = parser.parse(text)
	connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] })
})

connection.onCompletion((): CompletionItem[] => {
	return ['view', 'sub', 'attr', 'dom_name'].map(l => ({ label: l }))
})

documents.listen(connection)
connection.listen()
