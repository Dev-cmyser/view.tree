type Spot = { line: number; col: number; length: number }
const classDefsByUri = new Map<string, Map<string, Spot>>()
const propDefsByUri = new Map<string, Map<string, Spot[]>>()
const textByUri = new Map<string, string>()

export function updateIndexForDoc(uri: string, text: string) {
  textByUri.set(uri, text)
  const classDefs = new Map<string, Spot>()
  const propDefs = new Map<string, Spot[]>()

  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.replace(/\t/g, '    ')
    const trimmed = line.trim()
    if (!trimmed) continue

    // Class declarations at line start (allow leading whitespace): $Name | Name
    const classRe = /^\s*(\$?[A-Z][\w]*)\b/
    const classMatch = classRe.exec(raw)
    if (classMatch) {
      const name = classMatch[1]
      const start = classMatch.index + (raw.slice(classMatch.index).match(/^\s*/)?.[0].length ?? 0)
      classDefs.set(name, { line: i, col: start, length: name.length })
      continue
    }

    // Property names at line start (allow leading whitespace): key, key <=, key =
    const propRe = /^\s*([a-z][\w]*)\b/
    const propMatch = propRe.exec(raw)
    if (propMatch) {
      const key = propMatch[1]
      const start = propMatch.index + (raw.slice(propMatch.index).match(/^\s*/)?.[0].length ?? 0)
      const spot: Spot = { line: i, col: start, length: key.length }
      const arr = propDefs.get(key) ?? []
      arr.push(spot)
      propDefs.set(key, arr)
    }
  }

  classDefsByUri.set(uri, classDefs)
  propDefsByUri.set(uri, propDefs)
}

export function removeFromIndex(uri: string) {
  classDefsByUri.delete(uri)
  propDefsByUri.delete(uri)
  textByUri.delete(uri)
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

function escapeRe(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function findRefs(name: string): Array<{ uri: string; spot: Spot }> {
  const out: Array<{ uri: string; spot: Spot }> = []
  const needle = escapeRe(name)
  const re = new RegExp(`(?<![A-Za-z0-9_])${needle}(?![A-Za-z0-9_])`, 'g')
  for (const [uri, text] of textByUri.entries()) {
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      let m: RegExpExecArray | null
      re.lastIndex = 0
      while ((m = re.exec(line))) {
        out.push({ uri, spot: { line: i, col: m.index, length: name.length } })
      }
    }
  }
  return out
}
