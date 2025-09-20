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
  // Example: bog_horrorgamelanding_card -> bog/horrorgamelanding/card/card.view.tree
  const parts = name.split('_')
  const last = parts[parts.length - 1]
  const dir = parts.join('/')
  return `${dir}/${last}.view.tree`
}

export function classLike(name: string): boolean {
  // Consider names containing underscore or starting with $ as class-like
  return /_/ .test(name) || /^\$/.test(name)
}

