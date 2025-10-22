; Highlights for view.tree syntax

; Component names (starting with $)
(component_name) @type

; Binding operators
(binding_operator) @operator

; Comment marker
(comment_marker) @comment

; List marker
(list_marker) @punctuation.bracket

; Dictionary markers
(dict_marker) @punctuation.bracket

; Localization marker
(localization_marker) @keyword

; String literals
(string_literal) @string

; Numbers
(number) @number

; Booleans
(boolean) @boolean

; Null
(null) @constant.builtin

; Identifiers (properties, variables)
(identifier) @variable

; Special highlighting for property modifiers
(identifier) @variable.parameter
  (#match? @variable.parameter ".*[?!*]$")
