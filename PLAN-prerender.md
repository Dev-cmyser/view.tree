# Prerender для краулеров — auto-discovery + meta

## Цель
Заменить `b-on-g/mol-prerender-action` (ручной список pages) на auto-discovery через краулер. **Только для ботов**, юзеры получают SPA как есть. Sitemap + robots — побочный продукт того же обхода.

Принцип: **не менять оригиналы** (`$mol_server`, `$mol_browser`, `$bog_prerender`). Делаем копии в `bog/*` по примеру `bog_builderui_div`. Каждая новая фича — отдельный MAM-модуль наследник.

В итоге всё интегрируется в `create-view-tree-lsp` как новый компонент скаффолда.

---

## Этап 1: auto-discovery + sitemap + robots

### Что делаем
- Новый MAM-модуль `bog/prerender_auto/` — наследник `$bog_prerender`.
- При запуске обходит upstream от `/` по `<a href>` рекурсивно (BFS), собирает все internal URLs.
- Кэширует HTML по каждому URL (наследует cache из `$bog_prerender`).
- Отдаёт prerendered HTML только ботам (UA-detect уже есть в родителе).
- Юзеры получают proxy к upstream без изменений.
- Дополнительные эндпоинты:
  - `GET /sitemap.xml` — из набора URLs в кэше.
  - `GET /robots.txt` — статический + ссылка на sitemap.

### Файлы
```
bog/prerender_auto/
  prerender_auto.node.ts   # class $bog_seo extends $bog_prerender
  crawl.node.ts            # BFS по <a href>
  sitemap.node.ts          # XML-сериализатор
  robots.node.ts           # robots.txt-сериализатор
  run.node.ts              # entry-point для node-запуска
  -/test.html              # dev-страница (если нужна UI)
  readme.md                # как запускать
```

### Логика crawler (`crawl.node.ts`)
```
function crawl(root_url: string, render: (url: string) => string): Map<string, string>
```
1. `queue = [ root_url ]`, `seen = Set<string>`, `cache = Map<string,string>`.
2. Пока `queue.length`:
   - `url = queue.shift()`
   - Если `seen.has(url)` — skip
   - `seen.add(url)`
   - `html = render(url)` — внутри `$mol_browser.html(url)`
   - `cache.set(url, html)`
   - Достаём ссылки: regex `/<a\s+[^>]*href="([^"]+)"/gi`
   - Фильтр: same-origin, не `#fragment-only`, не `mailto:`/`tel:`/`javascript:`
   - Нормализуем relative → absolute через `new URL(href, url)`
   - Новые в queue
3. Возвращаем `cache`.

### Override `expressHandlers` в `prerender_auto.node.ts`
```ts
override expressHandlers() {
    return [
        this.expressCors(),
        this.expressCompressor(),
        this.expressSitemap(),   // новый
        this.expressRobots(),    // новый
        this.expressGenerator(), // наследует — UA-detect + cached_render
        this.expressProxy(),     // наследует
    ]
}
```

### Когда запускать crawl
- **Lazy** (по умолчанию): первый запрос бота на любой URL → запуск crawl от `upstream()` в фоне. Текущий запрос обрабатывается обычно (бот получает свою страницу через `cached_render`).
- **Warmup при старте**: флаг `BOG_PRERENDER_WARMUP=true` — crawl от `/` сразу при `start()`.
- **TTL refresh**: переиспользует `cache_ttl()` из родителя — после истечения кэш обновляется при следующем запросе (как сейчас).

### Sitemap.xml
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-06-22</lastmod>
  </url>
  …
</urlset>
```
URLs — из `this.cache.keys()`. `lastmod` — из `entry.timestamp`. Если cache пустой → запустить crawl синхронно (один раз).

### Robots.txt
```
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```
Базовый шаблон. `Sitemap:` строится от `req.protocol + req.host`.

### Env-флаги
- `BOG_PRERENDER_PORT` — наследуется (3333)
- `BOG_PRERENDER_UPSTREAM` — наследуется (http://localhost:9080)
- `BOG_PRERENDER_CACHE` — наследуется
- `BOG_PRERENDER_CACHE_TTL` — наследуется
- `BOG_PRERENDER_WARMUP` — новый, `true|false`, default `false`
- `BOG_PRERENDER_MAX_DEPTH` — новый, ограничитель глубины crawl, default `10`
- `BOG_PRERENDER_MAX_PAGES` — новый, лимит страниц, default `1000`

### Проверка этапа 1
- `node bog/prerender_auto/-/run.node.js` — поднимает сервер на :3333.
- Поднять `bog/prerender_auto/` тестовый MAM-app с несколькими страницами и внутренними ссылками.
- `curl http://localhost:3333/sitemap.xml` — содержит ВСЕ ссылки внутри тестового app, не только `/`.
- `curl http://localhost:3333/robots.txt` — корректный формат.
- `curl -A "Googlebot" http://localhost:3333/page2` — отдаёт prerendered HTML с реально отрендеренным контентом (не пустой `<body>`).
- `curl http://localhost:3333/page2` — отдаёт proxy-ответ от upstream (юзер).
- `BOG_PRERENDER_WARMUP=true node …` — в логах сразу `[crawl] N pages discovered`.
- Глубина и лимит работают: страницы за `MAX_DEPTH`/`MAX_PAGES` не попадают в sitemap.

