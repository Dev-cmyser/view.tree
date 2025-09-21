import * as fs from 'fs/promises'
import * as path from 'path'
import $ from 'mol_tree2'
import { sanitizeSeparators } from './format'
import { fsPathToUri } from './resolver'

type Ast = any

async function* walk(dir: string, ignore: Set<string>): AsyncGenerator<string> {
  let entries: any[] = []
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (ignore.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      yield* walk(p, ignore)
    } else if (e.isFile() && p.endsWith('.view.tree')) {
      yield p
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
      let tree: any
      try { tree = $.$mol_tree2.fromString(text0, uri) }
      catch (e: any) {
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
    } catch {}
  }
  log?.(`[scan] done. indexed files=${count}`)
}

