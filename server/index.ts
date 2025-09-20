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
    if (tree) {
        trees.set(uri, tree)
        log(`[mol_tree2] parsed ${uri}:\n${tree.toString()}`)
    } else {
        trees.delete(uri)
        if (diagnostics[0]) log(`[mol_tree2] parse error: ${diagnostics[0].message}`)
    }

    // Update project index using AST + text
    updateIndexForDoc(uri, tree, text)

    connection.sendDiagnostics({ uri, diagnostics })
    {
        const stats = getIndexStats(uri)
        log(`[view.tree] diagnostics: uri=${uri} count=${diagnostics.length} index=classes:${stats.classes} props:${stats.props} occs:${stats.occs}`)
    }

    // Recursively load dependencies (class references) from workspace
    try {
        if (workspaceRootFs && tree) {
            const refs = extractClassRefs(tree as any)
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

connection.onHover(params => {
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
    const defs = [...findClassDefs(token), ...findPropDefs(token)]

    // If class-like symbol, show top-level props from its class AST as a newline list
    let propsBlock = ''
    if (classLike(token)) {
        const target = defs[0]
        const targetUri = target?.uri
        const targetTree = targetUri ? trees.get(targetUri) : undefined
        if (targetTree) {
            const classNode: any = (targetTree.kids || []).find((k: any) => String(k.type) === token) || targetTree
            const lines: string[] = []
            for (const kid of (classNode.kids || [])) {
                const t = String(kid.type || '')
                if (/^[a-z][\w]*$/.test(t)) {
                    let line = t
                    const first = (kid.kids && kid.kids[0])
                    if (first && first.type === '*') {
                        const dv = first.kids && first.kids[0]
                        const grp = dv && String(dv.type || '') === '' && dv.value ? String(dv.value) : ''
                        line += ` *${grp}`
                    }
                    lines.push(line)
                }
            }
            if (lines.length) propsBlock = lines.join('\n')
        }
    }

    const contents = [
        `view.tree: ${header}${value}`,
        propsBlock,
    ].filter(Boolean).join('\n')

    const range = node?.span ? spanToRange(node.span) : (wr?.range)
    const hover: Hover = { contents: { kind: 'markdown', value: contents }, range }
    log(`[view.tree] hover: uri=${uri} token=${token} hits=${defs.length} range=${range ? `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}` : 'n/a'}`)
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
            const text = await fs.readFile(fsPath, 'utf8')
            const uri = ch.uri
            const tree = $.$mol_tree2.fromString(text, uri)
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
