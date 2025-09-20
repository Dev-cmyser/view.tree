import $ from 'mol_tree2'

export function formatText(text: string, uri?: string): string {
  try {
    const tree = $.$mol_tree2.fromString(text, uri)
    // Use mol_tree2 pretty-printer to normalize spaces, tabs, newlines
    return tree.toString()
  } catch {
    // Fallback: normalize newlines and ensure trailing newline
    const unix = text.replace(/\r\n?/g, '\n')
    return unix.endsWith('\n') ? unix : unix + '\n'
  }
}

export function sanitizeSeparators(text: string): string {
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = /^([\t ]*)(.*)$/.exec(line)
    if (!m) continue
    const indent = m[1]
    const rest = m[2]
    if (rest.startsWith('\\')) continue // raw string line: keep spaces
    // collapse multiple spaces in non-raw lines
    lines[i] = indent + rest.replace(/ {2,}/g, ' ')
  }
  return lines.join('\n')
}

export function sanitizeLineSpaces(line: string): string {
  const m = /^([\t ]*)(.*)$/.exec(line)
  if (!m) return line
  const indent = m[1]
  const rest = m[2]
  if (rest.startsWith('\\')) return line
  return indent + rest.replace(/ {2,}/g, ' ')
}
