module.exports = grammar({
	name: 'viewtree',
	extras: $ => [],

	externals: $ => [
		$._newline,
		$._indent,
		$._dedent,
		$._eqindent, // ← новый внешний токен
	],

	rules: {
		source_file: $ => repeat1(choice($.blank, $.node)),
		blank: $ => $._newline,

		node: $ =>
			seq(
				field('head', $.node_path),
				$._newline,
				optional(
					seq(
						$._indent,
						repeat1(
							choice(
								$.blank,
								seq(optional($._eqindent), $.node), // ← тут
								seq(optional($._eqindent), $.raw_line), // ← и тут
							),
						),
						$._dedent,
					),
				),
			),

		// УДАЛИ это:
		// eqindent: _ => token.immediate(/\t+/),

		raw_line: $ => seq(field('raw', $.raw_string), $._newline),

		node_path: $ => seq($.head_atom, repeat(seq($.sep, $.atom))),
		sep: _ => token(' '),

		head_atom: $ =>
			choice(
				$.arrow_both,
				$.arrow_left,
				$.arrow_right,
				$.op_dash,
				$.op_slash,
				$.op_star,
				$.op_caret,
				$.op_at,
				$.boolean,
				$.null,
				$.lit_nan,
				$.lit_pos_infinity,
				$.lit_neg_infinity,
				$.number,
				$.ident,
			),

		atom: $ =>
			choice(
				$.raw_string,
				$.arrow_both,
				$.arrow_left,
				$.arrow_right,
				// важно: длинный токен раньше короткого, чтобы '/string' не раскалывался
				$.slash_ident,
				$.op_slash,
				$.op_dash,
				$.op_star,
				$.op_caret,
				$.op_at,
				$.boolean,
				$.null,
				$.lit_nan,
				$.lit_pos_infinity,
				$.lit_neg_infinity,
				$.number,
				$.ident,
			),

		slash_ident: _ => token(seq('/', /[^\s\/\\<>\-\*\^@=\?\!][^\s\/\\<>\-\*\^@=\?\!]*/)),

		op_dash: _ => token('-'),
		op_slash: _ => token('/'),
		op_star: _ => token('*'),
		op_caret: _ => token('^'),
		op_at: _ => token('@'),

		arrow_both: _ => token('<=>'),
		arrow_left: _ => token('<='),
		arrow_right: _ => token('=>'),

		raw_string: _ => token(seq('\\', /[^\n]*/)),

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

		ident: _ =>
			token(
				seq(
					/[^\s\/\\<>\-\*\^@=\?\!][^\s\/\\<>\-\*\^@=\?\!]*/,
					optional(seq('*', optional(/[\w\-\.\:\$]+/))),
					optional(choice('?', '!')),
				),
			),
	},
})
