import * as fs from 'fs/promises'
import * as path from 'path'
import $ from 'mol_tree2'
import { sanitizeSeparators } from './format'
import { fsPathToUri } from './resolver'
import { extractTsProps } from './tsProps'

type Ast = any

function buildSyntheticAstFromTsProps(map: Map<string, Set<string>>): Ast {
	// Create a minimal AST that indexer can consume:
	// - top-level children are class-like nodes (type="$Name"), col=1 to be treated as top-level
	// - their children are property nodes (type="prop"), also with spans
	const kids: any[] = []
	let row = 1
	for (const [cls, props] of map) {
		const classNode: any = {
			type: cls,
			span: { row, col: 1, length: cls.length },
			kids: [] as any[],
		}
		row++
		for (const p of props) {
			classNode.kids.push({
				type: p,
				span: { row, col: 2, length: p.length },
				kids: [],
			})
			row++
		}
		kids.push(classNode)
	}
	return { type: '', span: { row: 1, col: 1, length: 1 }, kids }
}

async function* walk(dir: string, ignore: Set<string>): AsyncGenerator<string> {
	let entries: any[] = []
	try {
		entries = await fs.readdir(dir, { withFileTypes: true })
	} catch {
		return
	}
	for (const e of entries) {
		if (ignore.has(e.name)) continue
		const p = path.join(dir, e.name)
		if (e.isDirectory()) {
			yield* walk(p, ignore)
		} else if (e.isFile()) {
			if (p.endsWith('.view.tree')) {
				yield p
			} else if (p.endsWith('.ts') && !p.endsWith('.d.ts')) {
				yield p
			}
		}
	}
}

export async function scanProject(
	workspaceRootFs: string,
	trees: Map<string, Ast>,
	updateIndexForDoc: (uri: string, tree: Ast | null | undefined, text?: string) => void,
	log?: (msg: string) => void,
) {
	const ignore = new Set(['node_modules', '.git', 'out', 'dist', 'build'])
	let count = 0
	for await (const file of walk(workspaceRootFs, ignore)) {
		try {
			const text0 = await fs.readFile(file, 'utf8')
			const uri = fsPathToUri(file)
			if (file.endsWith('.view.tree')) {
				let tree: any
				try {
					tree = $.$mol_tree2.fromString(text0, uri)
				} catch (e: any) {
					const msg = String(e?.reason || e?.message || '')
					let text = text0
					if (/Wrong nodes separator/.test(msg)) text = sanitizeSeparators(text)
					if (!/\n$/.test(text)) text += '\n'
					tree = $.$mol_tree2.fromString(text, uri)
				}
				trees.set(uri, tree)
				updateIndexForDoc(uri, tree, undefined)
				count++
				if (count % 50 === 0) log?.(`[scan] indexed files=${count}`)
			} else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
				// Extract TS-based component properties and feed a synthetic AST into the indexer
				const compMap = extractTsProps(text0)
				if (compMap.size) {
					const syn = buildSyntheticAstFromTsProps(compMap)
					updateIndexForDoc(uri, syn, text0)
				}
			}
		} catch {}
	}
	log?.(`[scan] done. indexed files=${count}`)
}
