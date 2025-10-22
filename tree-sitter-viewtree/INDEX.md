# 📑 Индекс файлов Tree-sitter Grammar for view.tree

## 🎯 Основные файлы

### Грамматика и парсер
- **grammar.js** - Определение грамматики с nested token chains
- **src/scanner.c** - External scanner на C для обработки отступов
- **src/parser.c** - Сгенерированный парсер (автоматически)

### Конфигурация
- **package.json** - npm пакет и скрипты
- **binding.gyp** - Конфигурация для нативной сборки
- **tree-sitter.json** - Конфигурация tree-sitter

## 📝 Документация (7 файлов)

1. **README.md** - Главная документация и быстрый старт
2. **GRAMMAR.md** - Подробное описание грамматики
3. **STRUCTURE.md** - Сравнение структуры с mol_tree2
4. **HIGHLIGHTS.md** - Руководство по синтаксической подсветке
5. **QUERIES.md** - Документация по query файлам
6. **FINAL_SUMMARY.md** - Итоговый summary реализации
7. **COMPLETE.md** - Полный отчет о завершении
8. **INDEX.md** - Этот файл (индекс)

## 🎨 Query файлы (8 файлов)

Все находятся в директории `queries/`:

1. **highlights.scm** - Синтаксическая подсветка (11 типов токенов)
2. **folds.scm** - Сворачивание блоков кода
3. **indents.scm** - Автоматические отступы
4. **textobjects.scm** - Vim text objects (vac, vip, vab)
5. **locals.scm** - Анализ областей видимости
6. **tags.scm** - Навигация по символам (ctags)
7. **references.scm** - Поиск использований
8. **injections.scm** - Встроенные языки (заготовка)

## 🧪 Тестовые файлы

### Примеры view.tree
- **test_simple.view.tree** - Базовый пример с 3 нодами
- **test_complex.view.tree** - Сложный пример из спецификации
- **test_all_tokens.view.tree** - Демонстрация всех 11 типов токенов
- **example.view.tree** - Реальный пример из проекта

### Скрипты проверки
- **test.js** - Сравнение с mol_tree2
- **verify_structure.js** - Проверка вложенности токенов
- **compare_structures.js** - Визуализация различий структур
- **test_simple_parse.js** - Детальный разбор простого примера
- **test_debug.js** - Отладочный скрипт

## 📊 Статистика

| Категория | Количество |
|-----------|-----------|
| Документов | 8 |
| Query файлов | 8 |
| Тестов | 4 |
| Скриптов проверки | 5 |
| Типов токенов | 11 |
| Всего файлов | ~30 |

## 🗂️ Структура директорий

```
bog/lsp/view.tree/tree-sitter-viewtree/
│
├── 📄 Основные файлы
│   ├── grammar.js
│   ├── package.json
│   ├── binding.gyp
│   └── tree-sitter.json
│
├── 📁 src/
│   ├── scanner.c (написан вручную)
│   ├── parser.c (сгенерирован)
│   ├── tree_sitter/
│   └── node-types.json
│
├── 📁 queries/
│   ├── highlights.scm
│   ├── folds.scm
│   ├── indents.scm
│   ├── textobjects.scm
│   ├── locals.scm
│   ├── tags.scm
│   ├── references.scm
│   └── injections.scm
│
├── 📁 Документация/
│   ├── README.md
│   ├── GRAMMAR.md
│   ├── STRUCTURE.md
│   ├── HIGHLIGHTS.md
│   ├── QUERIES.md
│   ├── FINAL_SUMMARY.md
│   ├── COMPLETE.md
│   └── INDEX.md
│
└── 📁 Тесты/
    ├── test_simple.view.tree
    ├── test_complex.view.tree
    ├── test_all_tokens.view.tree
    ├── example.view.tree
    ├── test.js
    ├── verify_structure.js
    ├── compare_structures.js
    ├── test_simple_parse.js
    └── test_debug.js
```

## 🚀 Быстрые ссылки

### Для начала работы
1. Читай: **README.md**
2. Генерируй: `npm run gen`
3. Тестируй: `tree-sitter parse test_complex.view.tree`

### Для понимания структуры
1. Читай: **STRUCTURE.md**
2. Запускай: `npm run js`
3. Смотри: **verify_structure.js**

### Для настройки подсветки
1. Читай: **HIGHLIGHTS.md**
2. Смотри: **queries/highlights.scm**
3. Тестируй: `tree-sitter query queries/highlights.scm example.view.tree`

### Для интеграции в редактор
1. Читай: **QUERIES.md**
2. Копируй: `queries/*.scm`
3. Настраивай: См. README.md раздел "Editor Integration"

## ✅ Чек-лист функциональности

- ✅ Парсинг с правильной вложенностью
- ✅ 11 типов токенов распознаются
- ✅ Синтаксическая подсветка
- ✅ Сворачивание кода
- ✅ Автоотступы
- ✅ Vim text objects
- ✅ Навигация по символам
- ✅ Поиск использований
- ✅ Структура соответствует mol_tree2
- ✅ Все тесты проходят
- ✅ Полная документация

## 📞 Контакты и ссылки

- **Репозиторий:** bog/lsp/view.tree/tree-sitter-viewtree/
- **Спецификация:** bog/lsp/Tree Language Grammar Notation.md
- **mol_tree2:** node_modules/mol_tree2/
- **Tree-sitter:** https://tree-sitter.github.io/

---

**Версия:** 1.0.0  
**Статус:** ✅ COMPLETE  
**Дата:** 2024-10-22
