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
	Hover,
	Definition,
	Location,
	WorkspaceEdit,
	Range,
	MessageType,
    TextEdit,
    CodeAction,
    CodeActionKind,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import * as fs from 'fs/promises'

import $ from 'mol_tree2'
import { parseWithDiagnostics } from './diag'
import type { Ast } from './ast/build'
import { findNodeAtOffset } from './ast/findNode'
import { spanToRange } from './loc'
import { getCompletions } from './completion'
import { updateIndexForDoc, removeFromIndex, findClassDefs, findPropDefs, findRefs, getIndexStats } from './indexer'
import { buildSemanticTokens } from './semanticTokens'
import { extractClassRefs, loadDependencies } from './deps'
import { uriToFsPath, classLike, classNameToRelPath, fsPathToUri } from './resolver'
import { formatText, sanitizeSeparators } from './format'
import { sanitizeLineSpaces } from './format'

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)
const trees = new Map<string, Ast>()

let workspaceRootFs = ''
const log = (msg: string) => { connection.console.log(msg) }

connection.onInitialize((params: InitializeParams) => {
    const ws = params.workspaceFolders?.map(f => f.uri).join(', ') || params.rootUri || 'unknown'
    log(`[view.tree] onInitialize: workspace=${ws}`)
    const rootUri = params.workspaceFolders?.[0]?.uri || params.rootUri || ''
    workspaceRootFs = rootUri ? uriToFsPath(rootUri) : ''
    return {
    capabilities: {
		textDocumentSync: TextDocumentSyncKind.Incremental,
		completionProvider: { triggerCharacters: ['.', ':'] },
		definitionProvider: true,
		referencesProvider: true,
		renameProvider: { prepareProvider: true },
        documentFormattingProvider: true,
        codeActionProvider: true,
		semanticTokensProvider: {
			legend: {
				tokenTypes: [
					'namespace', 'type', 'class', 'property', 'variable',
					'string', 'number', 'operator', 'comment', 'keyword',
				],
				tokenModifiers: [],
			},
			range: false,
			full: true,
		},
		hoverProvider: true,
    },
}}
)

documents.onDidChangeContent(async change => {
    const text = change.document.getText()
    const uri = change.document.uri

    const { tree, diagnostics } = parseWithDiagnostics(text, uri)
    let parsed = tree as any
    let finalDiagnostics = diagnostics
    if (!parsed) {
        try {
            const fixed = sanitizeSeparators(text)
            parsed = $.$mol_tree2.fromString(fixed, uri)
            log(`[mol_tree2] parsed (tolerant) ${uri}`)
            // Do not auto-apply edits; only format on explicit request
            finalDiagnostics = []
        } catch (e:any) {
            // keep parsed null
        }
    }
    if (parsed) {
        trees.set(uri, parsed)
        // log(`[mol_tree2] parsed ${uri}`)
    } else {
        trees.delete(uri)
        if (diagnostics[0]) log(`[mol_tree2] parse error: ${diagnostics[0].message}`)
    }

    // Update project index using AST + text
    updateIndexForDoc(uri, parsed, text)

    connection.sendDiagnostics({ uri, diagnostics: finalDiagnostics })
    {
        const stats = getIndexStats(uri)
        log(`[view.tree] diagnostics: uri=${uri} count=${diagnostics.length} index=classes:${stats.classes} props:${stats.props} occs:${stats.occs}`)
    }

    // Recursively load dependencies (class references) from workspace
    try {
        if (workspaceRootFs && parsed) {
            const refs = extractClassRefs(parsed as any)
            await loadDependencies(
                workspaceRootFs,
                refs,
                trees as any,
                updateIndexForDoc,
                50,
                (msg) => log(msg),
            )
            log(`[view.tree] deps loaded: seed=${refs.size}`)
        }
    } catch (e: any) {
        log(`[view.tree] deps error: ${e?.message || e}`)
    }
})

documents.onDidClose(ev => {
    const uri = ev.document.uri
    trees.delete(uri)
    removeFromIndex(uri)
    log(`[view.tree] closed: ${uri}`)
})

