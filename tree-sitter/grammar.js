module.exports = grammar({
	name: 'view.tree',

	// только пробелы как "extras", табы/переносы — значимы
	extras: $ => [/ +/],

	conflicts: $ => [[$.property_line, $.subcomponent_line]],

	rules: {
		source_file: $ => repeat(choice($.component_def, $.remark_line, $.blank_line)),

		// базовые токены форматирования
		newline: $ => /\r?\n/,
		indent: $ => /\t+/,
		blank_line: $ => seq(optional($.indent), $.newline),

		// $Name $Base
		component_def: $ =>
			seq(field('name', $.component_name), field('base', $.component_name), $.newline, repeat($.indented_node)),

		// узел с обязательным таб-отступом относительно родителя
		indented_node: $ =>
			seq(
				$.indent,
				choice($.property_line, $.subcomponent_line, $.string_line, $.caret_line, $.remark_line),
				$.newline,
				repeat($.indented_node),
			),

		// идентификаторы
		component_name: $ => token(seq('$', /[A-Za-z_][A-Za-z0-9_]*/)),
		// ключ свойства может быть CSS var или обычный id; допускаем суффиксы * ! ?
		css_var: $ => token(/--[A-Za-z0-9_-]+/),
		ident: $ => /[A-Za-z_$][A-Za-z0-9_$-]*/,
		prop_suffix: $ => /[*!?]+/,
		property_id: $ => token(seq(choice($.css_var, /[A-Za-z_$][A-Za-z0-9_$-]*/), optional($.prop_suffix))),

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
		remark_line: $ => seq('-', /.*/), // комментарий/отключённый узел целиком

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
