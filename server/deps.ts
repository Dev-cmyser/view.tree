import * as fs from 'fs/promises'
import * as nodePath from 'path'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { classLike, classNameToRelPath, fsPathToUri } from './resolver'
import $ from 'mol_tree2'

type Ast = any

export function extractClassRefs(root: Ast): Set<string> {
  const out = new Set<string>()
  const walk = (n: any) => {
    if (!n) return
    const t = String(n.type ?? '')
    const v = String(n.value ?? '')
    if (t && classLike(t)) out.add(t)
    if (v && classLike(v)) out.add(v)
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
      const text = buf.toString('utf8')
      const uri = fsPathToUri(abs)
      const tree = $.$mol_tree2.fromString(text, uri)
      trees.set(uri, tree)
      updateIndexForDoc(uri, tree, text)
      const refs = extractClassRefs(tree)
      log?.(`[deps] parsed ${rel} refs=${refs.size} depth=${depth}`)
      for (const ref of refs) if (!visited.has(ref)) queue.push({ name: ref, depth: depth + 1 })
    } catch {
      // Ignore missing files or parse errors quietly for now
      log?.(`[deps] missing or failed: ${rel}`)
      continue
    }
  }
  log?.(`[deps] done visited=${visited.size}`)
}
