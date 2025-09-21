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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractClassRefs = extractClassRefs;
exports.loadDependencies = loadDependencies;
const fs = __importStar(require("fs/promises"));
const nodePath = __importStar(require("path"));
const resolver_1 = require("./resolver");
const mol_tree2_1 = __importDefault(require("mol_tree2"));
const format_1 = require("./format");
function extractClassRefs(root) {
    const out = new Set();
    const walk = (n) => {
        if (!n)
            return;
        const t = String(n.type ?? '');
        // Only $-prefixed word-like tokens to avoid props like dom_name, natural_height, etc.
        if (/^\$[A-Za-z][\w]*$/.test(t))
            out.add(t);
        const kids = (n.kids || []);
        for (const k of kids)
            walk(k);
    };
    walk(root);
    return out;
}
async function loadDependencies(workspaceRootFs, entryRefs, trees, updateIndexForDoc, maxDepth = 50, log) {
    const visited = new Set();
    const queue = [];
    for (const name of entryRefs)
        queue.push({ name, depth: 0 });
    log?.(`[deps] start queue size=${queue.length}`);
    while (queue.length) {
        const { name, depth } = queue.shift();
        if (visited.has(name))
            continue;
        visited.add(name);
        if (depth > maxDepth) {
            log?.(`[deps] maxDepth reached for ${name}`);
            continue;
        }
        const rel = (0, resolver_1.classNameToRelPath)(name);
        const abs = nodePath.join(workspaceRootFs, rel);
        try {
            log?.(`[deps] try ${rel}`);
            const buf = await fs.readFile(abs);
            let text = buf.toString('utf8');
            const uri = (0, resolver_1.fsPathToUri)(abs);
            let tree;
            try {
                tree = mol_tree2_1.default.$mol_tree2.fromString(text, uri);
            }
            catch (e) {
                const msg = String(e?.reason || e?.message || '');
                if (/Wrong nodes separator/.test(msg)) {
                    text = (0, format_1.sanitizeSeparators)(text);
                    tree = mol_tree2_1.default.$mol_tree2.fromString(text, uri);
                }
                else if (/Unexpected EOF, LF required/.test(msg)) {
                    text = text.endsWith('\n') ? text : text + '\n';
                    tree = mol_tree2_1.default.$mol_tree2.fromString(text, uri);
                }
                else
                    throw e;
            }
            trees.set(uri, tree);
            updateIndexForDoc(uri, tree, text);
            const refs = extractClassRefs(tree);
            log?.(`[deps] parsed ${rel} refs=${refs.size} depth=${depth}`);
            for (const ref of refs)
                if (!visited.has(ref))
                    queue.push({ name: ref, depth: depth + 1 });
        }
        catch {
            // Ignore missing files or parse errors quietly
            continue;
        }
    }
    log?.(`[deps] done visited=${visited.size}`);
}
