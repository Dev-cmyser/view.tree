module.exports = grammar({
	name: 'viewtree',

	extras: $ => [/ +/],

	rules: {
		source_file: $ =>
			repeat(
				choice(
					$.component_def,
					$.remark_top, // комментарии на верхнем уровне
					$.blank_line, // пустые строки БЕЗ отступа
				),
			),

		// базовые токены форматирования
		newline: $ => /\r?\n/,
		indent: $ => /\t+/,

		// Пустая строка на верхнем уровне: НЕТ indent
		blank_line: $ => $.newline,
		// Верхнеуровневый комментарий (если нужен)
		remark_top: $ => seq('-', /.*/, $.newline),
		// $Name $Base
		component_def: $ =>
			seq(
				field('name', $.component_name),
				field('base', $.component_name),
				$.newline,
				// тело может быть пустым; конфликт уйдёт, т.к. indent не разрешён наверху в blank_line
				repeat($.indented_node),
			),

		// Вложенный узел: начинается с indent, затем содержимое, затем перевод строки,
		// после чего могут идти ещё вложенные узлы
		indented_node: $ =>
			prec.right(
				seq(
					$.indent,
					choice($.property_line, $.subcomponent_line, $.string_line, $.caret_line, $.remark_line),
					$.newline,
					repeat($.indented_node),
				),
			),

		// идентификаторы
		component_name: $ => token(seq('$', /[A-Za-z_][A-Za-z0-9_]*/)),
		ident: $ => token(/[A-Za-z_$][A-Za-z0-9_$-]*/),
		prop_suffix: $ => token.immediate(/[*!?]+/),
		property_id: $ => seq($.ident, optional($.prop_suffix)),

		// литералы
		number: $ => token(/[+\-]?(?:NaN|Infinity|\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/),
		boolean: $ => choice('true', 'false'),
		null_kw: $ => 'null',
		primitive: $ => choice($.number, $.boolean, $.null_kw),

		string_literal: $ => seq('\\', /.*/),
		string_line: $ => seq('\\', /.*/), // строка как отдельный узел (элемент списка и т.п.)

		// списки/словари
		list_marker: $ => '/',
		list_type: $ => choice($.component_name, 'string', 'number', 'boolean', $.ident),
		dict_marker: $ => '*',
		typed_list: $ => seq($.list_marker, optional($.list_type)),

		// специальные строки-узлы
		caret_line: $ => '^', // наследование словаря

		// Вложенный комментарий (начинается сразу после indent)
		remark_line: $ => seq('-', /.*/),

		// локализация: "@ \Text"
		localized_string: $ => seq('@', / +/, $.string_literal),

		// значение свойства без биндинга
		value: $ =>
			choice($.primitive, $.string_literal, $.localized_string, $.component_name, $.typed_list, $.dict_marker),

		// биндинги
		bind_op: $ => choice('<=>', '<=', '=>'),
		// правая часть биндинга: литерал, строка, компонент, или ссылка на свойство (+опц. литерал/типизированный список)
		binding_rhs: $ =>
			choice(
				$.primitive,
				$.string_literal,
				$.component_name,
				seq($.property_id, optional(choice($.primitive, $.string_literal, $.typed_list))),
			),
		dash_end: $ => '-', // хвостовой дефис как заглушка после биндинга

		// property line
		property_line: $ =>
			seq(
				field('key', $.property_id),
				optional(
					choice(
						seq(field('op', $.bind_op), field('rhs', $.binding_rhs), optional($.dash_end)),
						field('value', $.value),
					),
				),
			),

		// "<= Name $Type" (+ любое число инлайн-свойств через пробел)
		subcomponent_line: $ =>
			seq(
				'<=',
				field('name', $.ident),
				field('type', $.component_name),
				repeat(seq(' ', field('inline', $.property_line))),
			),
	},
})
