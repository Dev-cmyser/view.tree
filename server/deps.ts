import * as fs from 'fs/promises'
import * as nodePath from 'path'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { classLike, classNameToRelPath, fsPathToUri } from './resolver'
import $ from 'mol_tree2'
import { sanitizeSeparators } from './format'

type Ast = any

export function extractClassRefs(root: Ast): Set<string> {
  const out = new Set<string>()
  const walk = (n: any) => {
    if (!n) return
    const t = String(n.type ?? '')
    // Only $-prefixed word-like tokens to avoid props like dom_name, natural_height, etc.
    if (/^\$[A-Za-z][\w]*$/.test(t)) out.add(t)
    const kids: any[] = (n.kids || []) as any
    for (const k of kids) walk(k)
  }
  walk(root)
  return out
}

export async function loadDependencies(
  workspaceRootFs: string,
  entryRefs: Iterable<string>,
  trees: Map<string, Ast>,
  updateIndexForDoc: (uri: string, tree: Ast | null | undefined, text?: string) => void,
  maxDepth = 50,
  log?: (msg: string) => void,
): Promise<void> {
  const visited = new Set<string>()
  const queue: Array<{ name: string; depth: number }> = []
  for (const name of entryRefs) queue.push({ name, depth: 0 })
  log?.(`[deps] start queue size=${queue.length}`)

  while (queue.length) {
    const { name, depth } = queue.shift()!
    if (visited.has(name)) continue
    visited.add(name)
    if (depth > maxDepth) { log?.(`[deps] maxDepth reached for ${name}`); continue }

    const rel = classNameToRelPath(name)
    const abs = nodePath.join(workspaceRootFs, rel)
    try {
      log?.(`[deps] try ${rel}`)
      const buf = await fs.readFile(abs)
      let text = buf.toString('utf8')
      const uri = fsPathToUri(abs)
      let tree: any
      try { tree = $.$mol_tree2.fromString(text, uri) }
      catch (e:any) {
        const msg = String(e?.reason || e?.message || '')
        if (/Wrong nodes separator/.test(msg)) {
          text = sanitizeSeparators(text)
          tree = $.$mol_tree2.fromString(text, uri)
        } else if (/Unexpected EOF, LF required/.test(msg)) {
          text = text.endsWith('\n') ? text : text + '\n'
          tree = $.$mol_tree2.fromString(text, uri)
        } else throw e
      }
      trees.set(uri, tree)
      updateIndexForDoc(uri, tree, text)
      const refs = extractClassRefs(tree)
      log?.(`[deps] parsed ${rel} refs=${refs.size} depth=${depth}`)
      for (const ref of refs) if (!visited.has(ref)) queue.push({ name: ref, depth: depth + 1 })
    } catch {
      // Ignore missing files or parse errors quietly
      continue
    }
  }
  log?.(`[deps] done visited=${visited.size}`)
}
