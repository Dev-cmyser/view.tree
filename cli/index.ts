import { create } from './create'

const args = process.argv.slice(2)
const command = args[0]

switch (command) {
	case 'create':
		create(args.slice(1))
		break
	default:
		console.log(`view-tree-lsp CLI\n`)
		console.log(`Commands:`)
		console.log(`  create <namespace/name> [flags]   Create new $mol project\n`)
		console.log(`Flags:`)
		console.log(`  --no-docker   Skip Docker files`)
		console.log(`  --no-baza     Skip Giper Baza store`)
		console.log(`  --no-tauri    Skip Tauri desktop files\n`)
		console.log(`Examples:`)
		console.log(`  view-tree-lsp create bog/myapp`)
		console.log(`  view-tree-lsp create bog/myapp --no-tauri --no-docker`)
		console.log(`  view-tree-lsp create bog_myapp --no-baza`)
		process.exit(1)
}
