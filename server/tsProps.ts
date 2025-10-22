/**
 * Lightweight TS file parser to extract component properties from class members.
 *
 * - Finds classes whose name starts with `$` (e.g., `export class $mol_view { ... }`).
 * - Extracts property names from:
 *   - method declarations: `name(...) {`
 *   - accessors: `get name(...) {`, `set name(...) {`
 *   - class fields: `name: Type`, `name = expr`
 * - Excludes: `constructor`, names starting with `_`, and non-lowercase-starting identifiers.
 * - Handles multiple classes per file.
 *
 * Note: This is a heuristic (regex + brace depth) approach designed to run inside the LSP server
 * without adding heavy dependencies. It aims to be robust for typical $mol code patterns.
 */

export type TsComponentProps = Map<string, Set<string>>

/**
 * Extracts properties per $-prefixed class from given TypeScript source text.
 */
export function extractTsProps(tsText: string): TsComponentProps {
  const out: TsComponentProps = new Map()

  const classes = findDollarClasses(tsText)
  for (const cls of classes) {
    const props = extractPropsFromClassBody(cls.body)
    if (!out.has(cls.name)) out.set(cls.name, new Set())
    const bucket = out.get(cls.name)!
    for (const p of props) bucket.add(p)
  }

  return out
}

/**
 * Finds $-prefixed classes and their body substring with balanced braces.
 */
function findDollarClasses(text: string): Array<{ name: string; body: string }> {
  const results: Array<{ name: string; body: string }> = []
  const classRe = /\bclass\s+(\$[A-Za-z]\w*)\b/g
  let m: RegExpExecArray | null

  while ((m = classRe.exec(text))) {
    const name = m[1]
    const braceStart = text.indexOf('{', m.index)
    if (braceStart < 0) continue
    const body = balancedBlock(text, braceStart)
    if (!body) continue
    results.push({ name, body })
  }

  return results
}

/**
 * Returns the balanced block substring starting at the given '{' index,
 * excluding the outer braces. If unbalanced, returns empty string.
 */
function balancedBlock(text: string, openIndex: number): string {
  if (openIndex < 0 || text[openIndex] !== '{') return ''
  let depth = 0
  let i = openIndex
  const len = text.length

  // Pre-strip block comments to reduce brace noise.
  const stripped = stripBlockComments(text)

  // Remap 'openIndex' for stripped content by scanning up to openIndex counting same characters.
  // For simplicity, we assume comments before openIndex are rare and the brace position is stable.
  // Fallback: still use original index if mismatch detected.
  let sIdx = openIndex
  if (stripped.length === text.length) {
    // No block comments removed, use as is.
  } else {
    // Try to find the same brace occurrence near the original index.
    const probe = Math.max(0, openIndex - 3)
    const idx2 = stripped.indexOf('{', probe)
    if (idx2 >= 0 && Math.abs(idx2 - openIndex) <= 5) sIdx = idx2
  }

  for (i = sIdx; i < stripped.length; i++) {
    const ch = stripped[i]
    if (ch === '{') {
      depth++
      if (depth === 1) continue
    } else if (ch === '}') {
      depth--
      if (depth === 0) {
        // return body excluding outer braces
        return stripped.slice(sIdx + 1, i)
      }
    }
  }

  return ''
}

/**
 * Extracts property names from a single class body (without outer braces).
 * Only matches members at top-level of the class body (depth === 1).
 */
function extractPropsFromClassBody(body: string): string[] {
  const props = new Set<string>()
  // Remove block comments to stabilize brace tracking and line content
  const cleaned = stripBlockComments(body)

  let depth = 1 // We're inside the class body (outer is already entered)
  const lines = cleaned.split('\n')

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // Remove single-line comments and strings for brace-count stability
    line = stripLineComments(line)
    const lineForBrace = stripStrings(line)

    // Current line is considered at 'depth' before updating it with this line's braces.
    if (depth === 1) {
      // Attempt to match class members (methods, accessors, fields) declared at top-level.
      const name =
        matchMethodName(line) ||
        matchAccessorName(line) ||
        matchFieldName(line)

      if (name && isAcceptablePropName(name)) {
        props.add(name)
      }
    }

    // Update depth for next iteration
    depth += countChar(lineForBrace, '{') - countChar(lineForBrace, '}')
    if (depth < 1) depth = 1 // avoid negative due to malformed input
  }

  // Exclude reserved
  props.delete('constructor')

  return Array.from(props)
}

/**
 * Accept view.tree property naming: start with lowercase letter, not private (_)
 */
function isAcceptablePropName(name: string): boolean {
  return /^[a-z][\w]*$/.test(name) && !name.startsWith('_') && name !== 'constructor'
}

function matchMethodName(line: string): string | null {
  // Examples:
  //   name( ... ) { ... }
  //   public name( ... ) { ... }
  //   protected name( ... ) { ... }
  //   static name( ... ) { ... }
  //   async name( ... ) { ... }
  //   name<T>( ... ) { ... }
  const re =
    /^(?:\s*(?:public|protected|private|readonly|abstract|static|async)\s+)*\s*([a-z]\w*)\s*(?:<[^>]*>)?\s*\(/;
  const m = re.exec(line)
  return m ? m[1] : null
}

function matchAccessorName(line: string): string | null {
  // Examples:
  //   get name() { ... }
  //   set name(v: T) { ... }
  const re = /^(?:\s*(?:public|protected|private|static)\s+)*\s*(?:get|set)\s+([a-z]\w*)\s*\(/;
  const m = re.exec(line)
  return m ? m[1] : null
}

function matchFieldName(line: string): string | null {
  // Examples:
  //   name: Type
  //   name?: Type
  //   name!: Type
  //   name = expr
  //   public name = ...
  const re =
    /^(?:\s*(?:public|protected|private|readonly|static)\s+)*\s*([a-z]\w*)\s*(?:[?!])?\s*(?::|=)\s*/;
  const m = re.exec(line)
  return m ? m[1] : null
}

function countChar(s: string, ch: string): number {
  let c = 0
  for (let i = 0; i < s.length; i++) if (s[i] === ch) c++
  return c
}

function stripLineComments(line: string): string {
  // remove // ... but keep URLs like http:// (rare in TS code lines for class members)
  const idx = line.indexOf('//')
  if (idx >= 0) return line.slice(0, idx)
  return line
}

function stripStrings(s: string): string {
  // Remove contents of "string", 'string', `template`
  // Note: heuristic that doesn't fully handle all escape corner cases.
  return s
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
}

function stripBlockComments(s: string): string {
  // Non-greedy remove of /* ... */ blocks
  return s.replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * Utility to merge multiple TsComponentProps maps into one.
 */
export function mergeTsPropsMaps(...maps: TsComponentProps[]): TsComponentProps {
  const out: TsComponentProps = new Map()
  for (const m of maps) {
    for (const [cls, props] of m) {
      if (!out.has(cls)) out.set(cls, new Set())
      const bucket = out.get(cls)!
      for (const p of props) bucket.add(p)
    }
  }
  return out
}
