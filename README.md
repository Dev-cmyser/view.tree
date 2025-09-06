view.tree — грамматика Tree‑sitter и LSP

Экспериментальный стек для языка «view.tree»:
- грамматика Tree‑sitter (подпроект `tree-sitter-viewtree`),
- подсветка синтаксиса (TextMate + Tree‑sitter queries в `highlights/`),
- минимальный LSP‑сервер на TypeScript (`server/`),
- заготовка клиента VS Code (`vscode/`).

## Быстрый старт
- Требования: Node.js 18+, npm, CLI `tree-sitter`.
- Установка зависимостей: в корне `npm i`.
- (Опционально) генерация грамматики: `npm run gen`.
- Сборка LSP: `npm run build` (артефакты в `out/`).

## Полезные скрипты
- `npm run start`: запускает Tree‑sitter playground (c `--wasm` билдом).
- `npm run tree`: доступ к CLI Tree‑sitter в подпроекте.
- `npm run gen`: генерирует парсер и ставит зависимости грамматики.
- `npm run build`: собирает TypeScript‑сервер в `out/`.
- `npm run start-server`: запускает сервер напрямую (`node out/server/index.js`).
- `npm run watch-server`: watch‑сборка сервера.

## Структура
- `tree-sitter-viewtree/`: грамматика (`grammar.js`), сгенерированные файлы, `example.view.tree`.
- `highlights/`: подсветка — TextMate (`tmLanguage.json`) и Tree‑sitter (`highlights.scm`).
- `server/`: минимальный LSP (инициализация, completion, semantic tokens, заглушки под diagnostics).
- `vscode/`: подключение клиента VS Code к LSP.
- `out/`: результат сборки TypeScript.

## Язык (кратко)
- Файлы: расширение `.view.tree`.
- Компоненты: `$Name $Base` с вложенностью по таб‑отступам.
- Свойства: `key`, `key <= $Type`, `key <=> otherProp`, литералы (`number`, `true/false`, `null`, строки `\…`).
- Списки/словари: `/ $Type`, `*`, спец‑строка `^`.
Пример: `tree-sitter-viewtree/example.view.tree`.

## VS Code (dev)
Соберите сервер (`npm run build`) и запустите Extension Host VS Code на этой папке. Клиент настраивает язык `view.tree` и подключает LSP.
