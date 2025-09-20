import $ from 'mol_tree2'

export type Ast = any // $.$mol_tree2

export function buildAst(text: string, uri: string): Ast {
  return $.$mol_tree2.fromString(text, uri)
}

