import { classLike } from './resolver'

type Spot = { line: number; col: number; length: number }
import type { Ast } from './ast/build'
const classDefsByUri = new Map<string, Map<string, Spot>>()
const propDefsByUri = new Map<string, Map<string, Spot[]>>()
const occByUri = new Map<string, Map<string, Spot[]>>()
const textByUri = new Map<string, string>()
const compPropsByUri = new Map<string, Map<string, { properties: Set<string>; spot: Spot }>>()
const tsCompPropsByUri = new Map<string, Map<string, Set<string>>>()

export function updateIndexForDoc(uri: string, root: Ast | null | undefined, text?: string) {
	if (typeof text === 'string') textByUri.set(uri, text)
	const classDefs = new Map<string, Spot>()
	const propDefs = new Map<string, Spot[]>()
	const occs = new Map<string, Spot[]>()
	const compProps = new Map<string, { properties: Set<string>; spot: Spot }>()

	function addOcc(name: string, spot: Spot) {
		const arr = occs.get(name) ?? []
		arr.push(spot)
		occs.set(name, arr)
	}

	function ensureComp(name: string, spot: Spot) {
		if (!compProps.has(name)) {
			compProps.set(name, { properties: new Set<string>(), spot })
		}
	}

	function addPropToComp(compName: string | undefined, propName: string) {
		if (!compName) return
		const rec = compProps.get(compName)
		if (rec) rec.properties.add(propName)
	}

	const keywordProps = new Set(['true', 'false', 'null', 'nan', 'infinity'])

	function isPropName(name: string): boolean {
		// Allow leading letter (upper or lower), underscores/digits inside, optional trailing '?'
		if (!/^[A-Za-z][\w]*\??$/.test(name)) return false
		const base = name.endsWith('?') ? name.slice(0, -1) : name
		return !keywordProps.has(base.toLowerCase())
	}

	function walk(node: Ast, currentClass?: string) {
		if (!node || !node.span) return
		const span = node.span
		const row = Math.max(0, Number(span.row || 1) - 1)
		const col = Math.max(0, Number(span.col || 1) - 1)

		if (node.type) {
			const name = String(node.type)
			const spot: Spot = { line: row, col, length: name.length }
			addOcc(name, spot)

			if (classLike(name) && col <= 0) {
				// Top-level class-like: record class def
				classDefs.set(name, spot)
				ensureComp(name, spot)

				// Recursively collect properties within the class subtree:
				// - skip $-prefixed nodes (classes/components)
				// - skip operators (/ * ^ = <= <=> @ \)
				// - skip keywords (true/false/null/NaN/Infinity)
				const opSet = new Set<string>(['/', '*', '^', '=', '<=', '<=>', '@', '\\'])
				const kids: Ast[] = (node.kids || []) as any
				const pushProp = (kt: string, kspanLike: any) => {
					const kspan = kspanLike || { row, col: col + 1, length: kt.length }
					const kspot: Spot = {
						line: Math.max(0, Number(kspan.row || 1) - 1),
						col: Math.max(0, Number(kspan.col || 1) - 1),
						length: kt.length,
					}
					const arr = propDefs.get(kt) ?? []
					arr.push(kspot)
					propDefs.set(kt, arr)
					addPropToComp(name, kt)
					addOcc(kt, kspot)
				}
				const collectProps = (n: Ast) => {
					if (!n) return
					const t = String(n.type ?? '')
					if (t && !t.startsWith('$') && isPropName(t) && !opSet.has(t)) {
						pushProp(t, n.span)
					}
					const sub: Ast[] = (n.kids || []) as any
					for (const c of sub) collectProps(c)
				}
				for (const kid of kids) collectProps(kid)

				// Continue walking deeper for occurrences, but don't attribute nested tokens as props twice
				for (const kid of kids) walk(kid, undefined)
				return
			}

			// Property token: record prop definition and map to current class (if any)
			if (currentClass && isPropName(name)) {
				const arr = propDefs.get(name) ?? []
				arr.push(spot)
				propDefs.set(name, arr)
				addPropToComp(currentClass, name)
			}
		} else if (node.value) {
			const val = String(node.value)
			if (/^[A-Za-z$][\w$]*$/.test(val)) {
				const spot: Spot = { line: row, col, length: val.length }
				addOcc(val, spot)
			}
		}

		const kids: Ast[] = (node.kids || []) as any
		for (const k of kids) walk(k, currentClass)
	}

	if (root) walk(root, undefined)

	classDefsByUri.set(uri, classDefs)
	propDefsByUri.set(uri, propDefs)
	occByUri.set(uri, occs)
	compPropsByUri.set(uri, compProps)
}

