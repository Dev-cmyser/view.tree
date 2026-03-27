import * as fs from 'fs'
import * as path from 'path'

interface CreateOptions {
	docker: boolean
	baza: boolean
	tauri: boolean
}

function parse_flags(args: string[]): { raw: string; options: CreateOptions } {
	const options: CreateOptions = {
		docker: true,
		baza: true,
		tauri: true,
	}

	let raw = ''

	for (const arg of args) {
		if (arg === '--no-docker') options.docker = false
		else if (arg === '--no-baza') options.baza = false
		else if (arg === '--no-tauri') options.tauri = false
		else if (!arg.startsWith('--')) raw = raw || arg
	}

	return { raw, options }
}

function parse_input(raw: string): { segments: string[]; app_path: string; project_path: string } {
	let input = raw.replace(/^\$/, '')
	input = input.replace(/_/g, '/')

	const parts = input.split('/').filter(Boolean)
	const segments = parts.at(-1) === 'app' ? parts.slice(0, -1) : parts

	if (segments.length < 2) {
		console.error(`Error: need at least namespace/name, got: ${raw}`)
		console.error(`Example: view-tree-lsp create bog/myapp`)
		process.exit(1)
	}

	const project_path = segments.join('/')
	const app_path = project_path + '/app'

	return { segments, app_path, project_path }
}

function prefix(segments: string[]): string {
	return '$' + segments.join('_')
}

function write(filepath: string, content: string) {
	const dir = path.dirname(filepath)
	fs.mkdirSync(dir, { recursive: true })
	fs.writeFileSync(filepath, content)
	console.log(`  + ${filepath}`)
}

