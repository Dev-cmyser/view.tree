module.exports = grammar({
	name: 'viewtree', // ВАЖНО: без подчеркивания → префикс tree_sitter_viewtree_*

	extras: $ => [],

	rules: {
		source_file: $ => repeat1(choice($.blank, $.line)),

		blank: $ => $._newline,

		// Любая строка: node_path + newline + опциональный suite
		line: $ => seq($.node_path, $._newline, optional($.suite)),

		// Вложенный блок: INDENT (>=1 строка/пустая строка) DEDENT
		suite: $ => seq($._indent, repeat1(choice($.blank, $.line)), $._dedent),

		// Узлы в строке, разделённые РОВНО одним пробелом
		node_path: $ => seq($.node, repeat(seq($.sep, $.node))),

		sep: _ => token(' '),

		node: $ =>
			choice(
				$.raw_string,

				// стрелки
				$.arrow_both,
				$.arrow_left,
				$.arrow_right,

				// односимвольные маркеры
				$.op_dash, // -
				$.op_slash, // /
				$.op_star, // *
				$.op_caret, // ^
				$.op_at, // @

				// литералы
				$.boolean,
				$.null,
				$.lit_nan,
				$.lit_pos_infinity,
				$.lit_neg_infinity,
				$.number,

				// идентификатор (имена/свойства/фабрики/мульти/мутабельные)
				$.ident,
			),

		// --- односимвольные
		op_dash: _ => token('-'),
		op_slash: _ => token('/'),
		op_star: _ => token('*'),
		op_caret: _ => token('^'),
		op_at: _ => token('@'),

		// --- стрелки (порядок важен)
		arrow_both: _ => token('<=>'),
		arrow_left: _ => token('<='), // после '<=>'
		arrow_right: _ => token('=>'),

		// --- сырая строка: '\' + всё до \n
		raw_string: _ => token(seq('\\', /[^\n]*/)),

		// --- литералы
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

		// IDENT:
		// NAME_CORE := [ $ A-Za-z _ ] [ \w . $ ]*
		// KEY_TAIL  := [ \w - . : $ ]+
		// суффиксы: *KEY?  (где KEY опционален), затем ? или ! (опционально)
		// также допустим комбинированный *? (т.е. * + ? без KEY)
		ident: _ =>
			token(
				seq(/[\$A-Za-z_][\w\.\$]*/, optional(seq('*', optional(/[\w\-\.\:\$]+/))), optional(choice('?', '!'))),
			),
	},
})
