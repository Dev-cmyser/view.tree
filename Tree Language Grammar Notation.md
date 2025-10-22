# Полная БНФ грамматика языка view.tree

## Введение

view.tree — это декларативный язык описания компонентов в фреймворке $mol. Язык основан на древовидной структуре с использованием табуляции для обозначения вложенности. Грамматика охватывает все синтаксические конструкции, включая объявление компонентов, свойства, операторы связывания, типы данных и специальные маркеры.

## Принципы

- **Табуляция**: используются TAB-символы для отступов (не пробелы)
- **Древовидная структура**: вложенность определяется уровнем отступа
- **Уникальные имена**: каждый узел должен иметь уникальное имя
- **Визуальный поток данных**: операторы показывают направление данных стрелками

## Полная БНФ грамматика (EBNF нотация)

```ebnf
(* ========== ОСНОВНАЯ СТРУКТУРА ========== *)

file ::= component+

component ::= component_declaration property_list

component_declaration ::= component_name component_base NEWLINE

component_name ::= "$" identifier

component_base ::= "$" identifier

property_list ::= (property)*

(* ========== СВОЙСТВА И УЗЛЫ ========== *)

property ::= INDENT node_definition

node_definition ::=
    | comment_node
    | component_instance
    | property_assignment
    | property_binding_left
    | property_binding_bidirectional
    | property_binding_right
    | list_property
    | dict_property

(* ========== КОММЕНТАРИИ ========== *)

comment_node ::= "-" text NEWLINE property_list?

(* ========== ЭКЗЕМПЛЯРЫ КОМПОНЕНТОВ ========== *)

component_instance ::=
    | instance_with_arrow
    | instance_direct

instance_with_arrow ::= "<=" identifier component_type NEWLINE property_list?

instance_direct ::= identifier component_type NEWLINE property_list?

component_type ::= "$" identifier

(* ========== ПРИСВАИВАНИЕ СВОЙСТВ ========== *)

property_assignment ::= property_name value NEWLINE property_list?

property_name ::=
    | identifier
    | identifier "?"
    | identifier "?" identifier
    | identifier "!"  identifier  (* legacy multi-property *)
    | identifier "*"              (* multi-property *)
    | identifier "*" identifier   (* multi-property with key *)

(* ========== ОПЕРАТОРЫ СВЯЗЫВАНИЯ ========== *)

(* Левостороннее связывание (родитель -> дочерний) *)
property_binding_left ::=
    property_name "<=" reference_property (value)? NEWLINE property_list?

(* Двустороннее связывание (родитель <-> дочерний) *)
property_binding_bidirectional ::=
    mutable_property "<=>" mutable_property (value)? NEWLINE property_list?

(* Правостороннее связывание (дочерний -> родитель) *)
property_binding_right ::=
    property_name "=>" reference_property NEWLINE property_list?

mutable_property ::= identifier "?" identifier?

reference_property ::= identifier ("?" identifier?)?

(* ========== СПИСКИ И МАССИВЫ ========== *)

list_property ::= property_name "/" type_annotation? NEWLINE list_items?

list_items ::= (INDENT list_item)*

list_item ::=
    | value NEWLINE
    | component_instance
    | property_binding_left
    | property_binding_bidirectional

type_annotation ::=
    | component_type     (* /$mol_view *)
    | "string"           (* /string *)
    | "number"           (* /number *)
    | "boolean"          (* /boolean *)
    | identifier         (* /custom_type *)

(* ========== СЛОВАРИ И ОБЪЕКТЫ ========== *)

dict_property ::= property_name "*" NEWLINE dict_items?

dict_items ::= (INDENT dict_item)*

dict_item ::=
    | "^" NEWLINE                           (* наследование от родителя *)
    | identifier value? NEWLINE property_list?

(* ========== ЗНАЧЕНИЯ И ЛИТЕРАЛЫ ========== *)

value ::=
    | string_literal
    | localized_string
    | number_literal
    | boolean_literal
    | null_literal
    | component_type

(* Строковые литералы *)
string_literal ::= "\\" text_until_eol

text_until_eol ::= [^\n\r]*

(* Локализованные строки *)
localized_string ::= "@" string_literal

(* Числовые литералы *)
number_literal ::=
    | integer
    | float
    | special_number

integer ::= "-"? digit+

float ::= "-"? digit+ "." digit+

special_number ::= "NaN" | "Infinity" | "-Infinity"

digit ::= "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

(* Логические значения *)
boolean_literal ::= "true" | "false"

(* Null *)
null_literal ::= "null"

(* ========== ИДЕНТИФИКАТОРЫ И ИМЕНА ========== *)

identifier ::= identifier_start identifier_continue*

identifier_start ::= letter | "_"

identifier_continue ::= letter | digit | "_"

letter ::= "a".."z" | "A".."Z"

(* ========== ОТСТУПЫ И ФОРМАТИРОВАНИЕ ========== *)

INDENT ::= TAB+

TAB ::= "\t"

NEWLINE ::= "\n" | "\r\n"

(* ========== СПЕЦИАЛЬНЫЕ КОНСТРУКЦИИ ========== *)

(* Многострочные строки *)
multiline_string ::= (INDENT string_literal NEWLINE)+

(* Пустая строка *)
empty_string ::= "\\"

(* Полное имя свойства с параметрами *)
full_property_name ::=
    | identifier                    (* простое свойство *)
    | identifier "?" identifier?    (* мутабельное свойство *)
    | identifier "!" identifier     (* мульти-свойство (legacy) *)
    | identifier "*" identifier?    (* мульти-свойство *)

(* ========== ДОПОЛНИТЕЛЬНЫЕ ПРАВИЛА ========== *)

(* Компактная нотация (значение на той же строке) *)
inline_property ::= property_name value NEWLINE

(* Развернутая нотация (значение на следующей строке с отступом) *)
block_property ::= property_name NEWLINE (INDENT value NEWLINE)+

(* Комбинированные конструкции *)
property_with_component ::=
    property_name component_type NEWLINE property_list?

instance_property ::=
    "<=" identifier component_type NEWLINE property_list?

(* ========== ПАТТЕРНЫ ИСПОЛЬЗОВАНИЯ ========== *)

(* Базовая структура компонента *)
basic_component ::=
    component_declaration
    (INDENT simple_property)*

simple_property ::=
    | identifier value NEWLINE
    | identifier NEWLINE (INDENT value NEWLINE)

(* Компонент со списком дочерних элементов *)
component_with_children ::=
    component_declaration
    INDENT "sub" "/" NEWLINE
    (INDENT INDENT component_instance)*

(* Связывание свойств родитель-потомок *)
parent_child_binding ::=
    INDENT "<=" identifier component_type NEWLINE
    INDENT INDENT property_name "<=" reference_property NEWLINE

(* Двустороннее связывание для форм ввода *)
form_input_binding ::=
    INDENT "<=" identifier "$mol_string" NEWLINE
    INDENT INDENT "value?" "<=>" "name?" "\\" NEWLINE
```