export function create(args: string[]) {
	const { raw, options } = parse_flags(args)

	if (!raw) {
		console.error(`Usage: view-tree-lsp create <namespace/name> [flags]`)
		console.error(``)
		console.error(`Flags:`)
		console.error(`  --no-docker   Skip Docker files`)
		console.error(`  --no-baza     Skip Giper Baza store`)
		console.error(`  --no-tauri    Skip Tauri desktop files`)
		process.exit(1)
	}

	const { segments, app_path, project_path } = parse_input(raw)
	const $ = prefix(segments)
	const $app = $ + '_app'
	const name = segments.at(-1)!
	const gh_org = segments[0]
	const gh_repo = segments.at(-1)!
	const gh_pages_url = `https://${gh_org}.github.io/${gh_repo}/`
	const asset_path = project_path

	const cwd = process.cwd()

	const skipped: string[] = []
	if (!options.docker) skipped.push('docker')
	if (!options.baza) skipped.push('baza')
	if (!options.tauri) skipped.push('tauri')

	console.log(`\nCreating $mol project: ${$app}`)
	console.log(`Path: ${project_path}/`)
	if (skipped.length) console.log(`Skipping: ${skipped.join(', ')}`)
	console.log(``)

	// ── index.html ──
	write(
		path.join(cwd, app_path, 'index.html'),
		`<!doctype html>
<html lang="ru" mol_view_root>
	<head>
		<meta charset="utf-8" />
		<meta lang="ru" />
		<meta name="viewport" content="width=device-width, height=device-height, initial-scale=1" />
		<meta name="mobile-web-app-capable" content="yes" />
		<meta name="apple-mobile-web-app-capable" content="yes" />
		<link href="${asset_path}/assets/logo.svg" rel="icon" />
		<meta name="description" content="${name}" />
		<meta property="og:title" content="${name}" />
		<meta property="og:type" content="website" />
		<meta property="og:description" content="${name}" />
		<meta property="og:site_name" content="${name}" />
		<meta property="og:url" content="${gh_pages_url}" />
		<link rel="manifest" href="manifest.json" />
	</head>
	<body mol_view_root>
		<div mol_view_root="${$app}"></div>
		<script src="web.js"></script>
	</body>
</html>
`,
	)

	// ── app.meta.tree ──
	write(
		path.join(cwd, app_path, 'app.meta.tree'),
		`include \\/mol/offline/install
deploy \\/${asset_path}/assets
`,
	)

	// ── app.view.tree ──
	const baza_tools = options.baza ? `\n\t\t<= Status $giper_baza_status` : ''

	write(
		path.join(cwd, app_path, 'app.view.tree'),
		`${$app} $mol_page
	title @ \\${name}
	pages *
		home <= Home $mol_page
			title \\Home
			body /
				<= Welcome $mol_text
					text \\
						\\# ${name}
						\\
						\\Welcome to your new $mol app.
	nav_options *
		home \\Home
	Navbar $mol_switch
		value? <=> screen? \\home
		options <= nav_options
	tools /
		<= Sources $mol_link_source
			uri \\https://github.com/${gh_org}/${gh_repo}${baza_tools}
		<= Theme_toggle $bog_theme_toggle
			theme_auto <= Theme
	head /
		<= Title
		<= Navbar
		<= Tools
	plugins /
		<= Theme $bog_theme_auto
			theme_light \\$mol_theme_calm_light
			theme_dark \\$mol_theme_calm_dark
			themes /
				\\$mol_theme_calm_light
				\\$mol_theme_calm_dark
	body <= screen_body /
`,
	)

	// ── app.view.ts ──
	write(
		path.join(cwd, app_path, 'app.view.ts'),
		`namespace $.$$ {

	export class ${$app} extends $.${$app} {

		@ $mol_mem
		screen( next?: string ) {
			return $mol_state_arg.value( 'screen', next ) ?? 'home'
		}

		@ $mol_mem
		screen_body() {
			const pages = this.pages()
			const screen = this.screen()
			const page = ( pages as any )[ screen ]
			return page ? [ page ] : []
		}

	}

}
`,
	)

	// ── app.view.css.ts ──
	write(
		path.join(cwd, app_path, 'app.view.css.ts'),
		`namespace $ {

	$mol_style_define( ${$app}, {
	})

}
`,
	)

	// ── app.test.ts ──
	write(
		path.join(cwd, app_path, 'app.test.ts'),
		`namespace $ {

	$mol_test({

		'app renders'() {
			const app = new ${$app}
			$mol_assert_ok( app )
		},

	})

}
`,
	)

	// ── app.locale=ru.json ──
	write(
		path.join(cwd, app_path, 'app.locale=ru.json'),
		`{
	"${$app}_title": "${name}"
}
`,
	)

	// ── store/store.ts (Giper Baza) ──
	if (options.baza) {
		write(
			path.join(cwd, project_path, 'store', 'store.ts'),
			`namespace $ {

	/** Data registry in home land */
	export class ${$}_registry extends $giper_baza_entity.with({
		Items: $giper_baza_list_link,
	}) {}

	/** Data store */
	export class ${$}_store extends $mol_object {

		glob() {
			return this.$.$giper_baza_glob
		}

		home_land() {
			return this.glob().home().land()
		}

		registry() {
			return this.home_land().Data( ${$}_registry ) as ${$}_registry
		}

	}

}
`,
		)
	}

	// ── assets/ ──
	write(
		path.join(cwd, project_path, 'assets', 'logo.svg'),
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
	<rect width="64" height="64" rx="12" fill="#7c3aed"/>
	<text x="32" y="44" font-size="32" font-family="system-ui" fill="white" text-anchor="middle">${name[0]?.toUpperCase() ?? 'A'}</text>
</svg>
`,
	)

	// ── .github/workflows/deploy.yml ──
	write(
		path.join(cwd, project_path, '.github', 'workflows', 'deploy.yml'),
		`name: ${$app}

permissions: write-all

on:
    workflow_dispatch:
    push:
    pull_request:
    delete:

concurrency:
    group: deploy-\${{ github.ref }}
    cancel-in-progress: true

jobs:
    build:
        runs-on: ubuntu-latest

        steps:
            - uses: hyoo-ru/mam_build@master2
              with:
                  package: "${project_path}"

            - uses: b-on-g/mol-prerender-action@main
              if: github.ref == 'refs/heads/main'
              with:
                  folder: "${project_path}/-"
                  base-url: "${gh_pages_url}"
                  screens: |
                      home

            - uses: hyoo-ru/gh-deploy@v4.4.1
              if: github.ref == 'refs/heads/main'
              with:
                  folder: "${project_path}/-"

            - name: Deploy feature branch
              if: startsWith(github.ref, 'refs/heads/feature/')
              uses: hyoo-ru/gh-deploy@v4.4.1
              with:
                  folder: "${project_path}/-"
                  target-folder: \${{ github.ref_name }}

    cleanup:
        if: github.event_name == 'delete' && startsWith(github.event.ref, 'feature/')
        runs-on: ubuntu-latest

        steps:
            - uses: actions/checkout@v4
              with:
                  ref: gh-pages

            - name: Remove feature folder
              run: |
                  BRANCH_NAME="\${{ github.event.ref }}"
                  FOLDER="feature/\${BRANCH_NAME#feature/}"
                  if [ -d "$FOLDER" ]; then
                    git config user.name "github-actions[bot]"
                    git config user.email "github-actions[bot]@users.noreply.github.com"
                    git rm -rf "$FOLDER"
                    git commit -m "Clean up preview for deleted branch: $BRANCH_NAME"
                    git push
                  fi
`,
	)

	// ── Tauri ──
	if (options.tauri) {
		write(
			path.join(cwd, project_path, '.github', 'workflows', 'tauri.yml'),
			`name: Tauri Desktop Build

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build-desktop:
    uses: b-on-g/tauri-mol-workflow-template/.github/workflows/tauri_reusable.yml@master
    with:
      mam_module_path: ${project_path}
      mam_dev_port: '9080'
      tauri_config: ${project_path}/src-tauri/tauri.conf.json
      checkout_path: ${project_path}
    secrets: inherit
`,
		)

		write(
			path.join(cwd, project_path, 'src-tauri', 'tauri.conf.json'),
			JSON.stringify(
				{
					$schema: 'https://raw.githubusercontent.com/nicegui/nicegui/main/nicegui/static/tauri.schema.json',
					build: {
						frontendDist: `../-`,
						devUrl: `http://localhost:9080/${app_path}/-/test.html`,
					},
					app: {
						title: name,
						windows: [{ title: name, width: 1200, height: 800 }],
					},
					identifier: `com.${gh_org}.${gh_repo}`,
				},
				null,
				'\t',
			) + '\n',
		)

		write(
			path.join(cwd, project_path, 'src-tauri', 'Cargo.toml'),
			`[package]
name = "${gh_repo}"
version = "0.1.0"
edition = "2024"

[lib]
name = "${gh_repo.replace(/-/g, '_')}_lib"
crate-type = ["lib", "cdylib", "staticlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
`,
		)

		write(
			path.join(cwd, project_path, 'src-tauri', 'src', 'lib.rs'),
			`#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
`,
		)

		write(
			path.join(cwd, project_path, 'src-tauri', 'src', 'main.rs'),
			`#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ${gh_repo.replace(/-/g, '_')}_lib::run()
}
`,
		)
	}

	// ── Docker ──
	if (options.docker) {
		write(
			path.join(cwd, project_path, 'Dockerfile'),
			`FROM node:20-alpine AS build
WORKDIR /app
RUN git clone --depth 1 https://github.com/hyoo-ru/mam.git . \\
    && npm install
COPY . ${project_path}/
RUN npx mam ${project_path}

FROM nginx:alpine
COPY --from=build /app/${project_path}/- /usr/share/nginx/html
EXPOSE 80
`,
		)

		write(
			path.join(cwd, project_path, 'docker-compose.yml'),
			`services:
  web:
    build: .
    ports:
      - "8080:80"
`,
		)
	}

	// ── README.md ──
	const docker_section = options.docker
		? `
## Docker

\`\`\`bash
docker compose up --build
# Open http://localhost:8080
\`\`\`
`
		: ''

	const tauri_section = options.tauri
		? `
## Desktop (Tauri)

Tag \`v*\` triggers Tauri build via GitHub Actions.
`
		: ''

	write(
		path.join(cwd, project_path, 'README.md'),
		`# ${name}

## Dev

\`\`\`bash
cd /path/to/mam && npm start
# Open http://localhost:9080/${app_path}/-/test.html
\`\`\`

## Build

\`\`\`bash
npx mam ${project_path}
\`\`\`
${docker_section}
## Deploy

Push to \`master\` → GitHub Actions → GitHub Pages: ${gh_pages_url}

Feature branches deploy to: ${gh_pages_url}{branch-name}/
${tauri_section}`,
	)

	// ── .gitignore ──
	write(
		path.join(cwd, project_path, '.gitignore'),
		`-*
.DS_Store
`,
	)

	// ── .gitattributes ──
	write(
		path.join(cwd, project_path, '.gitattributes'),
		`* -text
`,
	)

	console.log(`\nDone! Project ${$app} created.`)
	console.log(`\nNext steps:`)
	console.log(`  cd ${project_path}`)
	console.log(`  git init && git add -A && git commit -m "init"`)
	console.log(`\nDev server:`)
	console.log(`  cd /path/to/mam && npm start`)
	console.log(`  open http://localhost:9080/${app_path}/-/test.html`)
}
