import * as nodePath from 'path'
import { DocumentSymbol, SymbolKind, InlayHint } from 'vscode-languageserver/node'

type Line = { line: number; depth: number; col: number; size: number; tokens: string[] }

const ops = new Set(['<=', '<=>', '=>'])

function readLines(text: string): Line[] {
	return text
		.replace(/\r\n?/g, '\n')
		.split('\n')
		.map((raw, line) => {
			const depth = /^\t*/.exec(raw)![0].length
			return { line, depth, col: depth, size: raw.length, tokens: raw.slice(depth).split(/\s+/).filter(Boolean) }
		})
}

function isName(token: string) {
	return /^[$A-Za-z][\w$]*[?*]?$/.test(token)
}

function describe(tokens: string[]): { name: string; detail: string } | null {
	if (ops.has(tokens[0])) {
		if (!tokens[1] || !isName(tokens[1])) return null
		return { name: tokens[1], detail: [tokens[0], ...tokens.slice(1)].join(' ') }
	}
	if (!isName(tokens[0])) return null
	const at = tokens.findIndex(t => ops.has(t))
	if (at > 0 && tokens[at + 1]) return { name: tokens[0], detail: `${tokens[at]} ${tokens[at + 1]}` }
	if (tokens.includes('^')) return { name: tokens[0], detail: '^' }
	return { name: tokens[0], detail: tokens.slice(1).join(' ') }
}

export function documentSymbols(text: string): DocumentSymbol[] {
	const lines = readLines(text)
	const top: DocumentSymbol[] = []
	const stack: Array<{ depth: number; sym: DocumentSymbol | null }> = []
	for (let i = 0; i < lines.length; i++) {
		const { line, depth, col, tokens } = lines[i]
		if (!tokens.length) continue
		while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop()
		const parent = stack.length ? stack[stack.length - 1].sym : undefined
		if (parent === null) {
			stack.push({ depth, sym: null })
			continue
		}
		const info = tokens[0] === '-' ? null : describe(tokens)
		if (!info) {
			if (tokens[0] === '-') stack.push({ depth, sym: null })
			continue
		}
		let end = i
		for (let k = i + 1; k < lines.length; k++) {
			if (!lines[k].tokens.length) continue
			if (lines[k].depth <= depth) break
			end = k
		}
		const nameCol = nameColumn(tokens, col, info.name)
		const sym: DocumentSymbol = {
			name: info.name,
			detail: info.detail,
			kind: depth === 0 ? SymbolKind.Class : /^[A-Z]/.test(info.name) ? SymbolKind.Object : SymbolKind.Property,
			range: { start: { line, character: 0 }, end: { line: lines[end].line, character: lines[end].size } },
			selectionRange: { start: { line, character: nameCol }, end: { line, character: nameCol + info.name.length } },
			children: [],
		}
		;(parent ? parent.children! : top).push(sym)
		stack.push({ depth, sym })
	}
	return top
}

function nameColumn(tokens: string[], col: number, name: string) {
	let at = col
	for (const t of tokens) {
		if (t === name) return at
		at += t.length + 1
	}
	return col
}

export function bindingHints(text: string, overridden: Set<string>, tsFile: string): InlayHint[] {
	const lines = readLines(text)
	const cls = lines[0]?.tokens[0]?.replace(/^﻿/, '') ?? ''
	if (!cls) return []
	const hints: InlayHint[] = []
	for (const { line, depth, size, tokens } of lines) {
		if (depth === 0 || !tokens.length || tokens[0] === '-') continue
		const at = tokens.findIndex(t => t === '<=' || t === '<=>')
		if (at < 0 || !tokens[at + 1]) continue
		if (at === 0 && tokens.length > 2) continue
		const prop = tokens[at + 1].replace(/[?*]$/, '')
		const label = overridden.has(prop) ? `← перекрыто в ${tsFile}` : `← ${cls}.${prop}`
		hints.push({ position: { line, character: size }, label, paddingLeft: true })
	}
	return hints
}

export type Deps = { files?: string[]; deps_out?: Record<string, Record<string, number>> }

export function flowMarkdown(module: string, deps: Deps): string {
	const files = [...(deps.files ?? [])].reverse()
	const code = (f: string) => /\.(view\.tree|ts)$/.test(f) && !/\.d\.ts$/.test(f)
	const order: string[] = []
	const own = new Map<string, string[]>()
	for (const file of files) {
		const dir = nodePath.posix.dirname(file)
		if (!own.has(dir)) own.set(dir, [])
		own.get(dir)!.push(file)
	}
	for (const [dir, list] of own) if (list.some(code) && !/(^|\/)-/.test(dir)) order.push(dir)
	const known = new Set(order)
	const base = nodePath.posix.join(module, '-')
	const out = [`# Поток ${module}`, '', 'От приложения к листьям, в порядке, обратном бандлу.', '']
	for (const dir of order) {
		out.push(`## ${dir}`, '')
		for (const file of own.get(dir)!.filter(f => !/(^|\/)(LICENSE|README\.md|readme\.md)$/.test(f))) {
			out.push(`- [${nodePath.posix.basename(file)}](${nodePath.posix.relative(base, file)})`)
		}
		const uses = Object.keys(deps.deps_out?.[dir] ?? {}).filter(d => d !== dir && known.has(d))
		if (uses.length) out.push('', `Зависит от: ${uses.map(d => '`' + d + '`').join(', ')}`)
		out.push('')
	}
	return out.join('\n')
}

export function findDepsDir(fsPath: string, root: string): string | null {
	const fs = require('fs') as typeof import('fs')
	let dir = nodePath.dirname(fsPath)
	while (dir.startsWith(root) && dir !== root) {
		if (fs.existsSync(nodePath.join(dir, '-', 'web.deps.json'))) return dir
		dir = nodePath.dirname(dir)
	}
	return null
}
