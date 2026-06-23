"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function parse_flags(args) {
    const options = {
        docker: true,
        baza: true,
        tauri: true,
        prerender: false,
        seo: false,
    };
    let raw = '';
    for (const arg of args) {
        if (arg === '--no-docker')
            options.docker = false;
        else if (arg === '--no-baza')
            options.baza = false;
        else if (arg === '--no-tauri')
            options.tauri = false;
        else if (arg === '--no-prerender')
            options.prerender = false;
        else if (arg === '--prerender')
            options.prerender = true;
        else if (arg === '--no-seo')
            options.seo = false;
        else if (arg === '--seo')
            options.seo = true;
        else if (!arg.startsWith('--'))
            raw = raw || arg;
    }
    return { raw, options };
}
function parse_input(raw) {
    let input = raw.replace(/^\$/, '');
    input = input.replace(/_/g, '/');
    const parts = input.split('/').filter(Boolean);
    const segments = parts.at(-1) === 'app' ? parts.slice(0, -1) : parts;
    if (segments.length < 2) {
        console.error(`Error: need at least namespace/name, got: ${raw}`);
        console.error(`Example: view-tree-lsp create bog/myapp`);
        process.exit(1);
    }
    const project_path = segments.join('/');
    const app_path = project_path + '/app';
    return { segments, app_path, project_path };
}
function prefix(segments) {
    return '$' + segments.join('_');
}
function write(filepath, content) {
    const dir = path.dirname(filepath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filepath, content);
    console.log(`  + ${filepath}`);
}
function create(args) {
    const { raw, options } = parse_flags(args);
    if (!raw) {
        console.error(`Usage: view-tree-lsp create <namespace/name> [flags]`);
        console.error(``);
        console.error(`Flags:`);
        console.error(`  --no-docker    Skip Docker files`);
        console.error(`  --no-baza      Skip Giper Baza store`);
        console.error(`  --no-tauri     Skip Tauri desktop files`);
        console.error(`  --prerender    Add gh-pages prerender via b-on-g/mol-prerender-action (off)`);
        console.error(`  --seo          Add $bog_seo runtime (pathname router + sitemap + robots + llms + meta inject) (off)`);
        process.exit(1);
    }
    const { segments, app_path, project_path } = parse_input(raw);
    const $ = prefix(segments);
    const $app = $ + '_app';
    const name = segments.at(-1);
    const gh_org = segments[0];
    const gh_repo = segments.at(-1);
    const gh_pages_url = `https://${gh_org}.github.io/${gh_repo}/`;
    const asset_path = project_path;
    const cwd = process.cwd();
    const skipped = [];
    if (!options.docker)
        skipped.push('docker');
    if (!options.baza)
        skipped.push('baza');
    if (!options.tauri)
        skipped.push('tauri');
    if (!options.prerender)
        skipped.push('prerender');
    if (!options.seo)
        skipped.push('seo');
    console.log(`\nCreating $mol project: ${$app}`);
    console.log(`Path: ${project_path}/`);
    if (skipped.length)
        console.log(`Skipping: ${skipped.join(', ')}`);
    console.log(``);
    // ── index.html ──
    write(path.join(cwd, app_path, 'index.html'), `<!doctype html>
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
`);
    // ── app.meta.tree ──
    write(path.join(cwd, app_path, 'app.meta.tree'), `include \\/mol/offline/install
deploy \\/${asset_path}/assets
${options.seo ? `pack bog/builderui/router
pack bog/meta
` : ''}`);
    // ── app.view.tree ──
    const baza_tools = options.baza ? `\n\t\t<= Status $giper_baza_status` : '';
    write(path.join(cwd, app_path, 'app.view.tree'), `${$app} $mol_page
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
`);
    // ── app.view.ts ──
    const seo_static = options.seo
        ? `\n\t\tstatic {\n\t\t\t$bog_builderui_router.activate()\n\t\t}\n`
        : '';
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
        : '';
    write(path.join(cwd, app_path, 'app.view.ts'), `namespace $.$$ {

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
${seo_meta}
	}

}
`);
    // ── app.view.css.ts ──
    write(path.join(cwd, app_path, 'app.view.css.ts'), `namespace $ {

	$mol_style_define( ${$app}, {
	})

}
`);
    // ── app.test.ts ──
    write(path.join(cwd, app_path, 'app.test.ts'), `namespace $ {

	$mol_test({

		'app renders'() {
			const app = new ${$app}
			$mol_assert_ok( app )
		},

	})

}
`);
    // ── app.locale=ru.json ──
    write(path.join(cwd, app_path, 'app.locale=ru.json'), `{
	"${$app}_title": "${name}"
}
`);
    // ── store/store.ts (Giper Baza) ──
    if (options.baza) {
        write(path.join(cwd, project_path, 'store', 'store.ts'), `namespace $ {

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
`);
    }
    // ── assets/ ──
    write(path.join(cwd, project_path, 'assets', 'logo.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
	<rect width="64" height="64" rx="12" fill="#7c3aed"/>
	<text x="32" y="44" font-size="32" font-family="system-ui" fill="white" text-anchor="middle">${name[0]?.toUpperCase() ?? 'A'}</text>
</svg>
`);
    // ── .github/workflows/deploy.yml ──
    write(path.join(cwd, project_path, '.github', 'workflows', 'deploy.yml'), `name: ${$app}

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
${options.prerender ? `
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
`);
    // ── Tauri ──
    if (options.tauri) {
        write(path.join(cwd, project_path, '.github', 'workflows', 'tauri.yml'), `name: Tauri Desktop Build

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
`);
        write(path.join(cwd, project_path, 'src-tauri', 'tauri.conf.json'), JSON.stringify({
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
        }, null, '\t') + '\n');
        write(path.join(cwd, project_path, 'src-tauri', 'Cargo.toml'), `[package]
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
`);
        write(path.join(cwd, project_path, 'src-tauri', 'src', 'lib.rs'), `#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
`);
        write(path.join(cwd, project_path, 'src-tauri', 'src', 'main.rs'), `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ${gh_repo.replace(/-/g, '_')}_lib::run()
}
`);
    }
    // ── Docker ──
    if (options.docker) {
        write(path.join(cwd, project_path, 'Dockerfile'), `FROM node:20-alpine AS build
WORKDIR /app
RUN git clone --depth 1 https://github.com/hyoo-ru/mam.git . \\
    && npm install
COPY . ${project_path}/
RUN npx mam ${project_path}

FROM nginx:alpine
COPY --from=build /app/${project_path}/- /usr/share/nginx/html
EXPOSE 80
`);
        write(path.join(cwd, project_path, 'docker-compose.yml'), `services:
  web:
    build: .
    ports:
      - "8080:80"
${options.seo ? `  seo:
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
` : ''}`);
        if (options.seo) {
            write(path.join(cwd, project_path, 'Dockerfile.seo'), `FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache git chromium nss ca-certificates ttf-freefont \\
    && git clone --depth 1 https://github.com/hyoo-ru/mam.git . \\
    && npm install \\
    && npx mam bog/seo
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
EXPOSE 3334
CMD ["node", "bog/seo/-/node.js"]
`);
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
        : '';
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
        : '';
    const tauri_section = options.tauri
        ? `
## Desktop (Tauri)

Tag \`v*\` triggers Tauri build via GitHub Actions.
`
        : '';
    write(path.join(cwd, project_path, 'README.md'), `# ${name}

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
${seo_section}${tauri_section}`);
    // ── .gitignore ──
    write(path.join(cwd, project_path, '.gitignore'), `-*
.DS_Store
`);
    // ── .gitattributes ──
    write(path.join(cwd, project_path, '.gitattributes'), `* -text
`);
    console.log(`\nDone! Project ${$app} created.`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${project_path}`);
    console.log(`  git init && git add -A && git commit -m "init"`);
    console.log(`\nDev server:`);
    console.log(`  cd /path/to/mam && npm start`);
    console.log(`  open http://localhost:9080/${app_path}/-/test.html`);
}