---

## Этап 1.5: llms.txt + fix mol/browser types (мини-эпик)

### llms.txt
- Стандарт https://llmstxt.org/ — markdown-файл, помогает LLM понимать структуру сайта.
- Endpoint `GET /llms.txt`.
- Формат:
  ```
  # <Site title>

  > <site description>

  ## Pages

  - [<title>](<url>): <short description>
  ```
- Источник:
  - Список URLs — из `discovered` (уже есть).
  - Title страницы — парсим `<title>` из cached html (надёжно).
  - Description — из `<meta name="description">` или (после этапа 2) из `@$bog_meta`.
- Если кэш пустой — стрелять crawl (как в sitemap).

### Fix mol/browser types
- Audit падает на `mol/browser/browser.ts(11,5): 'ignoreHTTPSErrors' does not exist in type 'LaunchOptions'` — в новых puppeteer опция переименована в `acceptInsecureCerts`.
- Не патчим оригинал — делаем копию `bog/browser/` (`$bog_browser`):
  - `bog/browser/browser.ts` — drop-in копия `$mol_browser` с `acceptInsecureCerts: true` вместо `ignoreHTTPSErrors`.
- `$bog_seo` override `render(url)` чтобы использовать `$bog_browser.html(url)` вместо родительского `$mol_browser.html(url)`.
- Оригинал `$mol_browser` и `$bog_prerender` НЕ трогаем.

---

## Этап 2: Meta-декоратор + демо + интеграция в скаффолд

### Что добавляем
- `bog/meta/` — модуль с декоратором `@$bog_meta` и сборщиком.
- Декоратор маркирует view-методы возвращающие `{ title, description, og_image, canonical, og_type, ... }`.
- При prerender обход view-дерева снизу вверх собирает meta с приоритетом «глубже = важнее» (как `generateMetadata` в Next).
- Результат вставляется в `<head>` отрендеренного HTML до отдачи боту.

### Файлы
```
bog/meta/
  meta.ts                  # @$bog_meta декоратор (маркер через Symbol)
  collect.ts               # обход view-дерева + merge
  inject.node.ts           # вставка <meta>/<title>/<link rel=canonical> в head HTML
```

И в `bog/prerender_auto/prerender_auto.node.ts` override `render(url)`:
```ts
override render(url: string) {
    const html = super.render(url)               // $mol_browser.html(url)
    const meta = this.extract_meta(html)         // парсим data-meta из html
    return this.inject(html, meta)               // вставляем в <head>
}
```

### Открытые вопросы для этапа 2 (решить когда дойдём)
1. **Как достать view-meta из puppeteer-page?** Варианты:
   - А) `page.evaluate(() => $mol_app.Root(0).meta())` — требует доступ к `$` в браузере.
   - Б) В rendered HTML view самостоятельно пишет `<script data-meta type="application/json">{…}</script>` — prerender достаёт после рендера и переносит в `<head>`. Проще, без `evaluate`. **Скорее всего вариант Б.**
2. **Канonical для prerender** = upstream URL без query или с whitelist query-params? Опция на уровне декоратора.
3. **og:image** — статический путь, файл из MAM-модуля, или dynamic-генератор (canvas)? Этап 2 — только статика, динамика — этап 3.
4. **Локализация мета** — `og:locale`, `hreflang`. Сейчас в темплейте Лиум статика. Подключить позже.
5. **Title/description fallback** — что если view не определил `@$bog_meta`? Брать с корня (app-уровень)? Делать обязательным для prerender-роутов?

### Интеграция в `create-view-tree-lsp`
- Новый флаг `--prerender` (default true) добавляет:
  - `bog/<app>_prerender/` — наследник `$bog_seo` с прибитым `upstream()` к этому app
  - `docker-compose.yml` сервис `prerender` рядом с `app`
  - nginx/caddy snippet с маршрутизацией ботов → :3333
- Флаг `--no-prerender` — пропустить.

---

## Что НЕ делаем

- Не трогаем `$mol_browser`, `$mol_server`, `$bog_prerender` — только наследуем.
- Не делаем гидрацию у пользователей — она не нужна (явное указание: prerender только для ботов).
- Существующий `b-on-g/mol-prerender-action` остаётся как fallback для проектов со статическими страницами.
- `bog/ssg/generate/` (puppeteer + md) не трогаем — это для doc-сайтов, отдельная история.
- SSR с гидрацией для людей — НЕ делаем, не нужно.

---

## Зависимости и порядок

1. Этап 1 — самодостаточен. Можно публиковать как отдельный модуль `bog_seo`.
2. Этап 2 — поверх этапа 1. Требует `bog/meta/` + правки в `render()`.
3. Интеграция в скаффолд — после обоих этапов.

---

## Итог по этапам 1 + 1.5 + 2 (готово)

