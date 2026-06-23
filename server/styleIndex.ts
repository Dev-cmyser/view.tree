/**
 * Index of $mol_style_define / $mol_style_attach calls across the workspace.
 *
 * For each call we extract:
 *  - the target class name (e.g. `$mol_button` from `$mol_style_define( $mol_button, {…} )`)
 *  - the body object literal (balanced `{ … }` substring)
 *  - every PascalCase sub-block inside it, with its nesting path and position
 *
 * That lets us resolve an attribute selector like `[a_b_c]` to all places where it can be edited:
 *   - direct:    `$mol_style_define( $a_b_c, {…} )` (path: [])
 *   - one-deep:  `$mol_style_define( $a_b, { C: {…} } )` (path: ['C'])
 *   - N-deep:    `$mol_style_define( $a, { B: { C: {…} } } )` (path: ['B','C'])
 *
 * Parser is regex + a balanced-brace walker — same approach as `tsProps.ts`.
 * The TypeScript compiler package is deliberately NOT a dependency.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { fsPathToUri, uriToFsPath } from './resolver'

export type StyleBlockEntry = {
	uri: string
	file: string
	// Line/col of the leaf object literal opening `{` (0-based).
	line: number
	col: number
	// Nested PascalCase block path from $mol_style_define root.
	// Empty array means the root object passed to $mol_style_define.
	path: string[]
	// Source text of the leaf object literal (with outer `{` `}`).
	source: string
	// Which call kind defined this entry.
	kind: 'define' | 'attach'
	// Root class name passed to $mol_style_define/attach (e.g. "$mol_link").
	// Needed to locate this block when applying an edit.
	rootClass: string
}

// Index keyed by the COMPUTED selector attribute name.
// Root call `$mol_style_define($mol_page, {…})` → selector "mol_page".
// Nested block `Body_content: {…}` inside it → selector "mol_page_body_content"
// (root class minus leading `$`, lowercased path parts joined with `_`).
const bySelector = new Map<string, StyleBlockEntry[]>()

export function clearStyleIndex(): void {
	bySelector.clear()
}

export function removeStyleEntriesForUri(uri: string): void {
	for (const [name, arr] of bySelector) {
		const filtered = arr.filter(e => e.uri !== uri)
		if (filtered.length) bySelector.set(name, filtered)
		else bySelector.delete(name)
	}
}

export function getStyleIndexStats(): { selectors: number; entries: number } {
	let entries = 0
	for (const arr of bySelector.values()) entries += arr.length
	return { selectors: bySelector.size, entries }
}

/**
 * Resolve a selector attribute name (e.g. "my_app_logo") to all matching style entries.
 * Direct lookup — every entry already knows its full selector name.
 */
export function resolveSelector(selectorName: string): StyleBlockEntry[] {
	return bySelector.get(selectorName) ?? []
}

/**
 * Compute the selector attribute name for a (rootClass, nestedPath) pair.
 * Lower-cases path parts as $mol selectors are always lowercase.
 */
function computeSelector(rootClass: string, path: string[]): string {
	const base = rootClass.startsWith('$') ? rootClass.slice(1) : rootClass
	if (!path.length) return base
	return base + '_' + path.map(p => p.toLowerCase()).join('_')
}

/**
 * Parse a `*.view.css.ts` file and add all its style blocks to the index.
 */