connection.onCompletion(params => {
    const uri = params.textDocument.uri
    const doc = documents.get(uri)
    const root = trees.get(uri)
    if (!doc || !root) return []
    const items = getCompletions(doc, params.position, root)
    log(`[view.tree] completion: uri=${uri} pos=${params.position.line}:${params.position.character} items=${items.length}`)
    return items
})

connection.onHover(async params => {
    const uri = params.textDocument.uri
    const doc = documents.get(uri)
    if (!doc) return null
    const root = trees.get(uri)

    const offset = doc.offsetAt(params.position)
    const node: any = root ? findNodeAtOffset(root as any, doc, offset) : null
    const wr = wordRangeAt(doc, offset)
    const token = (node && (node.type || node.value)) ? String(node.type || node.value) : (wr?.text || '')
    if (!token) return null

    const header = node?.type ? String(node.type) : token
    const value = node?.value ? ` = ${JSON.stringify(String(node.value))}` : ''
    let defs = [...findClassDefs(token), ...findPropDefs(token)]
    log(`[hover] start token=${token} defs=${defs.length}`)

    // If class-like symbol, show top-level props from its class AST with nested keys inline
    let propsBlock = ''
    if (classLike(token)) {
        let targetTree: any
        const target = defs[0]
        const targetUri = target?.uri
        if (targetUri) { targetTree = trees.get(targetUri); log(`[hover] targetUri=${targetUri} cached=${!!targetTree}`) }
        if (!targetTree && workspaceRootFs) {
            try {
                const rel = classNameToRelPath(token)
                const fsPath = require('path').join(workspaceRootFs, rel)
                log(`[hover] lazy-load fsPath=${fsPath}`)
                const text2 = await fs.readFile(fsPath, 'utf8')
                const uri2 = fsPathToUri(fsPath)
                const tree2 = $.$mol_tree2.fromString(text2, uri2)
                trees.set(uri2, tree2)
                updateIndexForDoc(uri2, tree2, text2)
                defs = [...findClassDefs(token), ...findPropDefs(token)]
                targetTree = tree2
                log(`[hover] lazy-load ok uri=${uri2} defsNow=${defs.length}`)
            } catch {}
        }
        if (targetTree) {
            // Find the class node in AST (DFS), then list its direct lowercase-key children
            const stack: any[] = [ targetTree ]
            let classNode: any | null = null
            while (stack.length) {
                const cur = stack.pop()
                if (cur) {
                    const curType = String(cur.type || '')
                    const normCur = curType.replace(/^\$/,'')
                    const normTok = token.replace(/^\$/,'')
                    if (curType === token || normCur === normTok) { classNode = cur; break }
                }
                const kids = (cur && cur.kids) || []
                for (let i = kids.length - 1; i >= 0; --i) stack.push(kids[i])
            }
            log(`[hover] classNodeFound=${!!classNode}`)
            const nodeToUse: any = classNode || targetTree
            const lines: string[] = []
            const childTypes = (nodeToUse.kids || []).map((k: any) => String(k.type || ''))
            log(`[hover] childTypes=${childTypes.join(',')}`)
            for (const kid of (nodeToUse.kids || [])) {
                const t = String(kid.type || '')
                if (/^[a-z][\w]*$/.test(t)) {
                    // Group suffix if present (e.g., *any)
                    let suffix = ''
                    const first = (kid.kids && kid.kids[0])
                    if (first && first.type === '*') {
                        const dv = first.kids && first.kids[0]
                        const grp = dv && String(dv.type || '') === '' && dv.value ? String(dv.value) : ''
                        suffix = grp ? ` *${grp}` : ' *'
                    }
                    // Collect nested prop keys (skip first '*' node)
                    const sub: string[] = []
                    const startIdx = (first && first.type === '*') ? 1 : 0
                    const kids2: any[] = kid.kids || []
                    for (let i = startIdx; i < kids2.length; ++i) {
                        const tt = String(kids2[i].type || '')
                        if (/^[a-z][\w?]*\??$/.test(tt)) sub.push(tt)
                    }
                    if (sub.length) lines.push(`${t}${suffix}: ${sub.join(', ')}`)
                    else lines.push(`${t}${suffix}`)
                }
            }
            if (!lines.length) {
                // Fallback: scan one level deeper
                for (const child of (nodeToUse.kids || [])) {
                    for (const g of (child.kids || [])) {
                        const tt = String(g.type || '')
                        if (/^[a-z][\w]*$/.test(tt)) lines.push(tt)
                    }
                }
            }
            log(`[hover] propsCount=${lines.length}`)
            if (lines.length) propsBlock = lines.map(l => `- ${l}`).join('\n')
        }
    }

    const contents = propsBlock || token

    const range = node?.span ? spanToRange(node.span) : (wr?.range)
    const hover: Hover = { contents: { kind: 'markdown', value: contents }, range }
    log(`[view.tree] hover: uri=${uri} token=${token} defs=${defs.length} hasProps=${contents !== `view.tree: ${header}${value}`}`)
    return hover
})

