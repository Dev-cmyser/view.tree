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
exports.scanProject = scanProject;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const mol_tree2_1 = __importDefault(require("mol_tree2"));
const format_1 = require("./format");
const resolver_1 = require("./resolver");
const tsProps_1 = require("./tsProps");
const indexer_1 = require("./indexer");
async function* walk(dir, ignore) {
    let entries = [];
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const e of entries) {
        if (ignore.has(e.name))
            continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            yield* walk(p, ignore);
        }
        else if (e.isFile()) {
            if (p.endsWith('.view.tree')) {
                yield p;
            }
            else if (p.endsWith('.ts') && !p.endsWith('.d.ts')) {
                yield p;
            }
        }
    }
}
async function scanProject(workspaceRootFs, trees, updateIndexForDoc, log) {
    const ignore = new Set(['node_modules', '.git', 'out', 'dist', 'build']);
    let count = 0;
    for await (const file of walk(workspaceRootFs, ignore)) {
        try {
            const text0 = await fs.readFile(file, 'utf8');
            const uri = (0, resolver_1.fsPathToUri)(file);
            if (file.endsWith('.view.tree')) {
                let tree;
                try {
                    tree = mol_tree2_1.default.$mol_tree2.fromString(text0, uri);
                }
                catch (e) {
                    const msg = String(e?.reason || e?.message || '');
                    let text = text0;
                    if (/Wrong nodes separator/.test(msg))
                        text = (0, format_1.sanitizeSeparators)(text);
                    if (!/\n$/.test(text))
                        text += '\n';
                    tree = mol_tree2_1.default.$mol_tree2.fromString(text, uri);
                }
                trees.set(uri, tree);
                updateIndexForDoc(uri, tree, undefined);
                count++;
                if (count % 50 === 0)
                    log?.(`[scan] indexed files=${count}`);
            }
            else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
                // Extract TS-based component properties and store to TS index
                const compMap = (0, tsProps_1.extractTsProps)(text0);
                if (compMap.size) {
                    (0, indexer_1.updateTsPropsForUri)(uri, compMap);
                }
            }
        }
        catch { }
    }
    log?.(`[scan] done. indexed files=${count}`);
}
