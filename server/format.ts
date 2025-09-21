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
		const indent = m[1]
		const rest = m[2]
		if (rest.startsWith('\\')) continue // raw string line: keep spaces
		// fix operator tokens broken by spaces, then collapse multiple spaces
    let fixed = rest
    // fix only spaced operators (don't touch already-correct tokens)
    fixed = fixed.replace(/(?:<\s+=\s*>|<\s*=\s+>)/g, '<=>')
    fixed = fixed.replace(/<\s+=/g, '<=')
    fixed = fixed.replace(/=\s+>/g, '=>')
		// disallow raw string after operator usage (invalid), drop trailing raw token
		fixed = fixed.replace(/((?:<=>|<=|=>)\s+\S+)\s+\\.*$/, '$1')
		fixed = fixed.replace(/ {2,}/g, ' ')
		lines[i] = indent + fixed
	}
	return lines.join('\n')
}

export function sanitizeLineSpaces(line: string): string {
	const m = /^([\t ]*)(.*)$/.exec(line)
	if (!m) return line
	const indent = m[1]
	const rest = m[2]
	if (rest.startsWith('\\')) return line
  let fixed = rest
  fixed = fixed.replace(/(?:<\s+=\s*>|<\s*=\s+>)/g, '<=>')
  fixed = fixed.replace(/<\s+=/g, '<=')
  fixed = fixed.replace(/=\s+>/g, '=>')
	fixed = fixed.replace(/ {2,}/g, ' ')
	return indent + fixed
}

export function spacingDiagnostics(text: string): Array<{ line: number; start: number; end: number; message: string }> {
  const issues: Array<{ line: number; start: number; end: number; message: string }> = []
	const lines = text.replace(/\r\n?/g, '\n').split('\n')
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i]
		const m = /^([\t ]*)(.*)$/.exec(raw)
		if (!m) continue
		const indent = m[1]
		const rest = m[2]
		// Indentation must be tabs only
		if (indent.includes(' ')) {
			const first = indent.indexOf(' ')
			const last = indent.lastIndexOf(' ')
			const start = first
			const end = last + 1
			issues.push({ line: i, start, end, message: 'Indent must use tabs only' })
		}
		if (rest.startsWith('\\')) continue
		// Broken operator tokens
    const ops: Array<{ re: RegExp; msg: string }> = [
      { re: /(?:<\s+=\s*>|<\s*=\s+>)/g, msg: "Operator '<=>' must not contain spaces" },
      { re: /<\s+=/g, msg: "Operator '<=' must not contain spaces" },
      { re: /=\s+>/g, msg: "Operator '=>' must not contain spaces" },
    ]
		for (const { re, msg } of ops) {
			let m2: RegExpExecArray | null
			re.lastIndex = 0
			while ((m2 = re.exec(rest))) {
				const start = indent.length + m2.index
				const end = start + m2[0].length
				issues.push({ line: i, start, end, message: msg })
			}
		}
		// Raw string after operator usage (invalid)
		const rawAfterOp = /((?:<=>|<=|=>)\s+\S+)\s+\\.*$/
		const bad = rawAfterOp.exec(rest)
		if (bad) {
			const start = indent.length + bad.index + bad[1].length
			const end = indent.length + rest.length
			issues.push({
				line: i,
				start,
				end,
				message: 'Raw string not allowed after operator; remove trailing raw data',
			})
		}
		const ms = /( {2,})/g
		let m3: RegExpExecArray | null
		while ((m3 = ms.exec(rest))) {
			const start = indent.length + m3.index
			const end = start + m3[0].length
			issues.push({ line: i, start, end, message: 'Multiple spaces — use single space' })
		}
	}
	return issues
}