export function indexStyleFile(uri: string, file: string, text: string): void {
	removeStyleEntriesForUri(uri)
	const cleaned = stripCommentsKeepingLength(text)
	const callRe = /\$mol_style_(define|attach)\s*\(\s*(\$[A-Za-z][\w$]*)\s*,\s*/g
	let m: RegExpExecArray | null
	while ((m = callRe.exec(cleaned))) {
		const kind = m[1] as 'define' | 'attach'
		const className = m[2]
		const objStart = findNextChar(cleaned, callRe.lastIndex, '{')
		if (objStart < 0) continue
		const objEnd = matchBrace(cleaned, objStart)
		if (objEnd < 0) continue
		const bodySrc = text.slice(objStart, objEnd + 1)
		const rootPos = offsetToLineCol(text, objStart)
		addEntry(computeSelector(className, []), {
			uri,
			file,
			line: rootPos.line,
			col: rootPos.col,
			path: [],
			source: bodySrc,
			kind,
			rootClass: className,
		})
		walkBody(text, cleaned, objStart, objEnd, (innerStart, innerEnd, pathParts) => {
			const innerSrc = text.slice(innerStart, innerEnd + 1)
			const innerPos = offsetToLineCol(text, innerStart)
			addEntry(computeSelector(className, pathParts), {
				uri,
				file,
				line: innerPos.line,
				col: innerPos.col,
				path: pathParts,
				source: innerSrc,
				kind,
				rootClass: className,
			})
		})
		callRe.lastIndex = objEnd + 1
	}
}

function addEntry(name: string, entry: StyleBlockEntry): void {
	const arr = bySelector.get(name) ?? []
	arr.push(entry)
	bySelector.set(name, arr)
}

/**
 * Walk a `{ … }` body and call `onSubBlock` for every nested PascalCase block.
 * Pattern matched: `Foo: { … }` at any depth.
 *
 * `pathParts` is the chain of PascalCase keys from the root down to the visited block.
 */
function walkBody(
	original: string,
	cleaned: string,
	openIdx: number,
	closeIdx: number,
	onSubBlock: (start: number, end: number, pathParts: string[]) => void,
): void {
	type Frame = { end: number; path: string[] }
	const stack: Frame[] = [{ end: closeIdx, path: [] }]
	let i = openIdx + 1
	while (i < closeIdx) {
		// Pop frames we've exited.
		while (stack.length && i > stack[stack.length - 1].end) stack.pop()
		if (!stack.length) break
		const frame = stack[stack.length - 1]
		// Try to match `PascalKey:`-style at this position.
		const tail = cleaned.slice(i, Math.min(i + 200, closeIdx + 1))
		const km = /^\s*([A-Z][A-Za-z0-9_]*)\s*:\s*/.exec(tail)
		if (km) {
			const keyName = km[1]
			const afterKey = i + km[0].length
			if (cleaned[afterKey] === '{') {
				const subOpen = afterKey
				const subClose = matchBrace(cleaned, subOpen)
				if (subClose > subOpen) {
					const newPath = [...frame.path, keyName]
					onSubBlock(subOpen, subClose, newPath)
					stack.push({ end: subClose, path: newPath })
					i = subOpen + 1
					continue
				}
			}
		}
		i++
	}
}

function findNextChar(s: string, from: number, ch: string): number {
	for (let i = from; i < s.length; i++) {
		const c = s[i]
		if (c === ch) return i
		if (!/\s/.test(c)) return -1 // anything else between `,` and `{` = malformed call
	}
	return -1
}

function matchBrace(s: string, openIdx: number): number {
	let depth = 0
	let inStr: '"' | "'" | '`' | null = null
	for (let i = openIdx; i < s.length; i++) {
		const c = s[i]
		if (inStr) {
			if (c === '\\') { i++; continue }
			if (c === inStr) inStr = null
			continue
		}
		if (c === '"' || c === "'" || c === '`') { inStr = c; continue }
		if (c === '{') depth++
		else if (c === '}') {
			depth--
			if (depth === 0) return i
		}
	}
	return -1
}

function offsetToLineCol(text: string, offset: number): { line: number; col: number } {
	let line = 0
	let lastNl = -1
	for (let i = 0; i < offset; i++) {
		if (text.charCodeAt(i) === 10) {
			line++
			lastNl = i
		}
	}
	return { line, col: offset - lastNl - 1 }
}

/**
 * Replace block comments and line comments with spaces of the same length,
 * so absolute character offsets stay valid against the original `text`.
 */
function stripCommentsKeepingLength(text: string): string {
	const out: string[] = []
	let i = 0
	const n = text.length
	let inStr: '"' | "'" | '`' | null = null
	while (i < n) {
		const c = text[i]
		if (inStr) {
			out.push(c)
			if (c === '\\' && i + 1 < n) { out.push(text[i + 1]); i += 2; continue }
			if (c === inStr) inStr = null
			i++
			continue
		}
		if (c === '"' || c === "'" || c === '`') { inStr = c; out.push(c); i++; continue }
		if (c === '/' && text[i + 1] === '/') {
			while (i < n && text[i] !== '\n') { out.push(' '); i++ }
			continue
		}
		if (c === '/' && text[i + 1] === '*') {
			out.push(' '); out.push(' '); i += 2
			while (i < n && !(text[i] === '*' && text[i + 1] === '/')) {
				out.push(text[i] === '\n' ? '\n' : ' ')
				i++
			}
			if (i < n) { out.push(' '); out.push(' '); i += 2 }
			continue
		}
		out.push(c)
		i++
	}
	return out.join('')
}

/**
 * Apply an edit to a style block identified by (uri, rootClass, path).
 *
 * Re-reads the file from disk, locates the `$mol_style_define($rootClass, …)` (or `_attach`)
 * call, descends into nested PascalCase blocks following `path`, and replaces the matched
 * `{ … }` (inclusive of both braces) with `newValue`. The new value must itself be a
 * balanced TS object literal (starts with `{`, ends with `}`) — we don't accept anything
 * else to avoid producing broken source.
 */
export type ApplyEditResult =
	| { ok: true; uri: string; line: number; col: number }
	| { ok: false; error: string }

export async function applyEdit(
	uri: string,
	rootClass: string,
	targetPath: string[],
	newValue: string,
): Promise<ApplyEditResult> {
	if (!/^\{[\s\S]*\}$/.test(newValue.trim())) {
		return { ok: false, error: 'newValue must be a TS object literal: { … }' }
	}
	let fsPath: string
	try { fsPath = uriToFsPath(uri) } catch (e: any) {
		return { ok: false, error: `bad uri: ${e?.message || e}` }
	}
	let text: string
	try { text = await fs.readFile(fsPath, 'utf8') } catch (e: any) {
		return { ok: false, error: `read failed: ${e?.message || e}` }
	}
	const cleaned = stripCommentsKeepingLength(text)
	const range = locateBlockRange(cleaned, rootClass, targetPath)
	if (!range) return { ok: false, error: `block not found: ${rootClass} ${targetPath.join('.')}` }

	const before = text.slice(0, range.start)
	const after = text.slice(range.end + 1)
	const next = before + newValue + after
	try { await fs.writeFile(fsPath, next, 'utf8') } catch (e: any) {
		return { ok: false, error: `write failed: ${e?.message || e}` }
	}
	// Re-index the updated file so future resolves see the new source.
	try { indexStyleFile(uri, fsPath, next) } catch {}
	const pos = offsetToLineCol(next, range.start)
	return { ok: true, uri, line: pos.line, col: pos.col }
}

/**
 * Find the byte range [start, end] (both inclusive, brace-to-brace) of the block
 * identified by rootClass + path inside an already-comment-stripped source.
 */
function locateBlockRange(cleaned: string, rootClass: string, targetPath: string[]): { start: number; end: number } | null {
	const escaped = rootClass.replace(/[$.*+?^()[\]{}|\\]/g, '\\$&')
	const callRe = new RegExp(`\\$mol_style_(?:define|attach)\\s*\\(\\s*${escaped}\\s*,\\s*`, 'g')
	let m: RegExpExecArray | null
	while ((m = callRe.exec(cleaned))) {
		const objStart = findNextChar(cleaned, callRe.lastIndex, '{')
		if (objStart < 0) continue
		const objEnd = matchBrace(cleaned, objStart)
		if (objEnd < 0) continue
		if (targetPath.length === 0) {
			return { start: objStart, end: objEnd }
		}
		const sub = findBlockByPath(cleaned, objStart, objEnd, targetPath)
		if (sub) return sub
	}
	return null
}

function findBlockByPath(
	cleaned: string,
	openIdx: number,
	closeIdx: number,
	pathParts: string[],
): { start: number; end: number } | null {
	let curOpen = openIdx
	let curClose = closeIdx
	for (const key of pathParts) {
		const sub = findChildBlock(cleaned, curOpen, curClose, key)
		if (!sub) return null
		curOpen = sub.start
		curClose = sub.end
	}
	return { start: curOpen, end: curClose }
}

/** Look for `Key: {` directly inside the block (depth 1). */
function findChildBlock(cleaned: string, openIdx: number, closeIdx: number, key: string): { start: number; end: number } | null {
	let depth = 0
	let i = openIdx
	while (i < closeIdx) {
		const c = cleaned[i]
		if (c === '{') { depth++; i++; continue }
		if (c === '}') { depth--; i++; continue }
		if (depth === 1) {
			const tail = cleaned.slice(i, Math.min(i + 200, closeIdx + 1))
			const km = new RegExp('^\\s*' + key.replace(/[$.*+?^()[\\]{}|\\\\]/g, '\\$&') + '\\s*:\\s*').exec(tail)
			if (km) {
				const afterKey = i + km[0].length
				if (cleaned[afterKey] === '{') {
					const subClose = matchBrace(cleaned, afterKey)
					if (subClose > afterKey) return { start: afterKey, end: subClose }
				}
			}
		}
		i++
	}
	return null
}

/**
 * Walk a workspace root and index every *.view.css.ts file found.
 */
export async function scanStyleFiles(
	workspaceRootFs: string,
	log?: (msg: string) => void,
): Promise<number> {
	const ignore = new Set(['node_modules', '.git', 'out', 'dist', 'build'])
	let count = 0
	async function* walk(dir: string): AsyncGenerator<string> {
		let entries: any[] = []
		try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
		for (const e of entries) {
			if (ignore.has(e.name)) continue
			const p = path.join(dir, e.name)
			if (e.isDirectory()) yield* walk(p)
			else if (e.isFile() && p.endsWith('.view.css.ts')) yield p
		}
	}
	for await (const file of walk(workspaceRootFs)) {
		try {
			const text = await fs.readFile(file, 'utf8')
			const uri = fsPathToUri(file)
			indexStyleFile(uri, file, text)
			count++
		} catch (e: any) {
			log?.(`[style-index] failed ${file}: ${e?.message || e}`)
		}
	}
	log?.(`[style-index] done. files=${count} ${JSON.stringify(getStyleIndexStats())}`)
	return count
}