connection.onDefinition(params => {
    const uri = params.textDocument.uri
    const doc = documents.get(uri)
    const root = trees.get(uri)
    if (!doc) return null
    const offset = doc.offsetAt(params.position)
    const node: any = root ? findNodeAtOffset(root as any, doc, offset) : null
    const wr = wordRangeAt(doc, offset)
    const token = node ? (String(node.type || node.value || '')) : (wr?.text || '')
    if (!token) { log(`[view.tree] definition: no-token`); return null }

    let classHits = findClassDefs(token)
    const propHits = findPropDefs(token)

    const locs: Location[] = []
    for (const hit of [...classHits, ...propHits]) {
        locs.push({
            uri: hit.uri,
            range: {
                start: { line: hit.spot.line, character: hit.spot.col },
                end: { line: hit.spot.line, character: hit.spot.col + hit.spot.length },
            },
        })
    }
    // Fallback: if class-like and not indexed yet, point to expected file start
    if (!locs.length && classLike(token) && workspaceRootFs) {
        const rel = classNameToRelPath(token)
        const fsPath = require('path').join(workspaceRootFs, rel)
        const uriGuess = fsPathToUri(fsPath)
        locs.push({ uri: uriGuess, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } })
    }
    log(`[view.tree] definition: token=${token} hits=${locs.length}`)
    return (locs.length ? (locs.length === 1 ? locs[0] : locs) : null) as Definition
})

connection.onReferences(params => {
    const uri = params.textDocument.uri
    const doc = documents.get(uri)
    const root = trees.get(uri)
    if (!doc) return null
    const offset = doc.offsetAt(params.position)
    const node: any = root ? findNodeAtOffset(root as any, doc, offset) : null
    const wr = wordRangeAt(doc, offset)
    const token = node ? (String(node.type || node.value || '')) : (wr?.text || '')
    if (!token) { log(`[view.tree] references: no-token`); return [] }

    const hits = findRefs(token)
    const refs = hits.map(h => ({
        uri: h.uri,
        range: {
            start: { line: h.spot.line, character: h.spot.col },
            end: { line: h.spot.line, character: h.spot.col + h.spot.length },
        },
    }))
    log(`[view.tree] references: token=${token} hits=${refs.length}`)
    return refs
})

// Document formatting (full)
connection.onDocumentFormatting(params => {
    const uri = params.textDocument.uri
    const doc = documents.get(uri)
    if (!doc) return []
    const original = doc.getText()
    const formatted = formatText(original, uri)
    if (formatted === original) return []
    const edit: TextEdit = {
        range: { start: { line: 0, character: 0 }, end: doc.positionAt(original.length) },
        newText: formatted,
    }
    return [edit]
})

// Quick Fix / Source Action: Format document
connection.onCodeAction(params => {
    const uri = params.textDocument.uri
    const doc = documents.get(uri)
    if (!doc) return []
    const original = doc.getText()
    const formatted = formatText(original, uri)
    if (formatted === original) return []
    const edit: TextEdit = {
        range: { start: { line: 0, character: 0 }, end: doc.positionAt(original.length) },
        newText: formatted,
    }
    const action: CodeAction = {
        title: 'Format (view.tree)',
        kind: CodeActionKind.QuickFix,
        edit: { changes: { [uri]: [edit] } },
        isPreferred: true,
    }
    return [action]
})

