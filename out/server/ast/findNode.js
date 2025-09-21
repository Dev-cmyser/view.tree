"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findNodeAtOffset = findNodeAtOffset;
const loc_1 = require("../loc");
function findNodeAtOffset(root, doc, offset) {
    if (!root || !root.span)
        return null;
    if (!(0, loc_1.spanContainsOffset)(doc, root.span, offset))
        return null;
    let found = root;
    for (const kid of root.kids || []) {
        const sub = findNodeAtOffset(kid, doc, offset);
        if (sub)
            found = sub;
    }
    return found;
}
