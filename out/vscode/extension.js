"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode_1 = require("vscode");
const node_1 = require("vscode-languageclient/node");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
let client;
async function updateLSPServer(traceOutput) {
    traceOutput.appendLine('[view.tree] Updating LSP server...');
    try {
        const { stdout, stderr } = await execAsync('npm install -g --force view-tree-lsp@latest');
        if (stdout)
            traceOutput.appendLine(`[view.tree] ${stdout}`);
        if (stderr)
            traceOutput.appendLine(`[view.tree] ${stderr}`);
        traceOutput.appendLine('[view.tree] LSP server updated successfully');
    }
    catch (error) {
        traceOutput.appendLine(`[view.tree] Failed to update LSP server: ${error}`);
        throw error;
    }
}
async function activate(context) {
    const traceOutput = vscode_1.window.createOutputChannel('view.tree LSP', { log: true });
    traceOutput.appendLine('[view.tree] Activating client…');
    traceOutput.show(true);
    // Update LSP server on activation
    try {
        await vscode_1.window.withProgress({
            location: { viewId: 'view.tree' },
            title: 'Updating view.tree LSP server...',
            cancellable: false,
        }, async () => {
            await updateLSPServer(traceOutput);
        });
    }
    catch (error) {
        traceOutput.appendLine(`[view.tree] Update failed, trying to start with existing version: ${error}`);
    }
    // Use globally installed view-tree-lsp command
    const serverExecutable = {
        command: 'view-tree-lsp',
        args: ['--stdio'],
    };
    const clientOptions = {
        documentSelector: [{ scheme: 'file', language: 'view.tree' }],
        synchronize: { fileEvents: vscode_1.workspace.createFileSystemWatcher('**/*.view.tree') },
        traceOutputChannel: traceOutput,
        outputChannel: traceOutput,
    };
    client = new node_1.LanguageClient('viewtree-lsp', 'view.tree LSP', serverExecutable, clientOptions);
    context.subscriptions.push(client);
    client.start().catch(error => {
        traceOutput.appendLine(`[view.tree] Failed to start client: ${error}`);
        vscode_1.window.showErrorMessage('Failed to start view.tree LSP. Make sure view-tree-lsp is installed: npm install -g view-tree-lsp');
    });
}
function deactivate() {
    if (!client)
        return undefined;
    return client.stop();
}
