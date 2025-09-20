import * as path from 'path'
import { workspace, ExtensionContext, window } from 'vscode'
import { LanguageClient, TransportKind, ServerOptions, LanguageClientOptions } from 'vscode-languageclient/node'

let client: LanguageClient | undefined

export function activate(context: ExtensionContext) {
	const serverModule = context.asAbsolutePath(path.join('out', 'server', 'index.js'))
	const traceOutput = window.createOutputChannel('view.tree LSP', { log: true })
	traceOutput.appendLine('[view.tree] Activating client…')
	traceOutput.show(true)
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: { execArgv: ['--inspect=6009'] } },
	}
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'view.tree' }],
        synchronize: { fileEvents: workspace.createFileSystemWatcher('**/*.view.tree') },
        traceOutputChannel: traceOutput,
        outputChannel: traceOutput,
    }
	client = new LanguageClient('viewtree-lsp', 'view.tree LSP', serverOptions, clientOptions)
	context.subscriptions.push(client)
	client.start()
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) return undefined
	return client.stop()
}
