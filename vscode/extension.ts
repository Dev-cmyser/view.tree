import * as path from 'path'
import { workspace, ExtensionContext } from 'vscode'
import { LanguageClient, TransportKind, ServerOptions, LanguageClientOptions } from 'vscode-languageclient/node'

export function activate(context: ExtensionContext) {
	const serverModule = context.asAbsolutePath(path.join('server', 'out', 'index.js'))
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: { execArgv: ['--inspect=6009'] } },
	}
	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'view.tree' }],
		synchronize: { fileEvents: workspace.createFileSystemWatcher('**/*.view.tree') },
	}
	const client = new LanguageClient('viewtree-lsp', 'view.tree LSP', serverOptions, clientOptions)
	context.subscriptions.push(client.start())
}
