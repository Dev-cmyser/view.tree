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
exports.uriToFsPath = uriToFsPath;
exports.fsPathToUri = fsPathToUri;
exports.classNameToRelPath = classNameToRelPath;
exports.classLike = classLike;
const nodePath = __importStar(require("path"));
const url_1 = require("url");
function uriToFsPath(uri) {
    if (!uri.startsWith('file://'))
        return uri;
    const withoutScheme = uri.replace(/^file:\/\//, '');
    // On Unix, leading slash is preserved; decode percent-encoding
    return decodeURIComponent(withoutScheme);
}
function fsPathToUri(fsPath) {
    return (0, url_1.pathToFileURL)(nodePath.resolve(fsPath)).toString();
}
function classNameToRelPath(name) {
    // Example: $mol_image -> mol/image/image.view.tree ; bog_horrorgamelanding_card -> bog/horrorgamelanding/card/card.view.tree
    const plain = name.replace(/^\$/, '');
    const parts = plain.split('_');
    const last = parts[parts.length - 1];
    const dir = parts.join('/');
    return `${dir}/${last}.view.tree`;
}
function classLike(name) {
    // Consider names with underscore (after trimming optional $) as class-like
    const plain = name.replace(/^\$/, '');
    return /.+_.+/.test(plain);
}
