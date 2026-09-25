"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentSymbols = documentSymbols;
exports.bindingHints = bindingHints;
exports.flowMarkdown = flowMarkdown;
exports.findDepsDir = findDepsDir;
const nodePath = __importStar(require("path"));
const node_1 = require("vscode-languageserver/node");
const ops = new Set(['<=', '<=>', '=>']);
function readLines(text) {
    return text
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((raw, line) => {
        const depth = /^\t*/.exec(raw)[0].length;
        return { line, depth, col: depth, size: raw.length, tokens: raw.slice(depth).split(/\s+/).filter(Boolean) };
    });
}
function isName(token) {
    return /^[$A-Za-z][\w$]*[?*]?$/.test(token);
}
function describe(tokens) {
    if (ops.has(tokens[0])) {
        if (!tokens[1] || !isName(tokens[1]))
            return null;
        return { name: tokens[1], detail: [tokens[0], ...tokens.slice(1)].join(' ') };
    }
    if (!isName(tokens[0]))
        return null;
    const at = tokens.findIndex(t => ops.has(t));
    if (at > 0 && tokens[at + 1])
        return { name: tokens[0], detail: `${tokens[at]} ${tokens[at + 1]}` };
    if (tokens.includes('^'))
        return { name: tokens[0], detail: '^' };
    return { name: tokens[0], detail: tokens.slice(1).join(' ') };
}
function documentSymbols(text) {
    const lines = readLines(text);
    const top = [];
    const stack = [];
    for (let i = 0; i < lines.length; i++) {
        const { line, depth, col, tokens } = lines[i];
        if (!tokens.length)
            continue;
        while (stack.length && stack[stack.length - 1].depth >= depth)
            stack.pop();
        const parent = stack.length ? stack[stack.length - 1].sym : undefined;
        if (parent === null) {
            stack.push({ depth, sym: null });
            continue;
        }
        const info = tokens[0] === '-' ? null : describe(tokens);
        if (!info) {
            if (tokens[0] === '-')
                stack.push({ depth, sym: null });
            continue;
        }
        let end = i;
        for (let k = i + 1; k < lines.length; k++) {
            if (!lines[k].tokens.length)
                continue;
            if (lines[k].depth <= depth)
                break;
            end = k;
        }
        const nameCol = nameColumn(tokens, col, info.name);
        const sym = {
            name: info.name,
            detail: info.detail,
            kind: depth === 0 ? node_1.SymbolKind.Class : /^[A-Z]/.test(info.name) ? node_1.SymbolKind.Object : node_1.SymbolKind.Property,
            range: { start: { line, character: 0 }, end: { line: lines[end].line, character: lines[end].size } },
            selectionRange: { start: { line, character: nameCol }, end: { line, character: nameCol + info.name.length } },
            children: [],
        };
        (parent ? parent.children : top).push(sym);
        stack.push({ depth, sym });
    }
    return top;
}
function nameColumn(tokens, col, name) {
    let at = col;
    for (const t of tokens) {
        if (t === name)
            return at;
        at += t.length + 1;
    }
    return col;
}
function bindingHints(text, overridden, tsFile) {
    const lines = readLines(text);
    const cls = lines[0]?.tokens[0]?.replace(/^﻿/, '') ?? '';
    if (!cls)
        return [];
    const hints = [];
    for (const { line, depth, size, tokens } of lines) {
        if (depth === 0 || !tokens.length || tokens[0] === '-')
            continue;
        const at = tokens.findIndex(t => t === '<=' || t === '<=>');
        if (at < 0 || !tokens[at + 1])
            continue;
        if (at === 0 && tokens.length > 2)
            continue;
        const prop = tokens[at + 1].replace(/[?*]$/, '');
        const label = overridden.has(prop) ? `← перекрыто в ${tsFile}` : `← ${cls}.${prop}`;
        hints.push({ position: { line, character: size }, label, paddingLeft: true });
    }
    return hints;
}
function flowMarkdown(module, deps) {
    const files = [...(deps.files ?? [])].reverse();
    const code = (f) => /\.(view\.tree|ts)$/.test(f) && !/\.d\.ts$/.test(f);
    const order = [];
    const own = new Map();
    for (const file of files) {
        const dir = nodePath.posix.dirname(file);
        if (!own.has(dir))
            own.set(dir, []);
        own.get(dir).push(file);
    }
    for (const [dir, list] of own)
        if (list.some(code) && !/(^|\/)-/.test(dir))
            order.push(dir);
    const known = new Set(order);
    const base = nodePath.posix.join(module, '-');
    const out = [`# Поток ${module}`, '', 'От приложения к листьям, в порядке, обратном бандлу.', ''];
    for (const dir of order) {
        out.push(`## ${dir}`, '');
        for (const file of own.get(dir).filter(f => !/(^|\/)(LICENSE|README\.md|readme\.md)$/.test(f))) {
            out.push(`- [${nodePath.posix.basename(file)}](${nodePath.posix.relative(base, file)})`);
        }
        const uses = Object.keys(deps.deps_out?.[dir] ?? {}).filter(d => d !== dir && known.has(d));
        if (uses.length)
            out.push('', `Зависит от: ${uses.map(d => '`' + d + '`').join(', ')}`);
        out.push('');
    }
    return out.join('\n');
}
function findDepsDir(fsPath, root) {
    const fs = require('fs');
    let dir = nodePath.dirname(fsPath);
    while (dir.startsWith(root) && dir !== root) {
        if (fs.existsSync(nodePath.join(dir, '-', 'web.deps.json')))
            return dir;
        dir = nodePath.dirname(dir);
    }
    return null;
}
