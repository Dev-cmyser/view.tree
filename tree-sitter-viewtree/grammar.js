/**
 * @file view.tree grammar for tree-sitter
 * @author Generated for $mol framework
 * @license MIT
 * @see {@link https://github.com/hyoo-ru/$mol/tree/master/view.tree|view.tree documentation}
 */

const PREC = {
	component: 3,
	raw_line: 2,
	comment_node: 2,
	node: 1,
}

module.exports = grammar({
	name: 'viewtree',

	extras: $ => [$.comment, /[ \t]/],

	externals: $ => [
		$._newline,
		$._indent,
		$._dedent,
		$._eqindent,
		// Add comment to externals so scanner is always invoked
		$.comment,
	],

	conflicts: $ => [[$.node]],

	rules: {
		// ========== ОСНОВНАЯ СТРУКТУРА ==========

		source_file: $ => repeat(choice($.blank, $.component)),

		blank: $ => $._newline,

		// ========== КОМПОНЕНТЫ ==========

		component: $ =>
			seq(
				field('name', $.component_name),
				field('base', $.component_name),
				$._newline,
				optional($.property_list),
			),

		component_name: _ => /\$[a-zA-Z_][a-zA-Z0-9_]*/,

		property_list: $ => seq($._indent, repeat1(choice($.blank, $.comment_line, $.node, $.raw_line)), $._dedent),

		// Комментарий: "- " + текст до конца строки
		comment_line: $ => prec(PREC.comment_node, seq('-', $.comment_text, $._newline)),

		comment_text: _ => token(seq(' ', /.*/)),

		inline_value: $ => prec.right(repeat1($.value)),

		value: $ =>
			choice($.raw_string, $.localized_string, $.number, $.boolean, $.null, $.special_number, $.component_name),

		localized_string: $ => seq('@', $.raw_string),

		// ========== УЗЛЫ (СВОЙСТВА) ==========

		node: $ => prec(PREC.node, seq(field('path', $.node_path), $._newline, optional($.property_list))),

		raw_line: $ => prec(PREC.raw_line, seq(field('raw', $.raw_string), $._newline)),

		node_path: $ => seq($.path_element, optional(seq(' ', $.node_path))),

		// ========== ЭЛЕМЕНТЫ ПУТИ ==========

		path_element: $ =>
			choice(
				// Операторы (должны быть раньше для приоритета)
				$.arrow_both,
				$.arrow_left,
				$.arrow_right,
				$.op_dash,
				$.op_at,
				$.op_caret,

				// Специальные конструкции для списков и словарей
				$.typed_list,
				$.op_slash,
				$.op_star,

				// Литералы
				$.raw_string,
				$.boolean,
				$.null,
				$.special_number,
				$.number,

				// Идентификаторы (последними для правильного приоритета)
				$.component_name,
				$.property_identifier,
			),

		// ========== ОПЕРАТОРЫ ==========

		arrow_both: _ => '<=>',
		arrow_left: _ => '<=',
		arrow_right: _ => '=>',
		op_dash: _ => '-',
		op_slash: _ => '/',
		op_star: _ => '*',
		op_caret: _ => '^',
		op_at: _ => '@',

		// ========== ТИПИЗИРОВАННЫЕ СПИСКИ ==========

		typed_list: $ => seq('/', choice($.component_name, $.type_name)),

		type_name: _ => /string|number|boolean/,

		// ========== ЛИТЕРАЛЫ ==========

		raw_string: _ => token(seq('\\', /[^\n]*/)),

		boolean: _ => choice('true', 'false'),

		null: _ => 'null',

		special_number: _ => choice('NaN', 'Infinity', seq('-', 'Infinity')),

		number: _ =>
			token(
				seq(
					optional(choice('+', '-')),
					choice(seq(/[0-9]+/, '.', optional(/[0-9]+/)), seq('.', /[0-9]+/), /[0-9]+/),
					optional(seq(/[eE]/, optional(choice('+', '-')), /[0-9]+/)),
				),
			),

		// ========== ИДЕНТИФИКАТОРЫ ==========

		property_identifier: _ => {
			const base = /[a-zA-Z_][a-zA-Z0-9_]*/
			const suffix = /[?!*]+/ // Один или несколько суффиксов: ?, !, *
			const param = /[a-zA-Z0-9_]+/

			return token(
				seq(
					base,
					optional(
						choice(
							suffix, // prop?, prop*, prop*?, prop?*, prop!?, и т.д.
							seq(suffix, param), // prop?name, prop*key, и т.д.
						),
					),
				),
			)
		},

		// ========== КОММЕНТАРИИ ==========

		comment: _ => token(seq('#', /.*/)),
	},
})
