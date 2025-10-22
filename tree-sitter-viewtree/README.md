# Tree-sitter Grammar for view.tree

A complete Tree-sitter grammar for the view.tree format used in the [$mol framework](https://github.com/hyoo-ru/mam.hyoo.ru).

## Features

✅ **Perfect Structure Match** with mol_tree2  
✅ **11 Token Types** for precise syntax highlighting  
✅ **Nested Token Chains** matching mol_tree2 hierarchy  
✅ **TAB-based Indentation** with INDENT/DEDENT tracking  
✅ **Complete Query Support** (highlights, folds, textobjects, etc.)  

## Installation

### As npm package

```bash
npm install tree-sitter-viewtree
```

### Manual

```bash
git clone <repo>
cd tree-sitter-viewtree
npm install
npm run gen
```

## Quick Start

```bash
# Generate parser
npm run gen

# Parse a file
tree-sitter parse example.view.tree

# Test with mol_tree2
npm run js
```

## Token Types

The grammar recognizes 11 distinct token types:

| Token | Example | Highlight |
|-------|---------|-----------|
| `component_name` | `$mol_view` | `@type` |
| `binding_operator` | `<=`, `<=>`, `=>` | `@operator` |
| `comment_marker` | `-` | `@comment` |
| `list_marker` | `/` | `@punctuation.bracket` |
| `dict_marker` | `*`, `^` | `@punctuation.bracket` |
| `localization_marker` | `@` | `@keyword` |
| `string_literal` | `\text` | `@string` |
| `number` | `42`, `3.14` | `@number` |
| `boolean` | `true`, `false` | `@boolean` |
| `null` | `null` | `@constant.builtin` |
| `identifier` | `name`, `prop?` | `@variable` |

## Structure

The grammar uses nested `token_chain` to match mol_tree2's structure:

```
Input:  $app $base
        	prop value

mol_tree2:
  "$app" → kids: ["$base" → kids: ["prop" → kids: ["value"]]]

tree-sitter:
  token_chain("$app", token_chain("$base"))
  children(token_chain("prop", token_chain("value")))
```

Both represent the same tree structure!

## Query Files

Located in `queries/`:

- **highlights.scm** - Syntax highlighting
- **folds.scm** - Code folding
- **indents.scm** - Smart indentation
- **textobjects.scm** - Vim text objects
- **locals.scm** - Scope analysis
- **tags.scm** - Symbol navigation
- **references.scm** - Find references
- **injections.scm** - Language injections

## Editor Integration

### Neovim

```lua
require'nvim-treesitter.configs'.setup {
  ensure_installed = { "viewtree" },
  highlight = { enable = true },
}
```

### Helix

Add to `languages.toml`:

```toml
[[language]]
name = "viewtree"
scope = "source.viewtree"
file-types = ["view.tree"]
grammar = "viewtree"
```

### Zed

Works automatically with built-in tree-sitter support.

### VSCode

Use tree-sitter extension or create language extension.

## Examples

See test files:
- `test_simple.view.tree` - Basic example
- `test_complex.view.tree` - Complex nesting
- `test_all_tokens.view.tree` - All token types
- `example.view.tree` - Real-world example

## Documentation

- [GRAMMAR.md](GRAMMAR.md) - Grammar details
- [STRUCTURE.md](STRUCTURE.md) - Structure comparison with mol_tree2
- [HIGHLIGHTS.md](HIGHLIGHTS.md) - Syntax highlighting guide
- [QUERIES.md](QUERIES.md) - Query files documentation
- [FINAL_SUMMARY.md](FINAL_SUMMARY.md) - Implementation summary

## Development

```bash
# Regenerate parser
npm run gen

# Run tests
tree-sitter test

# Test parsing
tree-sitter parse <file>

# Test queries
tree-sitter query queries/highlights.scm <file>

# Compare with mol_tree2
npm run js
```

## License

MIT

## Links

- [Tree-sitter](https://tree-sitter.github.io/)
- [$mol Framework](https://github.com/hyoo-ru/mam.hyoo.ru)
- [view.tree Specification](../Tree%20Language%20Grammar%20Notation.md)
