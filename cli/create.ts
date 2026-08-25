import * as fs from 'fs'
import * as path from 'path'

/**
 * Что скаффолдер умеет положить в проект. Одно правило на все: включено, пока не
 * отказались. Раньше половина флагов работала наоборот — `--no-baza` выключал,
 * а `--backend` включал, — и держать в голове, какой из них какой, было нечем.
 * Порядок здесь задаёт порядок в справке.
 */
const FLAGS = {
	docker: 'Docker files',
	baza: 'Giper Baza local-first store',
	tauri: 'Tauri desktop shell',
	backend: '$mol_server REST backend with node:sqlite storage and shared TS item type',
	prerender: 'gh-pages prerender via b-on-g/mol-prerender-action',
	seo: '$bog_seo runtime: pathname router + sitemap + robots + llms + meta inject',
} as const

type CreateOptions = Record<keyof typeof FLAGS, boolean>

function flag_names() {
	return Object.keys(FLAGS) as Array<keyof typeof FLAGS>
}

function parse_flags(args: string[]): { raw: string; options: CreateOptions } {
	const options = Object.fromEntries(flag_names().map(name => [name, true])) as CreateOptions

	let raw = ''

	for (const arg of args) {
		if (arg === '--help' || arg === '-h') return { raw: '', options }

		if (!arg.startsWith('--')) {
			raw = raw || arg
			continue
		}

		const off = arg.startsWith('--no-')
		const name = arg.slice(off ? 5 : 2) as keyof typeof FLAGS

		// Опечатка в флаге не должна молча выдавать проект с чем-то лишним:
		// `--no-bazaa` раньше просто игнорировался, и Baza приезжала как ни в чём
		// не бывало.
		if (!(name in FLAGS)) {
			console.error(`Error: unknown flag ${arg}`)
			console.error(`Known flags: ${flag_names().map(f => `--no-${f}`).join(', ')}`)
			process.exit(1)
		}

		options[name] = !off
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

/**
 * Проект имеет смысл только внутри воркспейса MAM: пути модулей отсчитываются от
 * его корня, а откуда тянуть `mol` и прочие пакеты, знает корневой `.meta.tree`.
 * Сгенерировать можно где угодно, а собрать — только там, поэтому говорим сразу,
 * а не оставляем человека выяснять это на первом `npx mam`.
 */
function check_workspace(cwd: string) {
	const meta = path.join(cwd, '.meta.tree')
	if (fs.existsSync(meta) && /^pack\s+\S+\s+git\s/m.test(fs.readFileSync(meta, 'utf8'))) return true

	// В package.json воркспейса MAM сборщик засветится в скриптах, зависимостях
	// или ключевых словах — этого хватает, чтобы не пугать зря.
	const pkg_path = path.join(cwd, 'package.json')
	if (fs.existsSync(pkg_path)) {
		try {
			const pkg = JSON.parse(fs.readFileSync(pkg_path, 'utf8'))
			const haystack = JSON.stringify([pkg.scripts, pkg.dependencies, pkg.devDependencies, pkg.keywords])
			if (/\bmam\b/.test(haystack)) return true
		} catch {
			// битый package.json — считаем, что признака нет
		}
	}

	console.error(`Warning: this does not look like a MAM workspace.`)
	console.error(`         No .meta.tree with pack lines here, and no mam in package.json.`)
	console.error(`         Module paths are resolved from the MAM root, so the project belongs inside it:`)
	console.error(``)
	console.error(`           git clone https://github.com/hyoo-ru/mam.git`)
	console.error(`           cd mam`)
	console.error(`           npx create-view-tree-lsp <namespace/name>`)
	console.error(``)
	return false
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
		console.error(`Everything below is included by default. Skip what you do not need:`)
		const width = Math.max(...flag_names().map(name => name.length))
		for (const name of flag_names()) {
			console.error(`  --no-${name.padEnd(width)}  Skip ${FLAGS[name]}`)
		}
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
	check_workspace(cwd)

	const skipped = flag_names().filter(name => !options[name])

	console.log(`\nCreating $mol project: ${$app}`)
	console.log(`Path: ${project_path}/`)
	if (skipped.length) console.log(`Skipping: ${skipped.join(', ')}`)

	// Оба пишут в `app/-` на теге, и `cp -rn` оставлял версию пререндера, тихо
	// выбрасывая sitemap и per-page мету от $bog_seo. Это не выбор пользователя,
	// а молчаливая потеря, поэтому в паре побеждает тот, кто умеет больше.
	if (options.prerender && options.seo) {
		console.log(`Note: $bog_seo covers what the prerender action does, so only its step goes into deploy.yml.`)
		console.log(`      Pass --no-seo to use the prerender action instead.`)
	}

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
		<meta property="og:url" content="${gh_pages_url}" />${options.backend ? `
		<meta name="api-base" content="" />` : ''}
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
${options.seo ? `pack bog/builderui/router
pack bog/meta
` : ''}${options.backend ? `pack mol/fetch
pack mol/dom
pack ${project_path}/item
` : ''}`,
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
						\\Welcome to your new $mol app.${options.backend ? `
				<= Items_count $mol_view
					sub /
						\\Items in API:
						<= items_count \\—` : ''}
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
	const seo_static = options.seo
		? `\n\t\tstatic {\n\t\t\t$bog_builderui_router.activate()\n\t\t}\n`
		: ''
	const seo_meta = options.seo
		? `
		@ $mol_mem
		meta(): $bog_meta_data {
			const screen = this.screen()
			const titles: { [ k: string ]: $bog_meta_data } = {
				home: {
					title: '${name}',
					description: '${name} — built with $mol',
					og_title: '${name}',
					og_type: 'website',
				},
			}
			return titles[ screen ] ?? titles.home
		}

		override attr() {
			return { ... super.attr(), ... $bog_meta_attr( this ) }
		}
`
		: ''
	const backend_methods = options.backend
		? `
		api_base() {
			const meta = $mol_dom.document.querySelector( 'meta[name="api-base"]' ) as HTMLMetaElement | null
			const explicit = meta?.content?.trim()
			if( explicit ) return explicit
			// dev fallback: app on :9080 (mam dev) → api on :9092
			const loc = $mol_dom.location
			if( loc?.port === '9080' ) return 'http://localhost:9092'
			return ''
		}

		@ $mol_mem
		items(): readonly ${$}_item[] {
			return this.$.$mol_fetch.json( this.api_base() + '/api/items' ) as readonly ${$}_item[]
		}

		items_count() {
			return String( this.items().length )
		}
`
		: ''
	write(
		path.join(cwd, app_path, 'app.view.ts'),
		`namespace $.$$ {

	export class ${$app} extends $.${$app} {
${seo_static}
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
${seo_meta}${backend_methods}
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

	/** Single item in registry */
	export class ${$}_item extends $giper_baza_entity.with({
		Title: $giper_baza_atom_text,
	}) {}

	/** Data registry in home land */
	export class ${$}_registry extends $giper_baza_entity.with({
		Items: $giper_baza_list_link.to( () => ${$}_item ),
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

	// ── api/ (REST backend on $mol_server + node:sqlite, shared TS type) ──
	if (options.backend) {
		write(
			path.join(cwd, project_path, 'item', 'item.ts'),
			`namespace $ {

	export interface ${$}_item {
		id: string
		title: string
		body: string
		created_at: number
	}

}
`,
		)

		write(
			path.join(cwd, project_path, 'api', 'api.meta.tree'),
			`pack mol/server
pack ${project_path}/item
`,
		)

		write(
			path.join(cwd, project_path, 'api', 'api.node.ts'),
			`namespace $ {

	type Sqlite = typeof import( 'node:sqlite' )
	type SqliteDB = InstanceType< Sqlite[ 'DatabaseSync' ] >

	/**
	 * SQL migrations. Append-only — never edit or remove past entries after deploy.
	 * Current schema version is stored in PRAGMA user_version and only newer
	 * migrations get applied.
	 */
	const migrations: Array< ( db: SqliteDB )=> void > = [
		db => db.exec( \`
			CREATE TABLE items (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				body TEXT NOT NULL,
				created_at INTEGER NOT NULL
			)
		\` ),
	]

	function migrate( db: SqliteDB ) {
		const row = db.prepare( 'PRAGMA user_version' ).get() as { user_version: number } | undefined
		const current = row?.user_version ?? 0
		for( let i = current; i < migrations.length; i++ ) {
			db.exec( 'BEGIN' )
			try {
				migrations[ i ]!( db )
				db.exec( \`PRAGMA user_version = \${ i + 1 }\` )
				db.exec( 'COMMIT' )
			} catch( error ) {
				db.exec( 'ROLLBACK' )
				throw error
			}
		}
	}

	export class ${$}_api extends $mol_server {

		override port() {
			return Number( process.env.${name.toUpperCase().replace(/-/g, '_')}_API_PORT ?? 9092 )
		}

		db_path() {
			return process.env.${name.toUpperCase().replace(/-/g, '_')}_DB_PATH ?? '${project_path}/api/${name}.sqlite'
		}

		@ $mol_mem
		db(): SqliteDB {
			const sqlite = $node[ 'node:sqlite' ] as Sqlite
			const db = new sqlite.DatabaseSync( this.db_path() )
			migrate( db )
			return db
		}

		items(): ${$}_item[] {
			return this.db()
				.prepare( 'SELECT id, title, body, created_at FROM items ORDER BY created_at DESC' )
				.all() as unknown as ${$}_item[]
		}

		item_add( input: { title: string, body: string } ): ${$}_item {
			const id = \`\${ Date.now() }_\${ Math.random().toString( 36 ).slice( 2, 10 ) }\`
			const created_at = Date.now()
			this.db()
				.prepare( 'INSERT INTO items (id, title, body, created_at) VALUES (?, ?, ?, ?)' )
				.run( id, input.title, input.body, created_at )
			return { id, title: input.title, body: input.body, created_at }
		}

		item_delete( id: string ) {
			this.db().prepare( 'DELETE FROM items WHERE id = ?' ).run( id )
			return { ok: true }
		}

		override expressHandlers(): readonly $mol_server_middleware[] {
			return [
				this.expressCors(),
				this.expressCompressor(),
				this.expressBodier(),
				this.expressApi(),
			]
		}

		expressApi(): $mol_server_middleware {
			return ( req, res, next ) => {
				if( req.method === 'GET' && req.path === '/api/items' ) {
					res.json( this.items() )
					return
				}
				if( req.method === 'POST' && req.path === '/api/items' ) {
					const body = req.body as { title?: string, body?: string }
					if( !body?.title ) {
						res.status( 400 ).json({ error: 'title required' })
						return
					}
					res.json( this.item_add({ title: body.title, body: body.body ?? '' }) )
					return
				}
				if( req.method === 'DELETE' && req.path.startsWith( '/api/items/' ) ) {
					const id = req.path.slice( '/api/items/'.length )
					res.json( this.item_delete( id ) )
					return
				}
				next()
			}
		}

	}

}
`,
		)

		write(
			path.join(cwd, project_path, 'api', 'api.run.node.ts'),
			`namespace $ {

	setTimeout( ()=> {
		new ${$}_api().http()
	} )

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
                  modules: 'app'

            - uses: hyoo-ru/gh-deploy@v4.4.1
              if: github.ref == 'refs/heads/main'
              with:
                  folder: "${app_path}/-"

            - name: Deploy feature branch
              if: startsWith(github.ref, 'refs/heads/feature/')
              uses: hyoo-ru/gh-deploy@v4.4.1
              with:
                  folder: "${project_path}/-"
                  target-folder: \${{ github.ref_name }}
${options.prerender && !options.seo ? `
            - uses: b-on-g/mol-prerender-action@main
              if: startsWith(github.ref, 'refs/tags/')
              continue-on-error: true
              with:
                  folder: "${app_path}/-"
                  base-url: "https://\${{ github.repository_owner }}.github.io/\${{ github.event.repository.name }}/"
                  screens: |
                      home
` : ''}${options.seo ? `
            - name: Build $bog_seo
              if: startsWith(github.ref, 'refs/tags/')
              run: npx mam bog/seo

            - name: Serve static and dump prerendered HTML
              if: startsWith(github.ref, 'refs/tags/')
              continue-on-error: true
              run: |
                  npx --yes serve -s "${app_path}/-" -l 9090 > /tmp/serve.log 2>&1 &
                  SERVE_PID=$!
                  sleep 2
                  BOG_SEO_UPSTREAM=http://localhost:9090 \\
                  BOG_SEO_CANONICAL_BASE="https://\${{ github.repository_owner }}.github.io/\${{ github.event.repository.name }}" \\
                  BOG_SEO_DUMP_DIR="${app_path}/-/_seo" \\
                  BOG_SEO_WARMUP=true \\
                  node bog/seo/-/node.js
                  kill $SERVE_PID || true
                  if [ -d "${app_path}/-/_seo" ]; then
                      cp -rn "${app_path}/-/_seo/"* "${app_path}/-/" || true
                      rm -rf "${app_path}/-/_seo"
                  fi
` : ''}
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
			`FROM node:24-alpine AS build
WORKDIR /app
RUN git clone --depth 1 https://github.com/hyoo-ru/mam.git . \\
    && npm install
COPY . ${project_path}/
RUN npx mam ${project_path}

FROM nginx:alpine
COPY --from=build /app/${project_path}/- /usr/share/nginx/html
${options.backend || options.seo ? `COPY nginx.conf /etc/nginx/conf.d/default.conf
` : ''}EXPOSE 80
`,
		)

		if (options.backend || options.seo) {
			const api_proxy = options.backend ? `
    location /api/ {
        proxy_pass http://api:9092;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
` : ''
			write(
				path.join(cwd, project_path, 'nginx.conf'),
				`server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
${api_proxy}
    # SPA fallback — any unknown path under the app falls back to index.html.
    # Required for pathname-router (--seo) and any client-side routing.
    location / {
        try_files $uri $uri/ /index.html;
    }
}
`,
			)
		}

		write(
			path.join(cwd, project_path, 'docker-compose.yml'),
			`services:
  web:
    build: .
    ports:
      - "8080:80"${options.backend ? `
    depends_on:
      - api` : ''}
${options.backend ? `  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    environment:
      ${name.toUpperCase().replace(/-/g, '_')}_DB_PATH: /data/${name}.sqlite
    volumes:
      - api-data:/data
    ports:
      - "9092:9092"
` : ''}${options.seo ? `  seo:
    build:
      context: .
      dockerfile: Dockerfile.seo
    environment:
      BOG_SEO_UPSTREAM: http://web
      BOG_SEO_CANONICAL_BASE: https://example.com
      BOG_SEO_WARMUP: 'true'
    depends_on:
      - web
    ports:
      - "3334:3334"
` : ''}${options.backend ? `
volumes:
  api-data:
` : ''}`,
		)

		if (options.seo) {
			write(
				path.join(cwd, project_path, 'Dockerfile.seo'),
				`FROM node:24-alpine
WORKDIR /app
RUN apk add --no-cache git chromium nss ca-certificates ttf-freefont \\
    && git clone --depth 1 https://github.com/hyoo-ru/mam.git . \\
    && npm install \\
    && npx mam bog/seo
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
EXPOSE 3334
CMD ["node", "bog/seo/-/node.js"]
`,
			)
		}

		if (options.backend) {
			write(
				path.join(cwd, project_path, 'Dockerfile.api'),
				`FROM node:24-alpine AS build
WORKDIR /app
RUN apk add --no-cache git python3 make g++ \\
    && git clone --depth 1 https://github.com/hyoo-ru/mam.git . \\
    && npm install
COPY . ${project_path}/
RUN npx mam ${project_path}/api

FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/${project_path}/api/- /app/${project_path}/api/-
RUN mkdir -p /data
EXPOSE 9092
CMD ["node", "${project_path}/api/-/node.js"]
`,
			)
		}
	}

	// ── README.md ──
	const docker_section = options.docker
		? `
## Docker

\`\`\`bash
docker compose up --build
# Open http://localhost:8080
${options.seo ? `# Bots → http://localhost:3334 (SEO prerender)
` : ''}\`\`\`
`
		: ''

	const backend_section = options.backend
		? `
## REST API ($mol_server + node:sqlite)

Backend in \`${project_path}/api/\` — \`${$}_api extends $mol_server\`. Single shared TS type \`${$}_item\` lives in \`${project_path}/item/item.ts\` and is imported by both the REST handler (return type) and the frontend (response type).

Storage: \`node:sqlite\` (built-in to Node.js 22+, no extra dependency). DB file: \`${project_path}/api/${name}.sqlite\`.

### Endpoints

- \`GET /api/items\` → \`${$}_item[]\`
- \`POST /api/items\` body \`{title, body}\` → \`${$}_item\`
- \`DELETE /api/items/<id>\` → \`{ok: true}\`

### Run

\`\`\`bash
npx mam ${project_path}/api
node ${project_path}/api/-/node.js
# default port 9092, override: ${name.toUpperCase().replace(/-/g, '_')}_API_PORT
# default db path: ${project_path}/api/${name}.sqlite, override: ${name.toUpperCase().replace(/-/g, '_')}_DB_PATH
\`\`\`
`
		: ''

	const seo_section = options.seo
		? `
## SEO ($bog_seo)

Pathname-router (\`$bog_builderui_router.activate()\`) активирован в \`app.view.ts\`. URL формы \`/path/key=value\` вместо \`#!key=value\`. Dev-режим (\`/-/test.html\`) остаётся на хеш-роутере автоматически.

Meta (\`<title>\`, \`<meta description>\`, \`<meta og:*>\`, \`<link rel=canonical>\`) объявляется в \`meta()\` и инжектится в head через \`$bog_meta_attr\` + crawler.

### Локально

\`\`\`bash
# Поднять собранный app как static (после \`npx mam ${project_path}\`)
npx serve -s ${app_path}/- -l 9090

# Поднять SEO сервис на :3334
BOG_SEO_UPSTREAM=http://localhost:9090 \\
BOG_SEO_WARMUP=true \\
node bog/seo/-/node.js

# Эндпоинты
curl http://localhost:3334/sitemap.xml
curl http://localhost:3334/robots.txt
curl http://localhost:3334/llms.txt
curl -A "Googlebot" http://localhost:3334/
\`\`\`

### Dump-режим (для CI)

\`\`\`bash
BOG_SEO_UPSTREAM=http://localhost:9090 \\
BOG_SEO_DUMP_DIR=${app_path}/-/_seo \\
BOG_SEO_CANONICAL_BASE=${gh_pages_url.replace(/\/$/, '')} \\
node bog/seo/-/node.js
\`\`\`

В CI workflow это уже подключено под тег \`v*\`.
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

Push to \`main\` → GitHub Actions → GitHub Pages: ${gh_pages_url}

Feature branches deploy to: ${gh_pages_url}{branch-name}/
${backend_section}${seo_section}${tauri_section}`,
	)

	// ── .gitignore ──
	write(
		path.join(cwd, project_path, '.gitignore'),
		`-*
.DS_Store
${options.backend ? `*.sqlite
*.sqlite-journal
` : ''}`,
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
