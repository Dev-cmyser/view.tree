"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.offsetOfPosition = offsetOfPosition;
exports.spanStartPosition = spanStartPosition;
exports.spanEndPosition = spanEndPosition;
exports.spanToRange = spanToRange;
exports.spanContainsOffset = spanContainsOffset;
function offsetOfPosition(doc, pos) {
    return doc.offsetAt(pos);
}
function spanStartPosition(span) {
    return { line: Math.max(0, span.row - 1), character: Math.max(0, span.col - 1) };
}
function spanEndPosition(span) {
    return { line: Math.max(0, span.row - 1), character: Math.max(0, span.col - 1 + (span.length ?? 1)) };
}
function spanToRange(span) {
    return { start: spanStartPosition(span), end: spanEndPosition(span) };
}
function spanContainsOffset(doc, span, offset) {
    const start = doc.offsetAt(spanStartPosition(span));
    const end = doc.offsetAt(spanEndPosition(span));
    return offset >= start && offset <= end;
}
