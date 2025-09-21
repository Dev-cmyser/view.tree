; ===== Компоненты (верхние строки вида: Ident [$Base]) =====
; bog_horrorgamelanding_card $mol_link
(line
  (node_path
    (ident) @constructor
    (sep)
    (ident) @type))
; Вариант без родителя: просто помечаем имя компонента как конструктор
(line
  (node_path
    (ident) @constructor))

; ===== Свойства (любой отступ + первый узел ident) =====
;     sub /
;     name
(line
  (indent)
  (node_path
    (ident) @property))

; Свойство внутри подкомпонента (строка с двумя+ табами также поймается правилом выше)

; ===== Операторы биндингов =====
(arrow_both) @operator         ; <=>
(arrow_left) @operator         ; <=
(arrow_right) @operator        ; =>

; ===== Спецсимволы-структуры =====
(special_slash) @punctuation.special   ; "/"
(special_star) @punctuation.special    ; "*"
(special_caret) @punctuation.special   ; "^"

; ===== Локализация: "@ \строка" =====
(line
  (node_path
    (special_at)
    (raw_string) @string.special))

; ===== Сырые строки =====
(raw_string) @string

; ===== Числа / булевы / null / спец-числа =====
; всё это — узлы типа (ident), выделяем предикатами
; Boolean
(ident) @constant.builtin
  (#match? @constant.builtin "^(true|false)$")

; null
(ident) @constant.builtin
  (#match? @constant.builtin "^null$")

; NaN / Infinity
(ident) @number
  (#match? @number "^(NaN|[+-]?Infinity)$")

; обычные числа (целые/десятичные со знаком)
(ident) @number
  (#match? @number "^[+-]?[0-9]+(\\.[0-9]+)?$")

; ===== Идентификаторы по умолчанию =====
(ident) @variable

; ===== Отступы / комментарии / разделители =====
(indent) @punctuation.whitespace

; Комментарии: строка, где первый узел — "-"
(line
  (node_path
    (special_dash) @comment
    . (_)*))         ; всё остальное в строке тоже считаем комментарием

; одиночный "-" как коммент-узел
(special_dash) @comment

; В качестве «разделителя» по желанию можно подсветить конец строки после '-'
; (нет отдельного узла dash_end в v1, поэтому опускаем)

; ===== Подкомпонент: "<= name $Type" =====
;     <= image $mol_image
(line
  (indent)
  (node_path
    (arrow_left) @keyword
    (sep)?
    (ident) @variable
    (sep)
    (ident) @type))

; Вариант с двунаправленной связью свойства: "uri <=> card_url"
;     uri <=> card_url
(line
  (indent)
  (node_path
    (ident) @property
    (sep)
    (arrow_both) @operator
    (sep)
    (ident) @variable))
