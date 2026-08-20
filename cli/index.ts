import { create } from './create'
import { locale } from './locale'

const args = process.argv.slice(2)
const command = args[0]

switch (command) {
	case 'create':
		create(args.slice(1))
		break
	case 'locale':
		locale(args.slice(1))
		break
	default:
		console.log(`view-tree-lsp CLI\n`)
		console.log(`Commands:`)
		console.log(`  create <namespace/name> [flags]   Create new $mol project`)
		console.log(`  locale <path> [flags]             Split combined locale files into modules\n`)
		console.log(`Flags:`)
		console.log(`  --no-docker   Skip Docker files`)
		console.log(`  --no-baza     Skip Giper Baza store`)
		console.log(`  --no-tauri    Skip Tauri desktop files\n`)
		console.log(`Flags (locale):`)
		console.log(`  --include=<fragment>   Only modules whose path contains the fragment`)
		console.log(`  --exclude=<fragment>   Skip modules whose path contains the fragment`)
		console.log(`  --update               Merge into existing files instead of overwriting`)
		console.log(`  --dry                  Print the plan without writing\n`)
		console.log(`Examples:`)
		console.log(`  view-tree-lsp create bog/myapp`)
		console.log(`  view-tree-lsp create bog/myapp --no-tauri --no-docker`)
		console.log(`  view-tree-lsp create bog_myapp --no-baza`)
		console.log(`  view-tree-lsp locale bog/apps/app/- --exclude=mol --update`)
		process.exit(1)
}
