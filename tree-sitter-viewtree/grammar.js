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

	externals: $ => [$._newline, $._indent, $._dedent, $._eqindent],

	conflicts: $ => [[$.special_number]],

	rules: {
		// ========== ОСНОВНАЯ СТРУКТУРА ==========

		source_file: $ => repeat(choice($.blank, $.component)),

		blank: $ => $._newline,

		// ========== КОМПОНЕНТЫ ==========

		component: $ =>
			prec(
				PREC.component,
				seq(
					field('name', $.component_name),
					field('base', $.component_name),
					$._newline,
					optional($.property_list),
				),
			),

		component_name: _ => /\$[a-zA-Z_][a-zA-Z0-9_]*/,

		property_list: $ =>
			seq(
				$._indent,
				repeat1(
					choice(
						$.blank,
						seq(optional($._eqindent), $.comment_node),
						seq(optional($._eqindent), $.node),
						seq(optional($._eqindent), $.raw_line),
					),
				),
				$._dedent,
			),

		comment_node: $ =>
			prec.dynamic(
				10,
				prec.right(PREC.comment_node, seq('-', optional($.inline_value), optional($.property_list))),
			),

		inline_value: $ => prec.right(repeat1($.value)),

		value: $ =>
			choice($.raw_string, $.localized_string, $.number, $.boolean, $.null, $.special_number, $.component_name),

		localized_string: $ => seq('@', $.raw_string),

		// ========== УЗЛЫ (СВОЙСТВА) ==========

		node: $ => prec(PREC.node, seq(field('path', $.node_path), $._newline, optional($.property_list))),

		raw_line: $ => prec(PREC.raw_line, seq(field('raw', $.raw_string), $._newline)),

		node_path: $ => seq($.path_element, repeat(seq(' ', $.path_element))),

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
			const suffix = choice('?', '!', '*')
			const param = /[a-zA-Z0-9_]+/

			return token(seq(base, optional(choice(suffix, seq(suffix, param)))))
		},

		// ========== КОММЕНТАРИИ ==========

		comment: _ => token(seq('#', /.*/)),
	},
})
