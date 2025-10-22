"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompletions = getCompletions;
const node_1 = require("vscode-languageserver/node");
const indexer_1 = require("./indexer");
function getCompletions(doc, position, _root) {
    const text = doc.getText();
    const offset = doc.offsetAt(position);
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    const lineIndex = Math.min(Math.max(0, position.line), Math.max(0, lines.length - 1));
    const lineText = lines[lineIndex] ?? '';
    const trimmedLine = lineText.trim();
    const operators = [
        { label: '/', kind: node_1.CompletionItemKind.Operator },
        { label: '*', kind: node_1.CompletionItemKind.Operator },
        { label: '^', kind: node_1.CompletionItemKind.Operator },
        { label: '=', kind: node_1.CompletionItemKind.Operator },
        { label: '<=', kind: node_1.CompletionItemKind.Operator },
        { label: '<=>', kind: node_1.CompletionItemKind.Operator },
        { label: '@', kind: node_1.CompletionItemKind.Operator },
        { label: '\\', kind: node_1.CompletionItemKind.Operator },
    ];
    const classes = (0, indexer_1.getAllClasses)().map(label => ({ label, kind: node_1.CompletionItemKind.Class }));
    // Determine current component context
    const binding = findBinding(lineText);
    let currentComponent = null;
    if (binding) {
        if (position.character > binding.end) {
            currentComponent = getRootComponent(lines);
        }
        else {
            currentComponent = getNearestComponentAbove(lines, lineIndex - 1);
        }
    }
    else {
        currentComponent = getNearestComponentAbove(lines, lineIndex);
    }
    // If current token starts with '$' and we are NOT in property context => suggest classes
    const slice = text.slice(Math.max(0, offset - 128), offset);
    const tokenMatch = /([A-Za-z0-9_$]+)$/.exec(slice);
    if (!currentComponent && tokenMatch && tokenMatch[1].startsWith('$')) {
        return [...classes, ...operators];
    }
    const baseProps = [
        { label: 'sub', kind: node_1.CompletionItemKind.Property },
        { label: 'content', kind: node_1.CompletionItemKind.Property },
        { label: 'attr', kind: node_1.CompletionItemKind.Property },
        { label: 'dom_name', kind: node_1.CompletionItemKind.Property },
    ];
    if (currentComponent) {
        const compProps = (0, indexer_1.getComponentProps)(currentComponent);
        const propItems = (compProps.length ? compProps : (0, indexer_1.getAllProps)()).map(label => ({
            label,
            kind: node_1.CompletionItemKind.Property,
        }));
        return [...propItems, ...baseProps, ...operators];
    }
    // Default suggestions
    const props = (0, indexer_1.getAllProps)().map(label => ({ label, kind: node_1.CompletionItemKind.Property }));
    return [...classes, ...props, ...baseProps, ...operators];
}
// Helpers (pure text-based; no VSCode API on server)
function findBinding(text) {
    const re = /<=>|<=|=>/g;
    const m = re.exec(text);
    return m ? { op: m[0], start: m.index, end: m.index + m[0].length } : null;
}
function getRootComponent(lines) {
    const first = (lines[0] || '').replace(/^\uFEFF/, '');
    const token = first.trim().split(/\s+/)[0] || '';
    return token || null;
}
function getNearestComponentAbove(lines, startLine) {
    for (let i = Math.min(startLine, lines.length - 1); i >= 0; i--) {
        const text = lines[i] || '';
        const t = text.trim();
        if (!t)
            continue;
        if (t.startsWith('-'))
            continue;
        if (/(<=|=>|<=>)/.test(text) && !/\$[A-Za-z0-9_]+/.test(text))
            continue;
        const m = text.match(/\$[A-Za-z0-9_]+/);
        if (m)
            return m[0];
    }
    return null;
}