// (Removed) On-type formatting: enforcement happens only on explicit format

// Semantic Tokens (full document)
connection.languages.semanticTokens.on((params: SemanticTokensParams): SemanticTokens => {
    const uri = params.textDocument.uri
    const doc = documents.get(uri)
    const root = trees.get(uri)
    const data = buildSemanticTokens(doc as TextDocument, root)
    const count = Math.floor(data.length / 5)
    log(`[view.tree] semanticTokens: uri=${uri} tokens=${count}`)
    return { data }
})

// Rename support
function wordRangeAt(doc: TextDocument, offset: number): { range: Range, text: string } | null {
    const text = doc.getText()
    const isWord = (ch: string) => /[A-Za-z0-9_$]/.test(ch)
    if (!text) return null
    let start = offset
    let end = offset
    while (start > 0 && isWord(text[start - 1])) start--
    while (end < text.length && isWord(text[end])) end++
    if (start === end) return null
    // Ensure token starts with letter or $
    const token = text.slice(start, end)
    if (!/^[A-Za-z$][\w$]*$/.test(token)) return null
    return { range: { start: doc.positionAt(start), end: doc.positionAt(end) }, text: token }
}

connection.onPrepareRename(params => {
    const uri = params.textDocument.uri
    const doc = documents.get(uri)
    if (!doc) return null
    const offset = doc.offsetAt(params.position)
    const wr = wordRangeAt(doc, offset)
    if (!wr) return null
    log(`[view.tree] prepareRename: uri=${uri} token=${wr.text}`)
    return { range: wr.range, placeholder: wr.text }
})

connection.onRenameRequest(params => {
    const uri = params.textDocument.uri
    const doc = documents.get(uri)
    if (!doc) return null
    const offset = doc.offsetAt(params.position)
    const wr = wordRangeAt(doc, offset)
    if (!wr) return null
    const oldName = wr.text
    const newName = params.newName
    if (oldName === newName) return { changes: {} } as WorkspaceEdit

    const hits = findRefs(oldName)
    const changes: Record<string, { range: Range, newText: string }[]> = {}
    for (const h of hits) {
        const arr = changes[h.uri] ?? []
        arr.push({
            range: {
                start: { line: h.spot.line, character: h.spot.col },
                end: { line: h.spot.line, character: h.spot.col + h.spot.length },
            },
            newText: newName,
        })
        changes[h.uri] = arr
    }
    const edit: WorkspaceEdit = { changes }
    const total = Object.values(changes).reduce((n, arr) => n + arr.length, 0)
    log(`[view.tree] rename: ${oldName} -> ${newName} edits=${total}`)
    return edit
})

// Watcher: update cache/index when files change on disk (from client watcher)
connection.onDidChangeWatchedFiles(async (ev) => {
    for (const ch of ev.changes) {
        try {
            const fsPath = uriToFsPath(ch.uri)
            let text = await fs.readFile(fsPath, 'utf8')
            const uri = ch.uri
            let tree: any
            try { tree = $.$mol_tree2.fromString(text, uri) }
            catch (e: any) {
                // Tolerant parse for common whitespace issues
                const msg = String(e?.reason || e?.message || '')
                if (/Wrong nodes separator/.test(msg)) {
                    const fixed = sanitizeSeparators(text)
                    tree = $.$mol_tree2.fromString(fixed, uri)
                } else if (/Unexpected EOF, LF required/.test(msg)) {
                    const fixed = text.endsWith('\n') ? text : text + '\n'
                    tree = $.$mol_tree2.fromString(fixed, uri)
                } else throw e
            }
            trees.set(uri, tree)
            updateIndexForDoc(uri, tree, text)
            connection.console.log(`[view.tree] watched-change parsed: ${uri}`)
        } catch (e: any) {
            connection.console.log(`[view.tree] watched-change failed: ${ch.uri} ${e?.message || e}`)
        }
    }
})

documents.listen(connection)
connection.listen()
