import { classLike } from './resolver'

type Spot = { line: number; col: number; length: number }
type Ast = any
const classDefsByUri = new Map<string, Map<string, Spot>>()
const propDefsByUri = new Map<string, Map<string, Spot[]>>()
const occByUri = new Map<string, Map<string, Spot[]>>()
const textByUri = new Map<string, string>()
const compPropsByUri = new Map<string, Map<string, { properties: Set<string>; spot: Spot }>>()

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

	function walk(node: Ast, currentClass?: string) {
		if (!node || !node.span) return
		const span = node.span
		const row = Math.max(0, Number(span.row || 1) - 1)
		const col = Math.max(0, Number(span.col || 1) - 1)

		if (node.type) {
			const name = String(node.type)
			const spot: Spot = { line: row, col, length: name.length }
			addOcc(name, spot)

			if (classLike(name) && col === 0) {
				// Top-level class-like: record class def and switch context
				classDefs.set(name, spot)
				ensureComp(name, spot)
				const kids: Ast[] = (node.kids || []) as any
				for (const k of kids) walk(k, name)
				return
			}

			// Property token: record prop definition and map to current class (if any)
			if (/^[a-z][\w]*$/.test(name)) {
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

export function getComponentsForUri(uri: string): Map<string, { properties: Set<string>; spot: Spot }> {
	return compPropsByUri.get(uri) ?? new Map()
}

export function getAllComponentNames(): string[] {
	const out = new Set<string>()
	for (const m of compPropsByUri.values()) {
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
	return [...out].sort()
}

export function getAllComponentsWithProperties(): Array<{ name: string; properties: string[] }> {
	const names = getAllComponentNames()
	return names.map(n => ({ name: n, properties: getComponentProps(n) }))
}
