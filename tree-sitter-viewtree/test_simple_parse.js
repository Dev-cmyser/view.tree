const $ = require('mol_tree2')
const fs = require('fs')

let content = fs.readFileSync('test_simple.view.tree', 'utf8')
console.log('File content:')
console.log(content)
console.log('\n=== Parsing ===')

let tree = $.$mol_tree2_from_string(content)

console.log('\nRoot kids count:', tree.kids.length)
tree.kids.forEach((kid, i) => {
	console.log(`\nRoot kid ${i}:`)
	console.log('  type:', JSON.stringify(kid.type))
	console.log('  value:', JSON.stringify(kid.value))
	console.log('  kids count:', kid.kids.length)
	kid.kids.forEach((subkid, j) => {
		console.log(`  \nKid [${i}][${j}]:`)
		console.log('    type:', JSON.stringify(subkid.type))
		console.log('    value:', JSON.stringify(subkid.value))
		console.log('    kids count:', subkid.kids.length)
		subkid.kids.forEach((subsubkid, k) => {
			console.log(`    \nKid [${i}][${j}][${k}]:`)
			console.log('      type:', JSON.stringify(subsubkid.type))
			console.log('      value:', JSON.stringify(subsubkid.value))
			console.log('      kids count:', subsubkid.kids.length)
		})
	})
})

console.log('\n\n=== Full JSON ===')
console.log(JSON.stringify(tree, null, 2))
