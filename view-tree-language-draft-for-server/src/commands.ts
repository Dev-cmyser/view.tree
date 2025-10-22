import * as vscode from "vscode"

export const newModuleTs = vscode.commands.registerCommand( "mam.newModuleTs", async ( ...commandArgs ) => {
	const path = await newModulePath( "ts", commandArgs[ 0 ]?.path )
	if( !path ) return
	const newFile = vscode.Uri.file( path )
	const existed = await fileExist( newFile )
	await createAndOpenFile( newFile )
	if( !existed ) await vscode.commands.executeCommand( "editor.action.insertSnippet", { name: "MAM class definition" } )
} )

export const newModuleViewTree = vscode.commands.registerCommand( "mam.newModuleViewTree", async ( ...commandArgs ) => {
	const path = await newModulePath( "view.tree", commandArgs[ 0 ]?.path )
	if( !path ) return
	const newFile = vscode.Uri.file( path )
	const existed = await fileExist( newFile )
	await createAndOpenFile( newFile )
	if( !existed )
		await vscode.commands.executeCommand( "editor.action.insertSnippet", {
			snippet: "\\$${RELATIVE_FILEPATH/[\\\\/\\\\][^\\\\/\\\\]+$|([\\\\/\\\\])/${1:+_}/g} $$mol_view\n\t$0",
		} )
} )

export const createViewTs = vscode.commands.registerCommand( "mam.createViewTs", async ( ...commandArgs ) => {
	const source = commandArgs[ 0 ]?.path ?? vscode.window.activeTextEditor?.document.uri.path
	const newFile = vscode.Uri.file( source.replace( /\.view\..+$/, ".view.ts" ) )
	const existed = await fileExist( newFile )
	await createAndOpenFile( newFile )
	if( !existed ) await vscode.commands.executeCommand( "editor.action.insertSnippet", { name: "$mol_view extend" } )
} )

export const createViewCssTs = vscode.commands.registerCommand( "mam.createViewCssTs", async ( ...commandArgs ) => {
	const source = commandArgs[ 0 ]?.path ?? vscode.window.activeTextEditor?.document.uri.path
	const newFile = vscode.Uri.file( source.replace( /\.view\..+/, ".view.css.ts" ) )
	const existed = await fileExist( newFile )
	await createAndOpenFile( newFile )
	if( !existed ) await vscode.commands.executeCommand( "editor.action.insertSnippet", { name: "$mol_style_define" } )
} )

async function newModulePath( extension: "ts" | "view.tree", parentPath?: string ) {
	if( parentPath ) {
		const name = await vscode.window.showInputBox( {
			value: "",
			placeHolder: "Module name",
		} )

		if( name === undefined ) return
		if( name == "" ) return parentPath + `/${ parentPath.replace( /\\/g, "/" ).split( "/" ).at( -1 ) }.${ extension }`

		return parentPath + `/${ name }/${ name }.${ extension }`
	}

	const default_value =
		vscode.window.activeTextEditor?.document.uri.path
			.replace( vscode.workspace.workspaceFolders![ 0 ].uri.path, "" )
			.slice( 1 )
			.replace( /\\/g, "/" )
			.split( "/" )
			.slice( 0, 2 )
			.join( "_" ) + "_"

	const fullName = await vscode.window.showInputBox( {
		value: default_value,
		placeHolder: "Full module name (e.g. my_app_module)",
	} )
	if( !fullName ) return null

	const parts = fullName?.split( "_" )

	return vscode.workspace.workspaceFolders![ 0 ].uri.path + `/${ parts?.join( "/" ) }/${ parts?.at( -1 ) }.${ extension }`
}

async function fileExist( uri: vscode.Uri ) {
	try {
		await vscode.workspace.fs.stat( uri )
		return true
	} catch {
		return false
	}
}

async function createAndOpenFile( file: vscode.Uri ) {
	const wsedit = new vscode.WorkspaceEdit()
	wsedit.createFile( file, { ignoreIfExists: true } )
	await vscode.workspace.applyEdit( wsedit )

	const doc = await vscode.workspace.openTextDocument( file )
	await vscode.window.showTextDocument( doc )
}
