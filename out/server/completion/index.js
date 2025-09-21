"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompletions = getCompletions;
const node_1 = require("vscode-languageserver/node");
const findNode_1 = require("../ast/findNode");
const indexer_1 = require("../indexer");
function getCompletions(doc, position, root) {
    const text = doc.getText();
    const offset = doc.offsetAt(position);
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
    // Project entities
    const classes = (0, indexer_1.getAllClasses)().map(label => ({ label, kind: node_1.CompletionItemKind.Class }));
    const props = (0, indexer_1.getAllProps)().map(label => ({ label, kind: node_1.CompletionItemKind.Property }));
    // If current token looks like a class (starts with $ or uppercase letter), prefer classes
    const slice = text.slice(Math.max(0, offset - 64), offset);
    const tokenMatch = /([A-Za-z$][\w]*)$/.exec(slice);
    if (tokenMatch && (/^\$/.test(tokenMatch[1]) || /^[A-Z]/.test(tokenMatch[1]))) {
        return [...classes, ...operators];
    }
    // Otherwise, inspect AST node under cursor to bias suggestions
    const node = root ? (0, findNode_1.findNodeAtOffset)(root, doc, offset) : null;
    if (node && node.type) {
        // Inside a typed node (struct) – likely a key or component
        return [...props, ...baseProps, ...operators, ...classes];
    }
    if (node && node.type === '' && (!node.value || String(node.value) === '')) {
        // Likely at component name position
        return classes;
    }
    // Default suggestions: a small, helpful mix
    return [
        ...classes,
        ...props,
        ...baseProps,
        ...operators,
    ];
}