## Детальное описание элементов

### Компоненты

**Объявление компонента:**

```
$my_component $base_component
```

- Имя компонента начинается с `$`
- Базовый компонент также начинается с `$`
- Каждый компонент наследуется от другого компонента
- Базовый компонент: `$mol_view`

### Операторы связывания

| Оператор | Название       | Направление данных   | Описание                                            |
| -------- | -------------- | -------------------- | --------------------------------------------------- |
| `<=`     | Левостороннее  | Родитель → Дочерний  | Односторонняя передача данных от родителя к потомку |
| `<=>`    | Двустороннее   | Родитель ↔ Дочерний | Двусторонний обмен данными                          |
| `=>`     | Правостороннее | Дочерний → Родитель  | Односторонняя передача данных от потомка к родителю |

### Специальные маркеры

| Символ | Название                 | Назначение                                        |
| ------ | ------------------------ | ------------------------------------------------- |
| `$`    | Префикс компонента       | Обозначает имя компонента                         |
| `\`    | Строковый литерал        | Необработанная строка до конца строки             |
| `@`    | Локализация              | Пометка строки для извлечения в файлы локализации |
| `/`    | Список                   | Объявление массива/списка                         |
| `*`    | Словарь                  | Объявление словаря/объекта или мульти-свойства    |
| `?`    | Мутабельность            | Свойство может принимать параметр для изменения   |
| `!`    | Мульти-свойство (legacy) | Старый синтаксис для параметризованных свойств    |
| `-`    | Комментарий              | Отключение узла или комментарий                   |
| `^`    | Наследование             | Наследование атрибутов от родителя                |

### Типы данных

**Примитивные типы:**

```ebnf
primitive_value ::=
    | "\\" text           (* строка *)
    | integer             (* целое число *)
    | float               (* число с плавающей точкой *)
    | "true" | "false"    (* логическое *)
    | "null"              (* null *)
    | "NaN"               (* Not a Number *)
    | "Infinity"          (* бесконечность *)
```

### Списки и типизация

**Объявление списка с типом:**

```
rows /$mol_view
items /string
numbers /number
```

**Список без типа:**

```
sub /
    value1
    value2
