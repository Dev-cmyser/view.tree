// grammar.js — view.tree: тело = нода, рекурсивная вложенность по табам (без 'suite').
// Нужен external scanner: $._newline, $._indent, $._dedent.

module.exports = grammar({
	name: 'viewtree',

	extras: $ => [],

	externals: $ => [
		$._newline, // LF (включая финальный)
		$._indent, // шаг вверх по количеству \t
		$._dedent, // шаг вниз (сериями)
	],

	rules: {
		// Корень: пустые строки или ноды
		source_file: $ => repeat1(choice($.blank, $.node)),

		blank: $ => $._newline,

		// Нода: head + LF + (опц.) блок детей (ноды или raw_line) между indent/dedent
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
								// ребёнок — нода с равным отступом
								seq(optional($.eqindent), $.node),
								// ребёнок — простая сырая строка с равным отступом
								seq(optional($.eqindent), $.raw_line),
							),
						),
						$._dedent,
					),
				),
			),

		// Равный отступ (съедаем \t на строках того же уровня внутри тела)
		eqindent: _ => token.immediate(/\t+/),

		// Простая "сырая" строка-ребёнок: только \... + LF (без своей вложенности)
		raw_line: $ => seq(field('raw', $.raw_string), $._newline),

		// Голова ноды: первый атом — НЕ raw_string; дальше — любые атомы.
		node_path: $ => seq($.head_atom, repeat(seq($.sep, $.atom))),

		// Ровно один пробел между атомами
		sep: _ => token(' '),

		// Первый атом в строке
		head_atom: $ =>
			choice(
				// стрелки
				$.arrow_both,
				$.arrow_left,
				$.arrow_right,
				// односимвольные маркеры
				$.op_dash,
				$.op_slash,
				$.op_star,
				$.op_caret,
				$.op_at,
				// литералы
				$.boolean,
				$.null,
				$.lit_nan,
				$.lit_pos_infinity,
				$.lit_neg_infinity,
				$.number,
				// идентификатор с суффиксами
				$.ident,
			),

		// Любой последующий атом (разрешаем raw_string)
		atom: $ =>
			choice(
				$.raw_string,
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

		// --- односимвольные ---
		op_dash: _ => token('-'),
		op_slash: _ => token('/'),
		op_star: _ => token('*'),
		op_caret: _ => token('^'),
		op_at: _ => token('@'),

		// --- стрелки ---
		arrow_both: _ => token('<=>'),
		arrow_left: _ => token('<='), // объявлять после '<=>'
		arrow_right: _ => token('=>'),

		// --- сырая строка: '\' до конца строки (LF отдаёт $._newline) ---
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

		// --- идентификатор с суффиксами (*key, ?, !, *?) ---
		// базовая часть — любые «неоператорные» непробельные символы (включая эмодзи),
		// затем опционально: '*' KEY? (KEY: [\w\-.:$]+), затем '?' или '!'
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
