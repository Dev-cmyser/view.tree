"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const fs = __importStar(require("fs/promises"));
const mol_tree2_1 = __importDefault(require("mol_tree2"));
const diag_1 = require("./diag");
const findNode_1 = require("./ast/findNode");
const loc_1 = require("./loc");
const completion_1 = require("./completion");
const indexer_1 = require("./indexer");
const semanticTokens_1 = require("./semanticTokens");
const deps_1 = require("./deps");
const resolver_1 = require("./resolver");
const format_1 = require("./format");
const scan_1 = require("./scan");
const tsProps_1 = require("./tsProps");
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
const trees = new Map();
let workspaceRootFs = '';
const log = (msg) => {
    connection.console.log(msg);
};
connection.onInitialize((params) => {
    const ws = params.workspaceFolders?.map(f => f.uri).join(', ') || params.rootUri || 'unknown';
    log(`[view.tree] onInitialize: workspace=${ws}`);
    const rootUri = params.workspaceFolders?.[0]?.uri || params.rootUri || '';
    workspaceRootFs = rootUri ? (0, resolver_1.uriToFsPath)(rootUri) : '';
    return {
        capabilities: {
            textDocumentSync: {
                openClose: true,
                change: node_1.TextDocumentSyncKind.Incremental,
                willSave: false,
                willSaveWaitUntil: true,
                save: { includeText: false },
            },
            completionProvider: { triggerCharacters: ['.', ':'] },
            definitionProvider: true,
            referencesProvider: true,
            renameProvider: { prepareProvider: true },
            documentFormattingProvider: true,
            codeActionProvider: true,
            foldingRangeProvider: true,
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
            hoverProvider: true,
        },
    };
});
documents.onDidChangeContent(async (change) => {
    const text = change.document.getText();
    const uri = change.document.uri;
    const { tree, diagnostics } = (0, diag_1.parseWithDiagnostics)(text, uri);
    let parsed = tree;
    let finalDiagnostics = diagnostics;
    if (!parsed) {
        try {
            const fixed = (0, format_1.sanitizeSeparators)(text);
            parsed = mol_tree2_1.default.$mol_tree2.fromString(fixed, uri);
            log(`[mol_tree2] parsed (tolerant) ${uri}`);
            // Do not auto-apply edits; only format on explicit request
            finalDiagnostics = [];
        }
        catch (e) {
            // keep parsed null
        }
    }
    if (parsed) {
        trees.set(uri, parsed);
        // log(`[mol_tree2] parsed ${uri}`)
    }
    else {
        trees.delete(uri);
        if (diagnostics[0])
            log(`[mol_tree2] parse error: ${diagnostics[0].message}`);
    }
    // Update project index using AST + text
    (0, indexer_1.updateIndexForDoc)(uri, parsed, text);
    // Enrich index with TS class method properties for .ts files in real-time
    try {
        if (/\.ts$/.test(uri) && !/\.d\.ts$/.test(uri)) {
            const tsProps = (0, tsProps_1.extractTsProps)(text);
            (0, indexer_1.updateTsPropsForUri)(uri, tsProps);
        }
    }
    catch { }
    // Add style diagnostics (spacing)
    const style = (0, format_1.spacingDiagnostics)(text).map(it => ({
        severity: node_1.DiagnosticSeverity.Hint,
        range: { start: { line: it.line, character: it.start }, end: { line: it.line, character: it.end } },
        message: it.message,
        source: 'view.tree:style',
    }));
    connection.sendDiagnostics({ uri, diagnostics: [...finalDiagnostics, ...style] });
    {
        const stats = (0, indexer_1.getIndexStats)(uri);
        log(`[view.tree] diagnostics: uri=${uri} count=${diagnostics.length} index=classes:${stats.classes} props:${stats.props} occs:${stats.occs}`);
    }
    // Recursively load dependencies (class references) from workspace
    try {
        if (workspaceRootFs && parsed) {
            const refs = (0, deps_1.extractClassRefs)(parsed);
            await (0, deps_1.loadDependencies)(workspaceRootFs, refs, trees, indexer_1.updateIndexForDoc, 50, msg => log(msg));
            log(`[view.tree] deps loaded: seed=${refs.size}`);
        }
    }
    catch (e) {
        log(`[view.tree] deps error: ${e?.message || e}`);
    }
});
documents.onDidClose(ev => {
    const uri = ev.document.uri;
    trees.delete(uri);
    (0, indexer_1.removeFromIndex)(uri);
    log(`[view.tree] closed: ${uri}`);
});
// Kick off a background project scan after initialize
connection.onInitialized(async () => {
    if (!workspaceRootFs)
        return;
    try {
        log(`[scan] start root=${workspaceRootFs}`);
        await (0, scan_1.scanProject)(workspaceRootFs, trees, indexer_1.updateIndexForDoc, log);
    }
    catch (e) {
        log(`[scan] failed: ${e?.message || e}`);
    }
});
connection.onCompletion(params => {
    const uri = params.textDocument.uri;
    const doc = documents.get(uri);
    const root = trees.get(uri);
    if (!doc || !root)
        return [];
    const items = (0, completion_1.getCompletions)(doc, params.position, root);
    log(`[view.tree] completion: uri=${uri} pos=${params.position.line}:${params.position.character} items=${items.length}`);
    return items;
});
connection.onHover(async (params) => {
    const uri = params.textDocument.uri;
    const doc = documents.get(uri);
    if (!doc)
        return null;
    const root = trees.get(uri);
    const offset = doc.offsetAt(params.position);
    const node = root ? (0, findNode_1.findNodeAtOffset)(root, doc, offset) : null;
    const wr = wordRangeAt(doc, offset);
    const token = node && (node.type || node.value) ? String(node.type || node.value) : wr?.text || '';
    if (!token)
        return null;
    const header = node?.type ? String(node.type) : token;
    const value = node?.value ? ` = ${JSON.stringify(String(node.value))}` : '';
    let defs = [...(0, indexer_1.findClassDefs)(token), ...(0, indexer_1.findPropDefs)(token)];
    log(`[hover] start token=${token} defs=${defs.length}`);
    // If class-like symbol, prefer merged properties from index (view.tree + ts)
    let propsBlock = '';
    if ((0, resolver_1.classLike)(token)) {
        let props = (0, indexer_1.getComponentProps)(token);
        if (!props.length && workspaceRootFs) {
            // Lazy-load expected class file to populate index if not yet loaded
            try {
                const rel = (0, resolver_1.classNameToRelPath)(token);
                const fsPath = require('path').join(workspaceRootFs, rel);
                log(`[hover] lazy-load fsPath=${fsPath}`);
                const text2 = await fs.readFile(fsPath, 'utf8');
                const uri2 = (0, resolver_1.fsPathToUri)(fsPath);
                const tree2 = mol_tree2_1.default.$mol_tree2.fromString(text2, uri2);
                trees.set(uri2, tree2);
                (0, indexer_1.updateIndexForDoc)(uri2, tree2, text2);
                props = (0, indexer_1.getComponentProps)(token);
                log(`[hover] lazy-load ok uri=${uri2} propsNow=${props.length}`);
            }
            catch { }
        }
        if (props.length) {
            propsBlock = props.map(p => `- ${p}`).join('\n');
        }
    }
    const contents = propsBlock || token;
    const range = node?.span ? (0, loc_1.spanToRange)(node.span) : wr?.range;
    const hover = { contents: { kind: 'markdown', value: contents }, range };
    log(`[view.tree] hover: uri=${uri} token=${token} defs=${defs.length} hasProps=${contents !== `view.tree: ${header}${value}`}`);
    return hover;
});
connection.onDefinition(async (params) => {
    const uri = params.textDocument.uri;
    const doc = documents.get(uri);
    const root = trees.get(uri);
    if (!doc)
        return null;
    const offset = doc.offsetAt(params.position);
    const node = root ? (0, findNode_1.findNodeAtOffset)(root, doc, offset) : null;
    const wr = wordRangeAt(doc, offset);
    const token = node ? String(node.type || node.value || '') : wr?.text || '';
    if (!token) {
        log(`[view.tree] definition: no-token`);
        return null;
    }
    // Heuristics: detect root class token and current class name from the first line
    const fullText = doc.getText().replace(/\r\n?/g, '\n');
    const lines = fullText.split('\n');
    const firstToken = lines[0]
        ?.replace(/^\uFEFF/, '')
        .trim()
        .split(/\s+/)[0] || '';
    const className = firstToken ? (firstToken.startsWith('$') ? firstToken : '$' + firstToken) : '';
    const isRootClassToken = params.position.line === 0 && token === firstToken;
    async function toFsLocation(fsPath, line, colStart = 0, len = 0) {
        const uri2 = (0, resolver_1.fsPathToUri)(fsPath);
        return {
            uri: uri2,
            range: { start: { line, character: colStart }, end: { line, character: colStart + Math.max(0, len) } },
        };
    }
    // Root class on line 0 -> jump to corresponding .ts class
    if (isRootClassToken && workspaceRootFs) {
        const tsFs = (0, resolver_1.uriToFsPath)(uri).replace(/\.view\.tree$/, '.ts');
        try {
            const tsText = await fs.readFile(tsFs, 'utf8');
            const tsLines = tsText.split('\n');
            const re = new RegExp(`\\bexport\\s+class\\s+${className.replace(/\$/g, '\\$')}`);
            const idx = tsLines.findIndex(l => re.test(l));
            if (idx >= 0) {
                const lineText = tsLines[idx];
                const col = Math.max(0, lineText.indexOf(className.replace(/\$/g, '$')));
                return await toFsLocation(tsFs, idx, col, className.length);
            }
        }
        catch { }
        return await toFsLocation(tsFs, 0, 0, 0);
    }
    // Property token -> try to open method inside related .ts class file
    if (/^[a-z][\w]*$/.test(token) && className) {
        const tsFs = (0, resolver_1.uriToFsPath)(uri).replace(/\.view\.tree$/, '.ts');
        try {
            const tsText = await fs.readFile(tsFs, 'utf8');
            const tsLines = tsText.split('\n');
            // naive method search; keeps server generic (no VSCode API)
            const mRe = new RegExp(`\\b${token}\\s*\\(`);
            for (let i = 0; i < tsLines.length; i++) {
                const lineText = tsLines[i];
                if (mRe.test(lineText)) {
                    const col = Math.max(0, lineText.indexOf(token));
                    return await toFsLocation(tsFs, i, col, token.length);
                }
            }
        }
        catch { }
    }
    // Default behavior: use indexed locations from .view.tree project
    let classHits = (0, indexer_1.findClassDefs)(token);
    const propHits = (0, indexer_1.findPropDefs)(token);
    const locs = [];
    for (const hit of [...classHits, ...propHits]) {
        locs.push({
            uri: hit.uri,
            range: {
                start: { line: hit.spot.line, character: hit.spot.col },
                end: { line: hit.spot.line, character: hit.spot.col + hit.spot.length },
            },
        });
    }
    // Fallback: if class-like and not indexed yet, point to expected file start
    if (!locs.length && (0, resolver_1.classLike)(token) && workspaceRootFs) {
        const rel = (0, resolver_1.classNameToRelPath)(token);
        const fsPath = require('path').join(workspaceRootFs, rel);
        const uriGuess = (0, resolver_1.fsPathToUri)(fsPath);
        locs.push({ uri: uriGuess, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } });
    }
    log(`[view.tree] definition: token=${token} hits=${locs.length}`);
    return (locs.length ? (locs.length === 1 ? locs[0] : locs) : null);
});
connection.onReferences(params => {
    const uri = params.textDocument.uri;
    const doc = documents.get(uri);
    const root = trees.get(uri);
    if (!doc)
        return null;
    const offset = doc.offsetAt(params.position);
    const node = root ? (0, findNode_1.findNodeAtOffset)(root, doc, offset) : null;
    const wr = wordRangeAt(doc, offset);
    const token = node ? String(node.type || node.value || '') : wr?.text || '';
    if (!token) {
        log(`[view.tree] references: no-token`);
        return [];
    }
    const hits = (0, indexer_1.findRefs)(token);
    const refs = hits.map(h => ({
        uri: h.uri,
        range: {
            start: { line: h.spot.line, character: h.spot.col },
            end: { line: h.spot.line, character: h.spot.col + h.spot.length },
        },
    }));
    log(`[view.tree] references: token=${token} hits=${refs.length}`);
    return refs;
});
// Document formatting (full)
connection.onDocumentFormatting(params => {
    const uri = params.textDocument.uri;
    const doc = documents.get(uri);
    if (!doc)
        return [];
    const original = doc.getText();
    const formatted = (0, format_1.formatText)(original, uri);
    if (formatted === original)
        return [];
    const edit = {
        range: { start: { line: 0, character: 0 }, end: doc.positionAt(original.length) },
        newText: formatted,
    };
    return [edit];
});
// Quick Fix / Source Action: Format document
connection.onCodeAction(params => {
    const uri = params.textDocument.uri;
    const doc = documents.get(uri);
    if (!doc)
        return [];
    const original = doc.getText();
    const formatted = (0, format_1.formatText)(original, uri);
    if (formatted === original)
        return [];
    const edit = {
        range: { start: { line: 0, character: 0 }, end: doc.positionAt(original.length) },
        newText: formatted,
    };
    const action = {
        title: 'Format (view.tree)',
        kind: node_1.CodeActionKind.QuickFix,
        edit: { changes: { [uri]: [edit] } },
        isPreferred: true,
    };
    return [action];
});
// Format-on-save via WillSaveWaitUntil
connection.onWillSaveTextDocumentWaitUntil(params => {
    const uri = params.textDocument.uri;
    const doc = documents.get(uri);
    if (!doc)
        return [];
    const original = doc.getText();
    const formatted = (0, format_1.formatText)(original, uri);
    const changed = formatted !== original;
    log(`[willSave] uri=${uri} changed=${changed}`);
    if (!changed)
        return [];
    const edit = {
        range: { start: { line: 0, character: 0 }, end: doc.positionAt(original.length) },
        newText: formatted,
    };
    return [edit];
});
// Folding ranges based on indentation (tabs)
connection.onFoldingRanges(params => {
    const uri = params.textDocument.uri;
    const doc = documents.get(uri);
    if (!doc)
        return [];
    const text = doc.getText();
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    const indents = lines.map(l => {
        const m = /^(\t*)/.exec(l);
        return m ? m[1].length : 0;
    });
    const ranges = [];
    for (let i = 0; i < lines.length - 1; i++) {
        const here = indents[i];
        const next = indents[i + 1];
        if (next > here) {
            // start of a block; find end where indent returns to here or less
            let end = i + 1;
            for (let k = i + 1; k < lines.length; k++) {
                if (indents[k] <= here) {
                    break;
                }
                end = k;
            }
            if (end > i + 0) {
                ranges.push({ startLine: i, endLine: end });
            }
        }
    }
    return ranges;
});
// Semantic Tokens (full document)
connection.languages.semanticTokens.on((params) => {
    const uri = params.textDocument.uri;
    const doc = documents.get(uri);
    const root = trees.get(uri);
    const data = (0, semanticTokens_1.buildSemanticTokens)(doc, root);
    const count = Math.floor(data.length / 5);
    log(`[view.tree] semanticTokens: uri=${uri} tokens=${count}`);
    return { data };
});
// Rename support
function wordRangeAt(doc, offset) {
    const text = doc.getText();
    const isWord = (ch) => /[A-Za-z0-9_$]/.test(ch);
    if (!text)
        return null;
    let start = offset;
    let end = offset;
    while (start > 0 && isWord(text[start - 1]))
        start--;
    while (end < text.length && isWord(text[end]))
        end++;
    if (start === end)
        return null;
    // Ensure token starts with letter or $
    const token = text.slice(start, end);
    if (!/^[A-Za-z$][\w$]*$/.test(token))
        return null;
    return { range: { start: doc.positionAt(start), end: doc.positionAt(end) }, text: token };
}
connection.onPrepareRename(params => {
    const uri = params.textDocument.uri;
    const doc = documents.get(uri);
    if (!doc)
        return null;
    const offset = doc.offsetAt(params.position);
    const wr = wordRangeAt(doc, offset);
    if (!wr)
        return null;
    log(`[view.tree] prepareRename: uri=${uri} token=${wr.text}`);
    return { range: wr.range, placeholder: wr.text };
});
connection.onRenameRequest(params => {
    const uri = params.textDocument.uri;
    const doc = documents.get(uri);
    if (!doc)
        return null;
    const offset = doc.offsetAt(params.position);
    const wr = wordRangeAt(doc, offset);
    if (!wr)
        return null;
    const oldName = wr.text;
    const newName = params.newName;
    if (oldName === newName)
        return { changes: {} };
    const hits = (0, indexer_1.findRefs)(oldName);
    const changes = {};
    for (const h of hits) {
        const arr = changes[h.uri] ?? [];
        arr.push({
            range: {
                start: { line: h.spot.line, character: h.spot.col },
                end: { line: h.spot.line, character: h.spot.col + h.spot.length },
            },
            newText: newName,
        });
        changes[h.uri] = arr;
    }
    const edit = { changes };
    const total = Object.values(changes).reduce((n, arr) => n + arr.length, 0);
    log(`[view.tree] rename: ${oldName} -> ${newName} edits=${total}`);
    return edit;
});
// Watcher: update cache/index when files change on disk (from client watcher)
connection.onDidChangeWatchedFiles(async (ev) => {
    for (const ch of ev.changes) {
        try {
            const fsPath = (0, resolver_1.uriToFsPath)(ch.uri);
            let text = await fs.readFile(fsPath, 'utf8');
            const uri = ch.uri;
            let tree;
            try {
                tree = mol_tree2_1.default.$mol_tree2.fromString(text, uri);
            }
            catch (e) {
                // Tolerant parse for common whitespace issues
                const msg = String(e?.reason || e?.message || '');
                if (/Wrong nodes separator/.test(msg)) {
                    const fixed = (0, format_1.sanitizeSeparators)(text);
                    tree = mol_tree2_1.default.$mol_tree2.fromString(fixed, uri);
                }
                else if (/Unexpected EOF, LF required/.test(msg)) {
                    const fixed = text.endsWith('\n') ? text : text + '\n';
                    tree = mol_tree2_1.default.$mol_tree2.fromString(fixed, uri);
                }
                else
                    throw e;
            }
            trees.set(uri, tree);
            (0, indexer_1.updateIndexForDoc)(uri, tree, text);
            connection.console.log(`[view.tree] watched-change parsed: ${uri}`);
        }
        catch (e) {
            connection.console.log(`[view.tree] watched-change failed: ${ch.uri} ${e?.message || e}`);
        }
    }
});
documents.listen(connection);
connection.listen();
