; Tags for symbol navigation (ctags-like)

; Component definitions
(line
  (token_chain
    (component_name) @name) @definition.class
  (#set! "kind" "Component"))

; Property definitions
(line
  (token_chain
    (identifier) @name
    (token_chain)) @definition.property
  (#set! "kind" "Property"))

; Instance definitions (with <=)
(line
  (token_chain
    (binding_operator)
    (token_chain
      (identifier) @name)) @definition.instance
  (#set! "kind" "Instance"))
