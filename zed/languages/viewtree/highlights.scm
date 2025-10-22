;; 1) Highlight the component name (the '$foo' part) as a type
((component_name) @type)

;; 2) Highlight the entire component declaration line as a keyword,
;;    and its child identifier as a constructor (or type if you prefer)
((component_declaration) @keyword)
((component_declaration (identifier)) @constructor)

;; 3) Highlight normal identifiers as variables (instead of constructor)
((identifier) @variable)

;; 4) Highlight property names and property blocks
((property_name) @property)
((property) @property)

;; 5) Highlight binding operators (<=, =>, <=>)
((binding) @operator)

;; 6) Highlight string literals as strings
((string_literal) @string)
((localization_string) @string.special)

;; 7) Special punctuation captures
((list_marker) @punctuation.list_marker)
((dict_marker) @punctuation.special)
((parameter) @punctuation.special)
((caret) @punctuation.special)
((css_variable) @punctuation.special)

;; 8) Numbers, booleans, null => constants
((primitive_literal) @variant)
; ((primitive_literal) @variable.special)

;((null_value) @constant)

;; 9) If you want to highlight tabs as punctuation (optional)
((indent) @punctuation)
