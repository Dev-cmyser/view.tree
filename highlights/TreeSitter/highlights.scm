;; queries/highlights.scm — view_tree

;; ===== БАЗА =====
(sep) @punctuation.delimiter
(newline) @punctuation.delimiter
(indent) @punctuation.whitespace

;; Операторы/стрелки (через node-обёртку)
(node (arrow_left))  @operator
(node (arrow_right)) @operator
(node (arrow_both))  @operator

(node (special_slash)) @operator   ; /
(node (special_star))  @operator   ; *
(node (special_caret)) @operator   ; ^
(node (special_at))    @operator   ; @
(node (special_dash))  @comment    ; -
(node (special_qmark)) @operator   ; ?
(node (special_bang))  @operator   ; !

;; ===== ИДЕНТИФИКАТОРЫ =====

;; ident с «вплотную» суффиксом ?/!
(node
  (ident_with_suffix
    (ident) @property))
;; Подсветить сам суффикс как оператор:
(ident_with_suffix (qmark_immediate) @operator)
(ident_with_suffix (bang_immediate)  @operator)

;; обычный идентификатор
(node
  (ident) @property)

;; 1-я пара узлов строки: локальный класс и базовый класс
(line
  (node_path
    (node (ident) @type)
    (sep)
    (node (ident) @type)))

;; $-классы как builtins
(node
  (ident) @type.builtin
  (#match? @type.builtin "^\\$"))

;; мультиплексные имена со звёздой на конце
(node
  (ident) @property.special
  (#match? @property.special ".*\\*$"))

;; ===== ЛИТЕРАЛЫ =====
(node (boolean))          @boolean
(node (null))             @constant.builtin
(node (lit_nan))          @constant.builtin
(node (lit_pos_infinity)) @constant.builtin
(node (lit_neg_infinity)) @constant.builtin
(node (number))           @number

;; ===== СТРОКИ =====
(node (raw_string)) @string

;; локализуемые строки: @ \text
(line
  (node_path
    (node (special_at))
    (sep)?
    (node (raw_string) @string.special)))

;; ===== КОММЕНТАРИИ =====
(line
  (node_path
    (node (special_dash)) @comment
    (sep)?
    (node (raw_string)) @comment))

(line
  (node_path
    (node (special_dash))
    (sep)?
    (node (ident)) @comment))
