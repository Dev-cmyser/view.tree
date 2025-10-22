import { workspace, ExtensionContext, window } from 'vscode'
import { LanguageClient, Executable, LanguageClientOptions } from 'vscode-languageclient/node'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

let client: LanguageClient | undefined

async function updateLSPServer(traceOutput: any): Promise<void> {
	traceOutput.appendLine('[view.tree] Updating LSP server...')

	try {
		const { stdout, stderr } = await execAsync('npm install -g --force view-tree-lsp@latest')

		if (stdout) traceOutput.appendLine(`[view.tree] ${stdout}`)
		if (stderr) traceOutput.appendLine(`[view.tree] ${stderr}`)

		traceOutput.appendLine('[view.tree] LSP server updated successfully')
	} catch (error) {
		traceOutput.appendLine(`[view.tree] Failed to update LSP server: ${error}`)
		throw error
	}
}

export async function activate(context: ExtensionContext) {
	const traceOutput = window.createOutputChannel('view.tree LSP', { log: true })
	traceOutput.appendLine('[view.tree] Activating client…')
	traceOutput.show(true)

	// Update LSP server on activation
	try {
		await window.withProgress(
			{
				location: { viewId: 'view.tree' },
				title: 'Updating view.tree LSP server...',
				cancellable: false,
			},
			async () => {
				await updateLSPServer(traceOutput)
			},
		)
	} catch (error) {
		traceOutput.appendLine(`[view.tree] Update failed, trying to start with existing version: ${error}`)
	}

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
