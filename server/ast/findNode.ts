import { TextDocument } from 'vscode-languageserver-textdocument'
import { spanContainsOffset } from '../loc'

import type { Ast } from './build'

export function findNodeAtOffset(root: Ast, doc: TextDocument, offset: number): Ast | null {
	if (!root || !root.span) return null
	if (!spanContainsOffset(doc, root.span, offset)) return null

	let found: Ast = root
	for (const kid of (root.kids as Ast[] | undefined) || []) {
		const sub = findNodeAtOffset(kid, doc, offset)
		if (sub) found = sub
	}
	return found
}
