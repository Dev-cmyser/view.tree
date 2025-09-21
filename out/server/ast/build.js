"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAst = buildAst;
const mol_tree2_1 = __importDefault(require("mol_tree2"));
function buildAst(text, uri) {
    return mol_tree2_1.default.$mol_tree2.fromString(text, uri);
}
