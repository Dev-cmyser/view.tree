import { CompletionItem, CompletionItemKind, Position } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { findNodeAtOffset } from '../ast/findNode'

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

  // Otherwise, inspect AST node under cursor to bias suggestions
  const node = root ? findNodeAtOffset(root, doc, offset) : null
  if (node && node.type) {
    // Inside a typed node (struct) – likely a key or component, show operators and props
    return [...operators, ...baseProps]
  }

  // Default suggestions: a small, helpful mix
  return [
    { label: 'view', kind: CompletionItemKind.Class },
    ...baseProps,
    ...operators,
  ]
}
