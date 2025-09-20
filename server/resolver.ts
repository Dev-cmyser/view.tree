import * as nodePath from 'path'

export function uriToFsPath(uri: string): string {
  if (!uri.startsWith('file://')) return uri
  const withoutScheme = uri.replace(/^file:\/\//, '')
  // On Unix, leading slash is preserved; decode percent-encoding
  return decodeURIComponent(withoutScheme)
}

export function fsPathToUri(fsPath: string): string {
  const norm = nodePath.resolve(fsPath)
  return 'file://' + encodeURIComponent(norm)
}

export function classNameToRelPath(name: string): string {
  // Example: $mol_image -> mol/image/image.view.tree ; bog_horrorgamelanding_card -> bog/horrorgamelanding/card/card.view.tree
  const plain = name.replace(/^\$/,'')
  const parts = plain.split('_')
  const last = parts[parts.length - 1]
  const dir = parts.join('/')
  return `${dir}/${last}.view.tree`
}

export function classLike(name: string): boolean {
  // Consider names with underscore (after trimming optional $) as class-like
  const plain = name.replace(/^\$/,'')
  return /.+_.+/.test(plain)
}
