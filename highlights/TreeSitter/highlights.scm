; ===== Компоненты =====
(component_name) @constructor
(component_def name: (component_name) @type)
(component_def base: (component_name) @type.builtin)

; ===== Свойства =====
(property_line
  key: (property_id) @property)
(property_id (prop_suffix) @operator) ; ! ? * помечаем как оператор/модификатор
(subcomponent_line
  (property_line
    key: (property_id) @property))

; ===== Операторы биндингов =====
(bind_op) @operator
(dash_end) @punctuation.delimiter

; ===== Литералы / примитивы =====
(string_literal) @string
(string_line) @string
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
