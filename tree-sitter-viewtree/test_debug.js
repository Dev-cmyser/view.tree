const $ = require('mol_tree2')

let simple = $.$mol_tree2_from_string(
	`$mol_app_demo_detail $mol_page
	description \
	tools /
		<= Readme $mol_check_icon
`,
)

console.log('\n=== Simple example ===')
console.log('Root kids count:', simple.kids.length)
simple.kids.forEach((kid, i) => {
	console.log(`\nKid ${i}:`)
	console.log('  type:', kid.type)
	console.log('  value:', kid.value)
	console.log('  kids count:', kid.kids.length)
	kid.kids.forEach((subkid, j) => {
		console.log(`  Kid ${i}.${j}:`)
		console.log('    type:', subkid.type)
		console.log('    value:', subkid.value)
		console.log('    kids count:', subkid.kids.length)
		subkid.kids.forEach((subsubkid, k) => {
			console.log(`    Kid ${i}.${j}.${k}:`)
			console.log('      type:', subsubkid.type)
			console.log('      value:', subsubkid.value)
			console.log('      kids count:', subsubkid.kids.length)
		})
	})
})
