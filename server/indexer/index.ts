const classesByUri = new Map<string, Set<string>>()
const propsByUri = new Map<string, Set<string>>()

export function updateIndexForDoc(uri: string, text: string) {
  const classes = new Set<string>()
  const props = new Set<string>()

  const lines = text.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.replace(/\t/g, '    ')
    const trimmed = line.trim()
    if (!trimmed) continue

    // Class declarations: "$Name" or "Name" (optional leading '$', starts with uppercase)
    const classMatch = /^(\$?[A-Z][\w]*)\b/.exec(trimmed)
    if (classMatch) {
      classes.add(classMatch[1])
      continue
    }

    // Property names: "key", "key <= $Type", "key = value"
    const propMatch = /^([a-z][\w]*)\b/.exec(trimmed)
    if (propMatch) {
      const key = propMatch[1]
      // Skip special operator-like rows
      if (key !== '/' && key !== '*' && key !== '^') props.add(key)
    }
  }

  classesByUri.set(uri, classes)
  propsByUri.set(uri, props)
}

export function removeFromIndex(uri: string) {
  classesByUri.delete(uri)
  propsByUri.delete(uri)
}

export function getAllClasses(): string[] {
  const out = new Set<string>()
  for (const s of classesByUri.values()) for (const v of s) out.add(v)
  return [...out].sort()
}

export function getAllProps(): string[] {
  const out = new Set<string>()
  for (const s of propsByUri.values()) for (const v of s) out.add(v)
  return [...out].sort()
}
