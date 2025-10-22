module.exports = grammar({
	name: 'viewtree',

	externals: $ => [
		$._indent,
		$._dedent,
		$._newline,
	],

	extras: $ => ['\t'],

	rules: {
		source_file: $ => repeat($.line),

		line: $ => seq(
			$.token_chain,
			$._newline,
			optional($.children)
		),

		children: $ => seq(
			$._indent,
			repeat1($.line),
			$._dedent
		),

		// Цепочка токенов - каждый токен вложен в предыдущий
		token_chain: $ => seq(
			$._token,
			optional(seq(' ', $.token_chain))
		),

		// Токены с распознаванием специальных символов
		_token: $ => choice(
			$.component_name,
			$.binding_operator,
			$.comment_marker,
			$.list_marker,
			$.dict_marker,
			$.localization_marker,
			$.string_literal,
			$.number,
			$.boolean,
			$.null,
			$.identifier,
		),

		// Имя компонента начинается с $
		component_name: $ => /\$[a-zA-Z_][a-zA-Z0-9_]*/,

		// Операторы связывания
		binding_operator: $ => choice('<=>', '<=', '=>'),

		// Маркер комментария
		comment_marker: $ => '-',

		// Маркер списка
		list_marker: $ => '/',

		// Маркер словаря
		dict_marker: $ => choice('*', '^'),

		// Маркер локализации
		localization_marker: $ => '@',

		// Строковый литерал (все после \)
		string_literal: $ => /\\[^\n\r]*/,

		// Числа
		number: $ => choice(
			/[+-]?\d+\.\d+/,  // float
			/[+-]?\d+/,       // integer
			'NaN',
			'Infinity',
			'-Infinity'
		),

		// Булевы значения
		boolean: $ => choice('true', 'false'),

		// Null
		null: $ => 'null',

		// Идентификатор (может включать модификаторы ?, !, *)
		identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*[?!*]?/,
	}
})
