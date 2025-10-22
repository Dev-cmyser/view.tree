# Tree-sitter Queries for view.tree

This directory contains various query files that enable advanced editor features.

## Query Files

### 1. `highlights.scm` - Syntax Highlighting
Defines how tokens are highlighted in the editor.

**Mappings:**
- `component_name` → `@type` (blue)
- `binding_operator` → `@operator` (purple)
- `string_literal` → `@string` (green)
- `number` → `@number` (orange)
- `identifier` → `@variable` (white)
- etc.

**Usage:** Automatic in tree-sitter enabled editors

### 2. `folds.scm` - Code Folding
Defines which blocks can be folded/collapsed.

**Foldable:**
- `children` blocks (indented sections)

**Usage:** 
- Neovim: `zc` to fold, `zo` to open
- VSCode: Click fold icons in gutter

### 3. `indents.scm` - Smart Indentation
Defines automatic indentation rules.

**Rules:**
- Indent after `children` block starts
- Outdent at `_dedent` token

**Usage:** Automatic when typing

### 4. `textobjects.scm` - Text Objects
Enables vim-style text object selection.

**Objects:**
- `@class.outer` - Component definition
- `@parameter.inner` - Token chain
- `@block.outer` - Children block

**Usage (Neovim):**
- `vac` - Select component (class)
- `vip` - Select parameter (token chain)
- `vab` - Select block

### 5. `locals.scm` - Scope Analysis
Defines variable scopes and references.

**Scopes:**
- Component definitions
- Property references

**Usage:** 
- Go to definition
- Find references
- Rename refactoring

### 6. `tags.scm` - Symbol Navigation
Defines symbols for outline/navigation.

**Symbols:**
- Components (class)
- Properties
- Instances (with `<=`)

**Usage:**
- Outline view
- Symbol search
- Breadcrumbs

### 7. `references.scm` - Find References
Enables "find all references" functionality.

**Tracked:**
- Component references
- Property references
- Operator references

**Usage:**
- LSP "Find References"
- Search across project

### 8. `injections.scm` - Language Injections
Enables syntax highlighting for embedded languages.

**Current:** Empty (for future use with template strings)

## Editor Support

### Neovim (nvim-treesitter)

```lua
require'nvim-treesitter.configs'.setup {
  highlight = { enable = true },
  fold = { enable = true },
  indent = { enable = true },
  textobjects = {
    select = {
      enable = true,
      keymaps = {
        ["ac"] = "@class.outer",
        ["ic"] = "@class.inner",
        ["ab"] = "@block.outer",
      },
    },
  },
}
```

### Helix

Queries are automatically loaded from `queries/` directory.

### Zed

Tree-sitter queries work out of the box.

### VSCode

Requires tree-sitter extension. Queries are used for:
- Syntax highlighting
- Code folding
- Outline view

## Testing Queries

```bash
# Test highlights
tree-sitter highlight test_complex.view.tree

# Test query
tree-sitter query queries/highlights.scm test_complex.view.tree

# Test tags
tree-sitter tags test_complex.view.tree
```

## Query Syntax

Queries use S-expression syntax:

```scheme
; Match a node
(node_name) @capture

; Match with field
(node_name
  field: (child_node) @capture)

; Match with predicate
(identifier) @variable
  (#match? @variable ".*\\?$")

; Set properties
(component_name) @type
  (#set! "fontStyle" "bold")
```

## Common Captures

Standard capture names across editors:

- `@type` - Types, classes
- `@variable` - Variables, identifiers
- `@function` - Functions
- `@keyword` - Keywords
- `@operator` - Operators
- `@string` - Strings
- `@number` - Numbers
- `@comment` - Comments
- `@punctuation` - Punctuation
- `@constant` - Constants

## Adding Custom Queries

To add custom behavior:

1. Create/edit query file in `queries/`
2. Use standard capture names
3. Test with `tree-sitter query`
4. Commit to your tree-sitter grammar repo

## Resources

- [Tree-sitter Query Documentation](https://tree-sitter.github.io/tree-sitter/using-parsers#pattern-matching-with-queries)
- [nvim-treesitter Queries](https://github.com/nvim-treesitter/nvim-treesitter#adding-queries)
- [Helix Queries](https://docs.helix-editor.com/guides/adding_languages.html#queries)
