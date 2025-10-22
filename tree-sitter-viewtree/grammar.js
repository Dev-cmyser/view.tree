module.exports = grammar({
	name: 'viewtree',

	externals: $ => [$._indent, $._dedent, $._newline],

	extras: $ => ['\t'],

	rules: {
		source_file: $ => repeat($.line),

		line: $ => choice($.commented_line, $.normal_line),

		// Закомментированная строка - всё после '-' до конца строки
		commented_line: $ =>
			seq($.comment_marker, optional($.comment_content), $._newline, optional($.commented_children)),

		// Содержимое комментария - любой текст до конца строки
		comment_content: $ => /[^\n\r]+/,

		// Дети закомментированной строки - любые строки становятся закомментированными
		commented_children: $ => seq($._indent, repeat1($.commented_child_line), $._dedent),

		// Закомментированная дочерняя строка - любой текст
		commented_child_line: $ => seq(optional(/[^\n\r]+/), $._newline, optional($.commented_children)),

		// Обычная строка
		normal_line: $ => seq($.token_chain, $._newline, optional($.children)),

		children: $ => seq($._indent, repeat1($.line), $._dedent),

		// Цепочка токенов - каждый токен вложен в предыдущий
		token_chain: $ => seq($._token, optional(seq(' ', $.token_chain))),

		// Токены с распознаванием специальных символов
		_token: $ =>
			choice(
				$.component_name,
				$.binding_operator,
				$.typed_list,
				$.typed_dict,
				$.list_marker,
				$.dict_marker,
				$.localized_string,
				$.string_literal,
				$.number,
				$.boolean,
				$.null,
				$.identifier_with_modifier,
				$.identifier,
			),

		// Имя компонента начинается с $
		component_name: $ => /\$[a-zA-Z_][a-zA-Z0-9_]*/,

		// Операторы связывания
		binding_operator: $ => choice('<=>', '<=', '=>'),

		// Маркер комментария
		comment_marker: $ => '-',

		// Типизированный список - /Type
		typed_list: $ => seq('/', $.component_name),

		// Типизированный словарь - *Type или ^Type
		typed_dict: $ => seq(choice('*', '^'), $.component_name),

		// Маркер списка
		list_marker: $ => '/',

		// Маркер словаря
		dict_marker: $ => choice('*', '^'),

		// Локализованная строка - @ и строка вместе
		localized_string: $ => seq('@', ' ', $.string_literal),

		// Строковый литерал
		string_literal: $ => /\\[^\n\r]*/,

		// Идентификатор с модификатором
		identifier_with_modifier: $ => seq($.identifier, $.property_modifier),

		// Модификатор свойства
		property_modifier: $ => choice('?', '!', '*'),

		// Идентификатор
		identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,

		// Числа
		number: $ => choice(/[+-]?\d+\.\d+/, /[+-]?\d+/, 'NaN', 'Infinity', '-Infinity'),

		// Булевы значения
		boolean: $ => choice('true', 'false'),

		// Null
		null: $ => 'null',
	},
})
