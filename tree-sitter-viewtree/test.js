const $ = require('mol_tree2')

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
console.log('\nJSON representation:')
console.log(JSON.stringify(i))

// можешь по аналогии добавлять свои
