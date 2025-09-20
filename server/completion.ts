import { CompletionItem, CompletionItemKind, Position } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { findNodeAtOffset } from './ast/findNode'
import { getAllClasses, getAllProps } from './indexer'

export function getCompletions(doc: TextDocument, position: Position, root: any): CompletionItem[] {
  const text = doc.getText()
  const offset = doc.offsetAt(position)

  const baseProps: CompletionItem[] = [
    { label: 'sub', kind: CompletionItemKind.Property },
    { label: 'attr', kind: CompletionItemKind.Property },
    { label: 'dom_name', kind: CompletionItemKind.Property },
  ]

  const operators: CompletionItem[] = [
    { label: '/', kind: CompletionItemKind.Operator },
    { label: '*', kind: CompletionItemKind.Operator },
    { label: '^', kind: CompletionItemKind.Operator },
    { label: '=', kind: CompletionItemKind.Operator },
    { label: '<=', kind: CompletionItemKind.Operator },
    { label: '<=>', kind: CompletionItemKind.Operator },
  ]

  // Project entities
  const classes = getAllClasses().map(label => ({ label, kind: CompletionItemKind.Class }))
  const props = getAllProps().map(label => ({ label, kind: CompletionItemKind.Property }))

  // If current token looks like a class (starts with $ or uppercase letter), prefer classes
  const slice = text.slice(Math.max(0, offset - 64), offset)
  const tokenMatch = /([A-Za-z$][\w]*)$/.exec(slice)
  if (tokenMatch && (/^\$/.test(tokenMatch[1]) || /^[A-Z]/.test(tokenMatch[1]))) {
    return [...classes, ...operators]
  }

  // Otherwise, inspect AST node under cursor to bias suggestions
  const node = root ? findNodeAtOffset(root, doc, offset) : null
  if (node && node.type) {
    // Inside a typed node (struct) – likely a key or component
    return [...props, ...baseProps, ...operators, ...classes]
  }
  if (node && node.type === '' && (!node.value || String(node.value) === '')) {
    // Likely at component name position
    return classes
  }

  // Default suggestions: a small, helpful mix
  return [
    ...classes,
    ...props,
    ...baseProps,
    ...operators,
  ]
}

