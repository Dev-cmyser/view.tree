const $ = require('mol_tree2')

const keywords = new Set([
	'',
	'.byte',
	'.sequence',
	'.set_of',
	'.optional',
	'.list_of',
	'.any_of',
	'.except',
	'.with_delimiter',
])

function $mol_tree2_grammar_check(grammar) {
	function visit(node) {
		check: {
			if (keywords.has(node.type)) break check
			if (grammar.select(node.type).kids.length) break check
			$.$mol_fail(node.error(`Wrong pattern name`))
		}

		for (const kid of node.kids) {
			visit(kid)
		}
	}

	visit(grammar)

	return grammar
}

let i = $.$mol_tree2_from_string(
	`$hyoo_survey_app $mol_book2_catalog
	param \meet
	- menu_title @ \✨ Meets
	menu_tools /
		<= Meet_add $mol_button_minor
			click? <=> meet_add? null
			hint @ \Add new Meet
			sub /
				<= Meet_add_icon $mol_icon_plus
`,
)
console.log('check tree:')
console.log($.$mol_tree2_grammar_check(i))
console.log('\nJSON representation:')
console.log(JSON.stringify(i))
