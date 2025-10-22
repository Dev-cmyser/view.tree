; Local variable scopes

; Component definitions introduce a scope
(line
  (token_chain
    (component_name) @local.definition))

; Property bindings reference variables
(identifier) @local.reference