Финальные модули:
- `bog/browser/` — копия `$mol_browser` с фиксом `acceptInsecureCerts`
- `bog/meta/` — `$bog_meta_data` (interface), `$bog_meta_attr` (helper для `attr()` во view), `$bog_meta_compact`, `$bog_meta_merge`
- `bog/meta/inject/` — `$bog_meta_inject` (server-side: парсит `data-bog-meta` и инжектит `<title>`/`<meta>`/`<link rel=canonical>` в `<head>`)
- `bog/seo/` — `$bog_seo extends $mol_server` (самодостаточный, **не** наследует `$bog_prerender`, чтобы не тянуть `$mol_browser` в граф). Содержит: crawler, sitemap, robots, llms, meta inject, prerender для ботов, proxy для юзеров.
- `bog/sample/` — демо-frontend на `$mol_book2` + `meta()` на каждой странице + `attr()` override через `$bog_meta_attr` + `$mol_fetch` к API
- `bog/sample/api/` — REST-бэк на `$mol_server`, отдаёт `$bog_sample_post[]`
- `bog/sample/post/` — общий тип `$bog_sample_post` для фронта и бэка

Важное наблюдение про граф mam:
- Имя класса `$bog_x_y` mam парсит как путь `bog/x/y/`. Поэтому top-level модуль НЕЛЬЗЯ называть `$bog_prerender_auto` если рядом есть `bog/prerender/` — mam потянет родителя в граф вне зависимости от extends. Выбор имени = выбор namespace.

Известное ограничение демо (не блокер, для скаффолда — задача):
- `$mol_state_arg` использует hash (`#!page=about`), не pathname. Бот заходит на упрошённый URL, видит стартовую страницу.

---

## Решение pathname-routing: `$bog_builderui_router`

`bog/builderui/router/` — production-ready drop-in замена `$mol_state_arg`. Из коробки:
- URL прямо в `pathname`: `/myapp/page=about/theme=dark?ref=tw` (без `#!`).
- Активируется одной строкой в static-инициализаторе: `static { $bog_builderui_router.activate() }`.
- Auto-detect mount из `<script src="web.js">` (работает и в mam-dev, и в проде).
- Dev-guard: skipает активацию если pathname содержит `.html` или `/-/` — npx mam dev остаётся на хеш-роутере.
- Миграция legacy hash + GH-Pages SPA-redirect (`?/path`) автоматически.
- Server contract: любой неизвестный путь под mount → `index.html`. Caddy/nginx/Tauri/GH-Pages — все примеры в `bog/builderui/router/readme.md`.
- Несколько роутеров в одном bundle через `.at(mount)`.

### Цена интеграции

`$bog_builderui_router` сидит в `bog/builderui/router/` — это подмодуль `bog/builderui/`. По правилу [mam токены тянут родителя](../../../../-Users-cmyser-code-mam/memory/mam_namespace_path_pulls_parent.md) подключение тянет весь UI-kit (~23 модуля) в граф фронта. Для скаффолда, где builderui всё равно — основной UI-kit, это бесплатно. Если хочется минимальной зависимости — вынести router в отдельный top-level namespace (`bog/router/`), уже как утилитарный пакет.

### Подключено к `bog/sample`

```ts
namespace $.$$ {
    export class $bog_sample extends $.$bog_sample {
        static { $bog_builderui_router.activate() }
        // …
    }
}
```

`bog/sample/sample.meta.tree`: `pack bog/builderui/router`. Audit прошёл.

В dev-режиме (mam server на `:9080/.../-/test.html`) активация скипается guard'ом — ничего не ломается. В проде (host раздаёт `/myapp/` с SPA-fallback) — pathname-routing работает, бот видит правильную страницу по URL без hash.

---

## Что доделать в скаффолде `create-view-tree-lsp`

Текущий `bog/lsp/view.tree/cli/create.ts` имеет флаг `--prerender`, но он включает старый `b-on-g/mol-prerender-action@main` с ручным `screens: home`. Заменить на:

1. **В шаблон `app.view.ts`**:
   ```ts
   static { $bog_builderui_router.activate() }
   meta(): $bog_meta_data { return { title: '<name>', description: '...' } }
   override attr() { return { ...super.attr(), ...$bog_meta_attr( this ) } }
   ```
2. **В `app.meta.tree`**: `pack bog/builderui/router` + `pack bog/meta`.
3. **В `.github/workflows/...`**: вместо `b-on-g/mol-prerender-action@main` поднимать `$bog_seo` в CI job или Docker-контейнере. Для GH-Pages-деплоя можно сделать step «запустить $bog_seo против локального static-server, скрапить prerendered HTML по sitemap → коммитить в gh-pages».
4. **Docker-compose** (флаг `--docker`): добавить сервис `seo` рядом с `app`:
   ```yaml
   seo:
     build: ./seo
     environment:
       BOG_SEO_UPSTREAM: http://app
       BOG_SEO_CANONICAL_BASE: https://example.com
       BOG_SEO_WARMUP: 'true'
     ports: [ "3334:3334" ]
   ```
   nginx/caddy перед всем этим: всех ботов (UA) → `:3334`, остальных → `app`.
5. **Шаблонный `index.html`** уже содержит open-graph meta из шаблона — оставить как fallback (если view не определил meta).
