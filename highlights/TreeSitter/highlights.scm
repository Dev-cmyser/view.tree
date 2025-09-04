; ==== Компоненты ====
(component_name) @constructor

; ==== Свойства ====
; key: property_id внутри property_line
(property_line
  key: (property_id) @property)

; инлайновые свойства в subcomponent_line
(subcomponent_line
  (property_line
    key: (property_id) @property))

; ==== Операторы биндингов ====
(bind_op) @operator

; правая часть биндинга
(binding_rhs
  (property_id) @variable)
(binding_rhs
  (component_name) @type)
(binding_rhs
  (string_literal) @string)
(binding_rhs
  (number) @number)
(binding_rhs
  (boolean) @constant.builtin)
(binding_rhs
  (null_kw) @constant.builtin)
(dash_end) @punctuation.delimiter

; ==== Литералы / примитивы ====
(string_literal) @string
(number) @number
(boolean) @constant.builtin
(null_kw) @constant.builtin

; ==== Списки / словари / спецстроки ====
(list_marker) @punctuation.special    ; "/"
(dict_marker) @punctuation.special    ; "*"
(typed_list) @constructor             ; "/ $Type" — можно как тип
(caret_line) @punctuation.special     ; "^"

; ==== Локализация (@ \Text) ====
; У тебя @ — часть узла localized_string, отдельного токена нет.
; Красим целиком как "special string":
(localized_string) @string.special

; ==== Идентификаторы ====
(property_id) @variable
(ident) @variable

; ==== Отступы / комментарии ====
(indent) @punctuation.whitespace
(remark_top) @comment
(remark_line) @comment

; ==== Строка подкомпонента: "<= name $Type" ====
(subcomponent_line) @keyword
(subcomponent_line name: (ident) @variable)
(subcomponent_line type: (component_name) @type)
