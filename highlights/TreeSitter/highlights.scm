((component_name) @constructor)

;; property_name — highlight as property
((property_name) @property)

;; binding symbols like <= => <=> — highlight as operator
((binding) @operator)

;; string_literal — highlight as string
((string_literal) @string)

;; localization_marker (@) — highlight as punctuation
((localization_marker) @punctuation.special)

;; / and * — highlight as punctuation too
((list_marker) @punctuation.list_marker)
((dict_marker) @punctuation.special)
((parameter) @punctuation.special)
((caret) @punctuation.special)
((css_variable) @punctuation.special)

;; numbers, booleans, null => highlight as constants
((primitive_literal) @constant)
; ((null_value) @constant)

;; optional: highlight entire component_declaration as keyword
((component_declaration) @keyword)

;; or highlight the (identifier) inside it as a type
((component_declaration (identifier)) @type)

;; highlight property
((property) @property)

;; highlight indent (tabs) as punctuation (optional)
((indent) @punctuation)

;; highlight any standalone identifier
((identifier) @variable)
