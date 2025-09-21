// grammar.js
// Tree-sitter grammar for $mol view.tree (структурная разметка по строкам, табы и один пробел как в $mol_tree2)
// Примечание: полноценный INDENT/DEDENT лучше сделать через external scanner;
// здесь INDENT (массив \t) остаётся в AST для восстановления вложенности.

module.exports = grammar({
	name: 'viewtree',

	// Не игнорируем пробелы и табы глобально — нам нужна строгая валидация "ровно один пробел"
	extras: $ => [],

	conflicts: $ => [],

	rules: {
		// Корень: >=1 строки, каждая ОБЯЗАННО заканчивается \n
		source_file: $ => repeat1($.line),

		// Строка: [\t...]? путь из узлов (node (SEP node)*) NEWLINE
		line: $ => seq(optional($.indent), $.node_path, $.newline),

		// Последовательность узлов в строке, разделённых РОВНО одним пробелом
		node_path: $ => seq($.node, repeat(seq($.sep, $.node))),

		// Узел: либо сырая строка (\...), либо один из "типов" — идентификатор/стрелки/спец-символы
		node: $ =>
			choice(
				$.raw_string,
				$.arrow_both,
				$.arrow_left,
				$.arrow_right,
				$.special_dash,
				$.special_slash,
				$.special_star,
				$.special_caret,
				$.special_at,
				$.ident,
			),

		// ---- Токены-разделители/структура ----
		indent: _ => token.immediate(/[ \t]*\t[ \t\t]*/.source), // см. ниже пояснение
		// ↑ хитрость: принимаем ЛЮБЫЕ начальные пробелы/табы, но на практике
		// вы будете проверять, что в проекте есть только табы. Если хотите
		// запретить пробелы полностью: используйте `/\t+/`

		// Рекомендация: для «строго только табы» замените на:
		// indent: _ => token.immediate(/\t+/)

		sep: _ => token(' '), // Ровно один пробел между узлами
		newline: _ => token('\n'), // Конец строки обязателен

		// ---- Стрелки ----
		arrow_both: _ => token('<=>'),
		arrow_left: _ => token('<='), // важно объявить после '<=>' чтобы не «съедать» его
		arrow_right: _ => token('=>'),

		// ---- Спец-узлы как отдельные типы ----
		special_dash: _ => token('-'),
		special_slash: _ => token('/'),
		special_star: _ => token('*'),
		special_caret: _ => token('^'),
		special_at: _ => token('@'),

		// ---- Идентификатор ----
		// Разрешаем FQN/имена с $, точками, цифрами; суффикс * или ? в конце.
		ident: _ => token(seq(/[\$A-Za-z_][\w\.\$]*/, optional(choice('*', '?')))),

		// ---- Сырая строка ----
		// Начинается с обратной косой и тянется до конца строки (без включения \n)
		raw_string: _ => token(seq('\\', /[^\n]*/)),
	},
})
