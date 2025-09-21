import $ from 'mol_tree2'

export function formatText(text: string, _uri?: string): string {
  // Non-destructive formatter: keep line structure, collapse multiple spaces, normalize newlines, ensure trailing LF
  const unix = text.replace(/\r\n?/g, '\n')
  const sanitized = sanitizeSeparators(unix)
  return sanitized.endsWith('\n') ? sanitized : sanitized + '\n'
}

export function sanitizeSeparators(text: string): string {
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = /^([\t ]*)(.*)$/.exec(line)
    if (!m) continue
    // Enforce tabs-only indentation: convert any leading spaces to tabs (1:1)
    const indent = m[1].replace(/ +/g, '\\t')
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
  const indent = m[1].replace(/ +/g, '\\t')
  const rest = m[2]
  if (rest.startsWith('\\')) return line
  return indent + rest.replace(/ {2,}/g, ' ')
}

export function spacingDiagnostics(text: string): Array<{ line: number; start: number; end: number; message: string }> {
  const issues: Array<{ line: number; start: number; end: number; message: string }> = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const m = /^(\t*)(.*)$/.exec(raw)
    if (!m) continue
    const rest = m[2]
    if (rest.startsWith('\\')) continue
    const ms = /( {2,})/.exec(rest)
    if (!ms) continue
    const start = m[1].length + ms.index
    const end = start + ms[0].length
    issues.push({ line: i, start, end, message: 'Multiple spaces — use single space' })
  }
  return issues
}
