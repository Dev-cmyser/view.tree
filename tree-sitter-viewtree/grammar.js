module.exports = grammar({
	name: 'viewtree',

	externals: $ => [
		$._indent,
		$._dedent,
		$._newline,
	],

	extras: $ => ['\t'],

	rules: {
		source_file: $ => repeat($.line),

		line: $ => seq(
			$.node,
			$._newline,
			optional($.children)
		),

		children: $ => seq(
			$._indent,
			repeat1($.line),
			$._dedent
		),

		node: $ => seq(
			$.token,
			repeat(seq(' ', $.token))
		),

		token: $ => /[^\t\n\r ]+/,
	}
})