export function removeFromIndex(uri: string) {
	classDefsByUri.delete(uri)
	propDefsByUri.delete(uri)
	occByUri.delete(uri)
	textByUri.delete(uri)
	compPropsByUri.delete(uri)
	tsCompPropsByUri.delete(uri)
}

export function getAllClasses(): string[] {
	const out = new Set<string>()
	for (const m of classDefsByUri.values()) for (const v of m.keys()) out.add(v)
	return [...out].sort()
}

export function getAllProps(): string[] {
	const out = new Set<string>()
	for (const m of propDefsByUri.values()) for (const v of m.keys()) out.add(v)
	return [...out].sort()
}

export function findClassDefs(name: string): Array<{ uri: string; spot: Spot }> {
	const out: Array<{ uri: string; spot: Spot }> = []
	for (const [uri, map] of classDefsByUri.entries()) {
		const spot = map.get(name)
		if (spot) out.push({ uri, spot })
	}
	return out
}

export function findPropDefs(name: string): Array<{ uri: string; spot: Spot }> {
	const out: Array<{ uri: string; spot: Spot }> = []
	for (const [uri, map] of propDefsByUri.entries()) {
		const spots = map.get(name)
		if (spots) for (const spot of spots) out.push({ uri, spot })
	}
	return out
}

export function findRefs(name: string): Array<{ uri: string; spot: Spot }> {
	const out: Array<{ uri: string; spot: Spot }> = []
	for (const [uri, occs] of occByUri.entries()) {
		const arr = occs.get(name)
		if (!arr) continue
		for (const spot of arr) out.push({ uri, spot })
	}
	return out
}

export function getIndexStats(uri: string): { classes: number; props: number; occs: number } {
	const classes = classDefsByUri.get(uri)?.size ?? 0
	const props = propDefsByUri.get(uri)?.size ?? 0
	const occs = occByUri.get(uri)?.size ?? 0
	return { classes, props, occs }
}

export function updateTsPropsForUri(uri: string, tsMap: Map<string, Set<string>>): void {
	// Replace TS-derived props for this URI without touching class/prop definitions and their positions.
	const clone = new Map<string, Set<string>>()
	for (const [name, set] of tsMap) {
		clone.set(name, new Set(set))
	}
	tsCompPropsByUri.set(uri, clone)
}

export function getComponentsForUri(uri: string): Map<string, { properties: Set<string>; spot: Spot }> {
	return compPropsByUri.get(uri) ?? new Map()
}

export function getAllComponentNames(): string[] {
	const out = new Set<string>()
	for (const m of compPropsByUri.values()) {
		for (const name of m.keys()) out.add(name)
	}
	for (const m of tsCompPropsByUri.values()) {
		for (const name of m.keys()) out.add(name)
	}
	return [...out].sort()
}

export function getComponentProps(name: string): string[] {
	const out = new Set<string>()
	for (const [, map] of compPropsByUri.entries()) {
		const rec = map.get(name)
		if (rec) for (const p of rec.properties) out.add(p)
	}
	for (const [, map] of tsCompPropsByUri.entries()) {
		const props = map.get(name)
		if (props) for (const p of props) out.add(p)
	}
	return [...out].sort()
}

export function getComponentPropsFromViewTree(name: string): string[] {
	const out = new Set<string>()
	for (const [, map] of compPropsByUri.entries()) {
		const rec = map.get(name)
		if (rec) for (const p of rec.properties) out.add(p)
	}
	return [...out].sort()
}

export function getAllComponentsWithProperties(): Array<{ name: string; properties: string[] }> {
	const names = getAllComponentNames()
	return names.map(n => ({ name: n, properties: getComponentProps(n) }))
}