```

### Свойства с параметрами

**Мутабельное свойство:**

```
value? \
value?val \
```

**Мульти-свойство:**

```
property* key
item!index          (* legacy *)
```

## Примеры использования

### Пример 1: Простой компонент

```
$my_button $mol_view
    title \Click me!
    enabled true
```

### Пример 2: Компонент со списком

```
$my_list $mol_view
    sub /
        <= Item1
        <= Item2
        <= Item3
```

### Пример 3: Двустороннее связывание

```
$my_form $mol_page
    sub /
        <= Input $mol_string
            hint \Enter name
            value? <=> name? \
```

### Пример 4: Сложный компонент с локализацией

```
$mol_app_users $mol_page
    head /
        <= Filter $mol_string
            hint <= filter_hint @ \Search users on GitHub
            value?val <=> filter_query?val \
    body /
        <= List $mol_list
            rows <= user_rows /$mol_view /
    Foot $mol_row
        sub /
            <= Reload $mol_button_minor
                title <= reload_title @ \Reload
                event_click?val <=> event_reload?val null
            <= Save $mol_button_major
                enabled <= changed false
                title <= save_title @ \Save
                event_click?val <=> event_save?val null
```

### Пример 5: Словарь/атрибуты

```
$mol_card $mol_list
    attr *
        ^
        mol_card_status_type <= status \
```

### Пример 6: Типизированные массивы

```
$my_data $mol_view
    numbers /number
        0
        1.1
        2.5
    items /string
        \Item 1
        \Item 2
    views /$mol_view
        <= View1 $mol_label
        <= View2 $mol_button
```

### Пример 7: Многострочные строки

```
$my_code $mol_textarea
    value? <=> filled_descr?
        \
        \function hello( name = 'World' ) {
        \    return `Hello, ${ name }!`
        \}
```

### Пример 8: Комментарии

```
$my_app $mol_view
    title \My App
    - Временно отключено
    - sub /
        - <= OldComponent
```

## Компиляция в TypeScript

view.tree компилируется в TypeScript классы:

**view.tree:**

```
$my_hello $mol_view
    sub /
        <= Input $mol_string
            value? <=> name? \
        <= message \
```

**Сгенерированный TypeScript:**

```typescript
namespace $ {
	export class $my_hello extends $mol_view {
		sub() {
			return [this.Input(), this.message()] as readonly any[]
		}

		@$mol_mem
		Input() {
			const obj = new this.$.$mol_string()
			obj.value = (val?) => this.name(val)
			return obj
		}

		@$mol_mem
		name(val?, force?) {
			return val !== undefined ? val : ''
		}

		message() {
			return ''
		}
	}
}
```

## Ключевые принципы грамматики

1. **Строгая иерархия**: структура определяется отступами (TAB)
2. **Уникальность имен**: каждый узел имеет уникальное имя в пределах родителя
3. **Визуальная семантика**: операторы (`<=`, `<=>`) показывают направление потока данных
4. **Типобезопасность**: поддержка аннотаций типов для TypeScript
5. **Декларативность**: описывает ЧТО, а не КАК
6. **Реактивность**: автоматическое распространение изменений
7. **Мемоизация**: автоматическое кеширование значений свойств

## Соглашения о файлах

- **Расширение**: `.view.tree`
- **Компилируется в**: `.view.tree.ts`
- **Поведение**: `.view.ts` (для переопределения методов)
- **Стили**: `.view.css`
- **Локализация**: `.locale=en.json`, `.locale=ru.json`

## Приоритет операторов и правила разбора

1. **Отступы** определяют вложенность (наивысший приоритет)
2. **Префиксы** (`$`, `\`, `@`, `-`) определяют тип узла
3. **Операторы связывания** (`<=`, `<=>`, `=>`) определяют отношения
4. **Суффиксы** (`?`, `!`, `*`, `/`) модифицируют свойства
5. **Значения** присваиваются после имени свойства

## Ограничения и особенности

- Обязательно использовать **TAB** для отступов (не пробелы)
- Переносы строк: **LF** (не CRLF)
- Имена компонентов должны быть глобально уникальными
- Свойство может содержать любые JSON-данные вместе с вложенными компонентами
- Компиляция происходит автоматически при изменении файлов
- Поддержка IDE через плагины для VSCode и Zed

---

Эта БНФ грамматика полностью описывает синтаксис языка view.tree, охватывая все конструкции от базовых элементов до сложных паттернов связывания компонентов. Грамматика может быть использована для создания парсеров, валидаторов синтаксиса и инструментов разработки.
