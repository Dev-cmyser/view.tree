
;; queries/highlights.scm — view_tree (robust)

;; базовые разделители/отступы
(newline) @punctuation.delimiter
(indent)  @punctuation.whitespace

;; ===== классы/свойства =====

;; top-level объявление: первые два узла — классы (между ними стоит sep, его не матчим)
(component_decl
  (node_path_component
    (_) @type))

;; свойства: первый узел в property_line
(indented_line
  (property_line
    (_) @property))

;; стрелочная строка: после стрелки — свойство
(indented_line
  (arrow_property_line
    (arrow_left)  @operator
    (_)           @property))
(indented_line
  (arrow_property_line
    (arrow_right) @operator
    (_)           @property))
(indented_line
  (arrow_property_line
    (arrow_both)  @operator
    (_)           @property))

;; опциональный класс после свойства в стрелочной строке: ..., <prop> <maybe sep> <class>
(indented_line
  (arrow_property_line
    (_)
    (_)?   ; опц. пробел/узел между
    (_) @type))

;; $-классы как builtins (по лексеме)
((_) @type.builtin
  (#match? @type.builtin "^\\$"))

;; мультиплексные имена со звёздой на конце (по лексеме)
((_) @property.special
  (#match? @property.special ".*\\*$"))

;; суффиксы ?/! у свойств (из ident_with_suffix, если есть)
(ident_with_suffix (qmark_immediate) @operator)
(ident_with_suffix (bang_immediate)  @operator)

;; ===== операторы/спец =====
(arrow_left)  @operator
(arrow_right) @operator
(arrow_both)  @operator
(node (arrow_left))  @operator
(node (arrow_right)) @operator
(node (arrow_both))  @operator

(node (special_slash)) @operator   ; /
(node (special_star))  @operator   ; *
(node (special_caret)) @operator   ; ^
(node (special_at))    @operator   ; @
(node (special_qmark)) @operator   ; ?
(node (special_bang))  @operator   ; !

;; ===== литералы =====
(node (boolean))          @boolean
(node (null))             @constant.builtin
(node (lit_nan))          @constant.builtin
(node (lit_pos_infinity)) @constant.builtin
(node (lit_neg_infinity)) @constant.builtin
(node (number))           @number

;; ===== строки =====
(node (raw_string)) @string

;; локализуемые строки: ... @ \text (без явного sep)
(indented_line
  (property_line
    (_)
   (node (raw_string) @string.special)))

;; ===== комментарии =====
(top_comment_line
  (node_path_top_comment
    ))
(top_comment_line
  (node_path_top_comment
    (node) @comment))

(indented_line
  (indented_comment_line
    (node) @comment))
