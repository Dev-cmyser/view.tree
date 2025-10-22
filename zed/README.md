# View.Tree Language Support for Zed Editor

A comprehensive language extension for [Zed](https://zed.dev) editor that provides syntax highlighting and intelligent autocompletion for `.view.tree` files used in the [$mol web framework](https://mol.hyoo.ru).

## Features

### 🎨 Syntax Highlighting
- **Component declarations**: `$my_component $mol_view`
- **Property definitions**: `sub`, `title`, `value?`
- **Binding operators**: `<=`, `<=>`, `^`
- **String literals**: `\Text`, `@\Localized`
- **Special markers**: `/`, `*`, primitives

### 🧠 Intelligent Autocompletion (LSP)
- **Smart component completion**: Suggests `$mol_*` framework components and project-specific components
- **Contextual property completion**: Shows only relevant properties for the current component context
- **Dynamic project scanning**: Automatically discovers components and properties from your codebase
- **Real-time updates**: Monitors file changes and updates completions accordingly

### 🔍 Code Navigation
- **Outline view**: Navigate between component definitions
- **Text objects**: Select components and properties as logical units
- **Auto-indentation**: Proper indentation for view.tree syntax

## Installation

### Prerequisites
- [Zed Editor](https://zed.dev) (latest version recommended)
- [Node.js](https://nodejs.org) 16.0.0 or higher (for LSP features)

### Option 1: Extension Manager (Recommended)
1. Open Zed
2. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Linux/Windows)
3. Type "zed: extensions" and select it
4. Search for "view.tree" or "mol"
5. Install "View Tree Syntax Highlighting for $mol"

### Option 2: Manual Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/dev-cmyser/zed-view.tree-mol-support.git
   cd zed-view.tree-mol-support
   ```

2. Install and build the LSP server:
   ```bash
   ./install.sh
   ```

3. Copy the extension to Zed's extensions directory:
   ```bash
   cp -r . ~/.config/zed/extensions/viewtree/
   ```

4. Restart Zed

## Usage

### Basic Syntax
Create a `.view.tree` file and start typing:

```tree
$my_app $mol_view
    title \My Application
    sub /
        <= Header $mol_page
            title \Welcome
            body \
                \Hello, world!
        <= Content $mol_list
            rows <= items*
```

### Autocompletion

#### Component Completion
Type `$` to see available components:
- Framework components: `$mol_view`, `$mol_button`, `$mol_page`
- Project components: Components found in your workspace

#### Property Completion
Inside a component definition, type any letter to see contextual properties:
```tree
$my_component $mol_view
    s|  # ← Type 's' here, get 'sub', 'style', etc.
```

#### Binding Operators
Type `<=` to see binding options:
- `<=` (one-way binding)
- `<=>` (two-way binding)
- `^` (override)

## Project Structure

```
zed-view.tree-mol-support/
├── extension.toml          # Extension manifest
├── languages/viewtree/     # Language configuration
│   ├── config.toml         # Language settings
│   ├── highlights.scm      # Syntax highlighting rules
│   ├── indents.scm        # Auto-indentation rules
│   ├── outline.scm        # Code outline configuration
│   └── textobjects.scm    # Text object definitions
├── lsp/                   # Language Server Protocol implementation
│   ├── src/               # TypeScript source code
│   ├── package.json       # LSP dependencies
│   └── bin/view-tree-lsp  # LSP executable
└── install.sh            # Installation script
```

## Development

### Building the LSP Server

1. Navigate to the LSP directory:
   ```bash
   cd lsp/
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build:
   ```bash
   npm run build
   ```

4. Test:
   ```bash
   npm start
   ```

### Grammar Development

The syntax highlighting is powered by [tree-sitter-mol-view-tree](https://github.com/Dev-cmyser/tree-sitter-mol-view-tree). Grammar changes should be made in that repository.

### Contributing

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test with a local Zed installation
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## Troubleshooting

### LSP Not Working

1. **Check Node.js**: Ensure Node.js 16+ is installed: `node --version`
2. **Rebuild LSP**: Run `./install.sh` again
3. **Check logs**: View LSP logs in Zed's debug console
4. **Restart Zed**: Sometimes a restart is needed after installation

### No Syntax Highlighting

1. **File extension**: Ensure your file ends with `.tree`
2. **Language mode**: Check that Zed recognizes the file as "View Tree ($mol)"
3. **Extension enabled**: Verify the extension is installed and enabled

### Performance Issues

1. **Large projects**: The LSP scans up to 100 TypeScript files for performance
2. **Initial scan**: First-time scanning may take a few seconds
3. **File watching**: Subsequent updates should be fast

## Related Projects

- [$mol Framework](https://github.com/hyoo-ru/mol) - The web framework this extension supports
- [tree-sitter-mol-view-tree](https://github.com/Dev-cmyser/tree-sitter-mol-view-tree) - Tree-sitter grammar for view.tree
- [VSCode view.tree extension](https://github.com/stan-donarise/view.tree-language) - Similar extension for Visual Studio Code

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE-APACHE](LICENSE-APACHE) file for details.

## Acknowledgments

- [$mol team](https://github.com/hyoo-ru) for creating the amazing framework
- [Tree-sitter](https://tree-sitter.github.io/) for the parsing technology
- [Zed team](https://zed.dev) for the excellent editor and extension API