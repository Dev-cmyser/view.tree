"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateIndexForDoc = updateIndexForDoc;
exports.removeFromIndex = removeFromIndex;
exports.getAllClasses = getAllClasses;
exports.getAllProps = getAllProps;
exports.findClassDefs = findClassDefs;
exports.findPropDefs = findPropDefs;
exports.findRefs = findRefs;
exports.getIndexStats = getIndexStats;
const resolver_1 = require("./resolver");
const classDefsByUri = new Map();
const propDefsByUri = new Map();
const occByUri = new Map();
const textByUri = new Map();
function updateIndexForDoc(uri, root, text) {
    if (typeof text === 'string')
        textByUri.set(uri, text);
    const classDefs = new Map();
    const propDefs = new Map();
    const occs = new Map();
    function addOcc(name, spot) {
        const arr = occs.get(name) ?? [];
        arr.push(spot);
        occs.set(name, arr);
    }
    function walk(node) {
        if (!node || !node.span)
            return;
        const span = node.span;
        const row = Math.max(0, Number(span.row || 1) - 1);
        const col = Math.max(0, Number(span.col || 1) - 1);
        if (node.type) {
            const name = String(node.type);
            const spot = { line: row, col, length: name.length };
            addOcc(name, spot);
            if ((0, resolver_1.classLike)(name) && col === 0) {
                classDefs.set(name, spot);
            }
            else if (/^[a-z][\w]*$/.test(name)) {
                const arr = propDefs.get(name) ?? [];
                arr.push(spot);
                propDefs.set(name, arr);
            }
        }
        else if (node.value) {
            const val = String(node.value);
            if (/^[A-Za-z$][\w$]*$/.test(val)) {
                const spot = { line: row, col, length: val.length };
                addOcc(val, spot);
            }
        }
        const kids = (node.kids || []);
        for (const k of kids)
            walk(k);
    }
    if (root)
        walk(root);
    classDefsByUri.set(uri, classDefs);
    propDefsByUri.set(uri, propDefs);
    occByUri.set(uri, occs);
}
function removeFromIndex(uri) {
    classDefsByUri.delete(uri);
    propDefsByUri.delete(uri);
    occByUri.delete(uri);
    textByUri.delete(uri);
}
function getAllClasses() {
    const out = new Set();
    for (const m of classDefsByUri.values())
        for (const v of m.keys())
            out.add(v);
    return [...out].sort();
}
function getAllProps() {
    const out = new Set();
    for (const m of propDefsByUri.values())
        for (const v of m.keys())
            out.add(v);
    return [...out].sort();
}
function findClassDefs(name) {
    const out = [];
    for (const [uri, map] of classDefsByUri.entries()) {
        const spot = map.get(name);
        if (spot)
            out.push({ uri, spot });
    }
    return out;
}
function findPropDefs(name) {
    const out = [];
    for (const [uri, map] of propDefsByUri.entries()) {
        const spots = map.get(name);
        if (spots)
            for (const spot of spots)
                out.push({ uri, spot });
    }
    return out;
}
function findRefs(name) {
    const out = [];
    for (const [uri, occs] of occByUri.entries()) {
        const arr = occs.get(name);
        if (!arr)
            continue;
        for (const spot of arr)
            out.push({ uri, spot });
    }
    return out;
}
function getIndexStats(uri) {
    const classes = classDefsByUri.get(uri)?.size ?? 0;
    const props = propDefsByUri.get(uri)?.size ?? 0;
    const occs = occByUri.get(uri)?.size ?? 0;
    return { classes, props, occs };
}
