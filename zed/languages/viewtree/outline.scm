; Запрос для структуры кода для molviewtree

; Выделяем объявления компонентов как элементы структуры
((component_declaration) @item)
((component_declaration (identifier)) @title)

; Дополнительно выделяем свойства как элементы структуры
((property) @item)
((property (property_name)) @title)
