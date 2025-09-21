// grammar.js — Tree-sitter grammar for $mol view.tree
// Strict rules implemented per cheat sheet:
// - Tabs are used for indentation inside blocks
// - Unix newlines (\n) are required; file ends with a newline
// - Single spaces between syntactic items are enforced via explicit 'sp' tokens

module.exports = grammar({
	name: 'viewtree',

	// Do NOT treat spaces/newlines/tabs as extras: we enforce exact spacing.
	extras: $ => [],

	supertypes: $ => [$.value],
	conflicts: $ => [[$.comment]],

	rules: {
		// file := (top '\n')+
		source_file: $ => seq(repeat1(seq($.top, '\n'))),

		top: $ => choice($.component, $.comment),

		// $my_comp ␠ $mol_view (component-level block)?
		component: $ =>
			prec.right(seq(field('name', $.class_ref), $.sp, field('base', $.class_ref), optional($.component_block))),

		// --- Blocks ----------------------------------------------------------

		// A component block is one-or-more indented lines with component statements
		component_block: $ => prec.right(repeat1(seq('\n', repeat1('\t'), $.component_line))),

		// Inside component: property statements or comments
		component_line: $ => choice($.property_stmt, $.comment),

		// Array block: one-or-more indented array items
		array_block: $ => repeat1(seq('\n', repeat1('\t'), $.array_item)),

		// Dict block: one-or-more indented entries/spreads/comments
		dict_block: $ => repeat1(seq('\n', repeat1('\t'), choice($.dict_entry, $.dict_spread, $.comment))),

		// --- Property statement ---------------------------------------------

		// <prop> ␠ (<binding>|<bi_binding>|<export>|<typed_array>|<dict>|<factory_in_place>|<value>)(block?)
		property_stmt: $ =>
			seq(
				field('prop', $.prop_name),
				$.sp,
				choice(
					$.binding_left,
					$.binding_bi,
					$.export_binding,
					$.array_value,
					$.object_value,
					$.factory_in_place,
					$.value,
				),
				optional(
					choice(
						$.component_block, // allow nested tuning blocks for factories/classes
					),
				),
			),

		// --- Arrays & Dicts --------------------------------------------------

		// "/<type>?"    (value head form; body is array_block)
		typed_array_head: $ => seq('/', optional($.type_ref)),

		// Array value in value-position: "/<type>?" <array_block>
		array_value: $ => seq($.typed_array_head, $.array_block),

		// "*"          (value head form; body is dict_block)
		// опционально
		dict_head: _ => prec(0, '*'),

		// Object value in value-position: "*" <dict_block>
		object_value: $ => prec(1, seq('*', $.dict_block)),

		// dict entry: <key> ␠ (<binding>|<bi_binding>|<value>|<factory_in_place>|<caret_ref>|<typed_array_head>|<dict_head>) (optional nested block)
		dict_entry: $ =>
			seq(
				field('key', $.dict_key),
				$.sp,
				choice(
					$.binding_left,
					$.binding_bi,
					$.value,
					$.factory_in_place,
					$.caret_ref,
					$.array_value,
					$.object_value,
				),
				optional(choice($.component_block)),
			),

		// dict spread/parent expand: "^" (␠ <prop_name>)?
		dict_spread: $ => $.caret_ref,

		// --- Bindings / Aliasing --------------------------------------------

		// <lhs> ␠ "<=" ␠ <rhs> (␠ <init_value>)?
		binding_left: $ =>
			seq(
				field('lhs', $.prop_name),
				$.sp,
				'<=',
				$.sp,
				field('rhs', $.rhs),
				optional(seq($.sp, field('init', $.value))),
			),

		// <lhs> ␠ "<=>" ␠ <rhs> (␠ <init_value>)?
		binding_bi: $ =>
			seq(
				field('lhs', $.prop_name),
				$.sp,
				'<=>',
				$.sp,
				field('rhs', $.prop_name),
				optional(seq($.sp, field('init', $.value))),
			),

		// <subprop> ␠ "=>" ␠ <owner_alias>
		export_binding: $ => seq(field('subprop', $.prop_name), $.sp, '=>', $.sp, field('alias', $.prop_name)),

		// "^" (␠ <prop_name>)?
		caret_ref: $ => seq('^', optional(seq($.sp, $.prop_name))),

		rhs: $ => choice($.prop_name, $.value, $.caret_ref),

		// --- Array items -----------------------------------------------------

		// Inside arrays you can put values, factories, bindings, typed heads, dict heads
		array_item: $ =>
			choice(
				$.value,
				$.factory_standalone,
				$.binding_left,
				$.binding_bi,
				$.export_binding,
				$.array_value,
				$.object_value,
			),

		// --- Values ----------------------------------------------------------

		value: $ =>
			choice(
				$.null,
				$.boolean,
				$.number,
				$.string,
				$.localized_string,
				$.array_value,
				$.object_value,
				$.class_ref,
			),

		// class reference: "$ident"
		class_ref: _ => /\$[A-Za-z0-9_]+/,

		// Recognized primitive/alias types after '/' (kept permissive)
		type_ref: $ => choice($.primitive_type, $.class_ref, $.name_token),

		primitive_type: _ => choice('string', 'number', 'boolean', 'null', 'any'),

		// property name with optional multiplex key and mutable suffix:
		// <name>( "*" <key_no_space> )? ("?")?
		prop_name: $ =>
			seq(
				field('name', $.name_token),
				optional(
					field('multiplex', seq(token.immediate('*'), optional(field('key', token.immediate(/[^\s\?]+/))))),
				),
				optional(field('mutable', token.immediate(/\?/))),
			),

		// dict key may be a simple name or a property-like name (to allow 'click?' etc)
		dict_key: $ => choice($.prop_name, $.name_token),

		// Factory used as a value on the RIGHT of a prop (in-place):
		// Example:  Options ␠ $mol_list
		factory_in_place: $ => seq(field('factory', $.factory_token), $.sp, field('class', $.class_ref)),

		// Factory as a standalone array item (supports '<=' push form):
		// Either:    <= ␠ Theme ␠ $mol_theme_auto
		// Or:        Task_row*0 ␠ $mol_string
		factory_standalone: $ =>
			choice(
				seq('<=', $.sp, field('factory', $.factory_token), $.sp, field('class', $.class_ref)),
				seq(field('factory', $.factory_token), $.sp, field('class', $.class_ref)),
			),

		// UpperCamelCase (optionally '*<key>' suffix) for factory names
		factory_token: _ => /[A-Z][A-Za-z0-9_]*(?:\*[^\s\?]+)?/,

		// Names (both lower/upper allowed to support factory-like props)
		name_token: _ => /[A-Za-z_][A-Za-z0-9_]*/,

		// Strings -------------------------------------------------------------

		// Single-line raw string: "\"<anything till EOL>"
		raw_string_line: _ => token(seq('\\', /[^\n]*/)),

		// Multi-line raw string block: "\" then indented lines each as raw_string_line
		raw_string_block: $ => seq('\\', repeat1(seq('\n', repeat1('\t'), $.raw_string_line))),

		string: $ => choice($.raw_string_line, $.raw_string_block),

		// Localized: "@" ␠ <raw_string_line>
		localized_string: $ => seq('@', $.sp, $.raw_string_line),

		// Numbers / special values -------------------------------------------

		number: _ => token(choice(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/, /\+?Infinity/, /-Infinity/, /NaN/)),

		boolean: _ => choice('true', 'false'),
		null: _ => 'null',

		// Comments ------------------------------------------------------------

		comment: $ =>
			prec.left(
				seq('-', optional(seq($.sp, token(/[^\n]+/))), repeat(seq('\n', repeat1('\t'), token(/[^\n]*/)))),
			),

		// Single required space token to enforce "single spaces between nodes"
		sp: _ => token(' '),
	},
})
