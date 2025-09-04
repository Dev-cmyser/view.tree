; ===== Компоненты =====
(component_name) @constructor

; ===== Свойства =====
(property_line
  key: (property_id) @property)
(subcomponent_line
  (property_line
    key: (property_id) @property))

; ===== Операторы биндингов =====
(bind_op) @operator
(dash_end) @punctuation.delimiter

; ===== Литералы / примитивы (глобально) =====
(string_literal) @string
(number) @number
(boolean) @constant.builtin
(null_kw) @constant.builtin

; ===== Списки / словари / спецстроки =====
(list_marker) @punctuation.special     ; "/"
(dict_marker) @punctuation.special     ; "*"
(typed_list) @constructor              ; "/ $Type"
(caret_line) @punctuation.special      ; "^"

; ===== Локализация =====
(localized_string) @string.special

; ===== Идентификаторы =====
(property_id) @variable
(ident) @variable

; ===== Отступы / комментарии =====
(indent) @punctuation.whitespace
(remark_top) @comment
(remark_line) @comment

; ===== Подкомпонент: "<= name $Type" =====
(subcomponent_line) @keyword
(subcomponent_line name: (ident) @variable)
(subcomponent_line type: (component_name) @type)
