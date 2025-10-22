import { workspace, ExtensionContext, window } from 'vscode'
import { LanguageClient, Executable, LanguageClientOptions } from 'vscode-languageclient/node'

let client: LanguageClient | undefined

export function activate(context: ExtensionContext) {
	const traceOutput = window.createOutputChannel('view.tree LSP', { log: true })
	traceOutput.appendLine('[view.tree] Activating client…')
	traceOutput.show(true)

	// Use globally installed view-tree-lsp command
	const serverExecutable: Executable = {
		command: 'view-tree-lsp',
		args: ['--stdio'],
	}

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'view.tree' }],
		synchronize: { fileEvents: workspace.createFileSystemWatcher('**/*.view.tree') },
		traceOutputChannel: traceOutput,
		outputChannel: traceOutput,
	}

	client = new LanguageClient('viewtree-lsp', 'view.tree LSP', serverExecutable, clientOptions)

	context.subscriptions.push(client)

	client.start().catch(error => {
		traceOutput.appendLine(`[view.tree] Failed to start client: ${error}`)
		window.showErrorMessage(
			'Failed to start view.tree LSP. Make sure view-tree-lsp is installed: npm install -g view-tree-lsp',
		)
	})
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) return undefined
	return client.stop()
}
