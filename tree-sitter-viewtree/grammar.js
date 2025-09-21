// grammar.js — view.tree: тело = нода, рекурсивная вложенность по табам, БЕЗ узла 'suite'.
// Нужен external scanner ($._newline, $._indent, $._dedent).

module.exports = grammar({
	name: 'viewtree',

	extras: $ => [],

	externals: $ => [
		$._newline, // \n (включая финальный)
		$._indent, // шаг вверх по \t
		$._dedent, // шаг вниз (сериями)
	],

	rules: {
		// Корень: пустые строки или ноды
		source_file: $ => repeat1(choice($.blank, $.node)),

		blank: $ => $._newline,

		// Нода: голова + \n + (опц.) вложенные строки (ноды или "сырые" строки)
		node: $ =>
			seq(
				field('head', $.node_path),
				$._newline,
				optional(seq($._indent, repeat1(choice($.blank, $.node, $.raw_line)), $._dedent)),
			),

		// "Сырая" строка-тело (как нода): только raw_string + \n + (опц.) вложенный блок
		raw_line: $ =>
			seq(
				field('raw', $.raw_string),
				$._newline,
				optional(seq($._indent, repeat1(choice($.blank, $.node, $.raw_line)), $._dedent)),
			),

		// Голова ноды: атомы, разделённые РОВНО одним пробелом
		node_path: $ => seq($.atom, repeat(seq($.sep, $.atom))),

		sep: _ => token(' '), // ровно один пробел

		// Атом
		atom: $ =>
			choice(
				$.raw_string,

				// стрелки (порядок важен)
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

				// идентификатор с суффиксами (*key, ?, !, *?)
				$.ident,
			),

		// --- маркеры ---
		op_dash: _ => token('-'),
		op_slash: _ => token('/'),
		op_star: _ => token('*'),
		op_caret: _ => token('^'),
		op_at: _ => token('@'),

		// --- стрелки ---
		arrow_both: _ => token('<=>'),
		arrow_left: _ => token('<='), // после '<=>'
		arrow_right: _ => token('=>'),

		// --- сырая строка: '\' + всё до конца строки (LF отдаёт $._newline) ---
		raw_string: _ => token(seq('\\', /[^\n]*/)),

		// --- литералы ---
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

		// --- идентификатор с суффиксами ---
		// NAME_CORE := [ $ A-Za-z _ ] [ \w . $ ]*
		// KEY_TAIL  := [ \w - . : $ ]+
		// IDENT     := NAME_CORE ( ('*' KEY_TAIL?)? ( '?' | '!' )? )
		ident: _ =>
			token(
				seq(/[\$A-Za-z_][\w\.\$]*/, optional(seq('*', optional(/[\w\-\.\:\$]+/))), optional(choice('?', '!'))),
			),
	},
})
