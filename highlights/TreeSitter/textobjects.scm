; Text object queries for vim-like navigation

; Component as a text object
(line
  (token_chain
    (component_name))) @class.outer

; Token chain as a text object
(token_chain) @parameter.inner

; Children block as a text object
(children) @block.outer
