// grammar.js — Tree-sitter grammar for $mol view.tree

module.exports = grammar({
	name: 'view_tree',

	extras: $ => [],

	// Явно подсказали генератору, где возможна неоднозначность
	conflicts: $ => [[$.arrow_property_line, $.node]],

	rules: {
		// ===== Корень =====
		source_file: $ =>
			repeat1(
				choice(
					$.component_decl, // top-level: class class
					$.indented_line, // строка с отступом
					$.top_comment_line, // top-level комментарий: "- ..."
					$.blank_line,
				),
			),

		// Пустая строка (разрешаем и с табами)
		blank_line: $ => seq(optional($.indent), $.newline),

		// ===== Top-level =====

		// Объявление компонента (нулевой отступ): class class
		component_decl: $ => seq($.node_path_component, $.newline),

		node_path_component: $ => seq(alias($.ident, 'class_ident'), $.sep, alias($.ident, 'class_ident')),

		// Комментарий на верхнем уровне
		top_comment_line: $ => seq($.node_path_top_comment, $.newline),

		node_path_top_comment: $ => seq(alias($.special_dash, 'comment_mark'), repeat(seq($.sep, $.node))),

		// ===== Вложенные строки =====
		indented_line: $ =>
			seq(
				$.indent,
				choice(
					$.arrow_property_line, // <= prop [class] ...
					$.property_line, // prop ...
					$.indented_comment_line, // - ...
					$.generic_node_line, // fallback: НЕ ident и НЕ стрелка
				),
				$.newline,
			),

		// Строка со стрелкой в начале
		// prec.right даёт приоритет этому правилу и позволяет "забирать" хвостовые (sep node) без конфликтов
		arrow_property_line: $ =>
			prec.right(
				1,
				seq(
					choice($.arrow_both, $.arrow_left, $.arrow_right),
					optional($.sep),
					alias($.prop_name, 'prop_ident'),
					optional(seq($.sep, alias($.ident, 'class_ident'))),
					repeat(seq($.sep, $.node)),
				),
			),

		// Обычная строка свойства: prop <что-то>
		property_line: $ => seq(alias($.prop_name, 'prop_ident'), repeat1(seq($.sep, $.node))),

		// Комментарий во вложенной строке
		indented_comment_line: $ => seq(alias($.special_dash, 'comment_mark'), repeat(seq($.sep, $.node))),

		// Фолбэк: путь узлов, который НЕ начинается со стрелки и НЕ с идентификатора
		generic_node_line: $ => $.node_path_no_arrow,

		// ===== Общие пути узлов =====
		node_path: $ => seq($.node, repeat(seq($.sep, $.node))),

		node_path_no_arrow: $ => seq($.node_no_arrow, repeat(seq($.sep, $.node))),

		// ===== Узлы =====
		node: $ =>
			choice(
				$.raw_string,

				// стрелки
				$.arrow_both,
				$.arrow_left,
				$.arrow_right,

				// спец-узлы/операторы
				$.special_dash,
				$.special_slash,
				$.special_star,
				$.special_caret,
				$.special_at,
				$.special_qmark,
				$.special_bang,

				// литералы
				$.lit_nan,
				$.lit_pos_infinity,
				$.lit_neg_infinity,
				$.boolean,
				$.null,
				$.number,

				// идентификаторы
				$.ident_with_suffix, // value?  hue_spread!
				$.ident, // value   $mol_view  Task_row*
			),

		// Узел без стрелок и без идентификатора — для не конфликтного фолбэка
		node_no_arrow: $ =>
			choice(
				$.raw_string,

				// спец-узлы/операторы (БЕЗ стрелок и БЕЗ '-'; дефис — это всегда комментарий в начале строки)
				// $.special_dash,  // ← исключён, чтобы не конфликтовать с indented_comment_line
				$.special_slash,
				$.special_star,
				$.special_caret,
				$.special_at,
				$.special_qmark,
				$.special_bang,

				// литералы
				$.lit_nan,
				$.lit_pos_infinity,
				$.lit_neg_infinity,
				$.boolean,
				$.null,
				$.number,
			),

		// ===== Структура строки =====
		indent: _ => token.immediate(/\t+/), // строго только табы
		sep: _ => token(' '), // ровно один пробел между узлами
		newline: _ => token('\n'), // обязательно \n на конце

		// ===== Стрелки (порядок важен) =====
		arrow_both: _ => token('<=>'),
		arrow_left: _ => token('<='), // после '<=>'
		arrow_right: _ => token('=>'),

		// ===== Спец-узлы/операторы =====
		special_bang: _ => token('!'),
		special_qmark: _ => token('?'),
		special_dash: _ => token('-'),
		special_slash: _ => token('/'),
		special_star: _ => token('*'),
		special_caret: _ => token('^'),
		special_at: _ => token('@'),

		// Суффиксы вплотную для свойств
		bang_immediate: _ => token.immediate('!'),
		qmark_immediate: _ => token.immediate('?'),

		// ===== Идентификаторы =====
		ident: _ => token(seq(/[\$A-Za-z_][\w\.\$]*/, optional('*'))),

		ident_with_suffix: $ => seq($.ident, choice($.qmark_immediate, $.bang_immediate)),

		prop_name: $ => choice($.ident_with_suffix, $.ident),

		// ===== Литералы =====
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

		// ===== Сырая строка =====
		raw_string: _ => token(seq('\\', /[^\n]*/)),
	},
})
