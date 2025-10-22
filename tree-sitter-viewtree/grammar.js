module.exports = grammar({
	name: 'viewtree',

	externals: $ => [$._indent, $._dedent, $._newline],

	conflicts: $ => [[$.property_name, $.node_content], [$.property_node]],

	rules: {
		// Корневая структура файла
		source_file: $ => repeat($._definition),

		// Определение - это только компонент
		_definition: $ => $.component_declaration,

		// Объявление компонента: $name $base
		component_declaration: $ =>
			seq(field('name', $.component_name), field('base', $.component_type), optional($.node_body)),

		// Имя компонента начинается с $
		component_name: $ => /\$[a-zA-Z_][a-zA-Z0-9_]*/,

		// Тип компонента тоже начинается с $
		component_type: $ => /\$[a-zA-Z_][a-zA-Z0-9_]*/,

		// Тело ноды - это блок вложенных нод с отступом
		node_body: $ => seq($._newline, $._indent, repeat1($.node), $._dedent),

		// Нода - это либо комментарий, либо обычное свойство
		node: $ => seq(choice($.comment_node, $.property_node), $._newline),

		// Комментарий начинается с - и идет до конца строки
		comment_node: $ => prec.left(seq('-', optional(/[^\n\r]*/), optional($.node_body))),

		// Обычная нода свойства
		property_node: $ => seq(field('key', $.property_name), optional($.node_content), optional($.node_body)),

		// Имя свойства может быть с разными модификаторами
		property_name: $ =>
			prec.left(
				choice(
					// С стрелкой: <= Name (экземпляр компонента)
					seq('<=', $.identifier),
					// Двунаправленное: value? <=> name?
					seq($.identifier, '?', '<=>', $.identifier, '?'),
					// Однонаправленное слева: value <= name
					seq($.identifier, '<=', $.identifier),
					// Однонаправленное справа: value => name
					seq($.identifier, '=>', $.identifier),
					// С параметром: value?val
					seq($.identifier, '?', $.identifier),
					// Мутабельное: value?
					seq($.identifier, '?'),
					// Мульти-свойство: Wall*
					seq($.identifier, '*'),
					// Простой идентификатор: title
					$.identifier,
				),
			),

		// Содержимое ноды - значение на той же строке
		node_content: $ =>
			choice(
				$.component_type, // $mol_view
				$.string_value, // \text
				$.localized_string, // @ \text
				$.list_marker, // /
				$.dict_marker, // *
				$.number, // 123
				$.boolean, // true/false
				$.null_value, // null
				$.identifier, // простое значение
			),

		// Простой идентификатор
		identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,

		// Строковое значение начинается с \
		string_value: $ => seq('\\', optional(/[^\n\r]*/)),

		// Локализованная строка начинается с @
		localized_string: $ => seq('@', $.string_value),

		// Маркер списка
		list_marker: $ => seq('/', optional(choice($.component_type, /string|number|boolean/))),

		// Маркер словаря
		dict_marker: $ => '*',

		// Число
		number: $ => /-?[0-9]+(\.[0-9]+)?/,

		// Булево значение
		boolean: $ => choice('true', 'false'),

		// Null
		null_value: $ => 'null',
	},
})
