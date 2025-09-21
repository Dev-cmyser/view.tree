module.exports = grammar({
	name: 'viewtree',
	extras: $ => [],

	rules: {
		source_file: $ => repeat1(choice($.line, $.blank_line)),
		blank_line: $ => seq(optional($.indent), $.newline),

		line: $ => seq(optional($.indent), $.node_path, $.newline),

		node_path: $ => seq($.node, repeat(seq($.sep, $.node))),

		node: $ =>
			choice(
				$.raw_string,

				// стрелки (порядок важен)
				$.arrow_both,
				$.arrow_left,
				$.arrow_right,

				// идентификатор с суффиксом без пробела: value? / hue_spread!
				$.ident_with_suffix,

				// литералы
				$.lit_nan,
				$.lit_pos_infinity,
				$.lit_neg_infinity,
				$.boolean,
				$.null,
				$.number,

				// одиночные операторы/символы
				$.special_bang, // !
				$.special_qmark, // ?
				$.special_dash, // -
				$.special_slash, // /
				$.special_star, // *
				$.special_caret, // ^
				$.special_at, // @

				// обычный идентификатор
				$.ident,
			),

		// строго табы
		indent: _ => token.immediate(/\t+/),
		sep: _ => token(' '),
		newline: _ => token('\n'),

		// стрелки
		arrow_both: _ => token('<=>'),
		arrow_left: _ => token('<='), // после <=> !
		arrow_right: _ => token('=>'),

		// одиночные операторы (раздельно)
		special_bang: _ => token('!'),
		special_qmark: _ => token('?'),
		special_dash: _ => token('-'),
		special_slash: _ => token('/'),
		special_star: _ => token('*'),
		special_caret: _ => token('^'),
		special_at: _ => token('@'),

		// «вплотную» версии для склейки с идентификатором
		bang_immediate: _ => token.immediate('!'),
		qmark_immediate: _ => token.immediate('?'),

		// идентификатор (допускаем суффикс '*' для мультиплексных свойств)
		ident: _ => token(seq(/[\$A-Za-z_][\w\.\$]*/, optional('*'))),

		// ident + (?|!) без пробела
		ident_with_suffix: $ => seq($.ident, choice($.qmark_immediate, $.bang_immediate)),

		// литералы
		boolean: _ => token(choice('true', 'false')),
		null: _ => token('null'),
		lit_nan: _ => token('NaN'),
		lit_pos_infinity: _ => token('Infinity'),
		lit_neg_infinity: _ => token('-Infinity'),

		number: _ =>
			token(
				seq(
					optional(choice('+', '-')),
					choice(seq(/[0-9]+/, optional(seq('.', /[0-9]+/))), seq('.', /[0-9]+/)),
					optional(seq(/[eE]/, optional(choice('+', '-')), /[0-9]+/)),
				),
			),

		raw_string: _ => token(seq('\\', /[^\n]*/)),
	},
})
