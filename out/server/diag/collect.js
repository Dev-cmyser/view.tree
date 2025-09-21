"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWithDiagnostics = parseWithDiagnostics;
const mol_tree2_1 = __importDefault(require("mol_tree2"));
const node_1 = require("vscode-languageserver/node");
function parseWithDiagnostics(text, uri) {
    try {
        const tree = mol_tree2_1.default.$mol_tree2.fromString(text, uri);
        return { tree, diagnostics: [] };
    }
    catch (err) {
        const span = err?.span;
        const message = (err?.reason ?? err?.message ?? 'Syntax error').toString();
        if (span && typeof span.row === 'number' && typeof span.col === 'number') {
            const line = Math.max(0, span.row - 1);
            const character = Math.max(0, span.col - 1);
            const length = Math.max(1, Number(span.length ?? 1));
            return {
                tree: null,
                diagnostics: [{
                        severity: node_1.DiagnosticSeverity.Error,
                        range: {
                            start: { line, character },
                            end: { line, character: character + length },
                        },
                        message,
                        source: 'mol_tree2',
                    }],
            };
        }
        return {
            tree: null,
            diagnostics: [{
                    severity: node_1.DiagnosticSeverity.Error,
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    message,
                    source: 'mol_tree2',
                }],
        };
    }
}
