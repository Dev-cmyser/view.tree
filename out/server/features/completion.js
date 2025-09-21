"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompletions = getCompletions;
const node_1 = require("vscode-languageserver/node");
const findNode_1 = require("../ast/findNode");
function getCompletions(doc, position, root) {
    const text = doc.getText();
    const offset = doc.offsetAt(position);
    const prev = offset > 0 ? text.charAt(offset - 1) : '';
    const baseProps = [
        { label: 'sub', kind: node_1.CompletionItemKind.Property },
        { label: 'attr', kind: node_1.CompletionItemKind.Property },
        { label: 'dom_name', kind: node_1.CompletionItemKind.Property },
    ];
    const operators = [
        { label: '/', kind: node_1.CompletionItemKind.Operator },
        { label: '*', kind: node_1.CompletionItemKind.Operator },
        { label: '^', kind: node_1.CompletionItemKind.Operator },
        { label: '=', kind: node_1.CompletionItemKind.Operator },
        { label: '<=', kind: node_1.CompletionItemKind.Operator },
        { label: '<=>', kind: node_1.CompletionItemKind.Operator },
    ];
    // If triggered by '.' or ':', suggest properties first
    if (prev === '.' || prev === ':') {
        return baseProps;
    }
    // Otherwise, inspect AST node under cursor to bias suggestions
    const node = root ? (0, findNode_1.findNodeAtOffset)(root, doc, offset) : null;
    if (node && node.type) {
        // Inside a typed node (struct) – likely a key or component, show operators and props
        return [...operators, ...baseProps];
    }
    // Default suggestions: a small, helpful mix
    return [
        { label: 'view', kind: node_1.CompletionItemKind.Class },
        ...baseProps,
        ...operators,
    ];
}
