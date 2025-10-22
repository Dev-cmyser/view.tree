; Highlights for view.tree syntax

; Component names (starting with $)
(component_name) @type

; Binding operators
(binding_operator) @operator

; Comments - recursively apply to all commented content
(commented_line) @comment
(comment_marker) @comment
(comment_content) @comment
(commented_child_line) @comment

; Typed collections
(typed_list) @type.builtin
(typed_dict) @type.builtin

; List marker
(list_marker) @punctuation.bracket

; Dictionary markers
(dict_marker) @punctuation.bracket

; Localized strings (unified token)
(localized_string) @string.special

; String literals
(string_literal) @string

; Numbers
(number) @number

; Booleans
(boolean) @boolean

; Null
(null) @constant.builtin

; Property modifiers (separate tokens)
(property_modifier) @punctuation.special

; Plain identifiers (properties, variables)
(identifier) @variable
