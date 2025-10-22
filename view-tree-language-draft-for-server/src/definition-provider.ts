import * as vscode from "vscode"
import { SourceMapConsumer } from "source-map-js"

type NodeType = "root_class" | "class" | "prop" | "sub_prop" | "comp"

export class DefinitionProvider implements vscode.DefinitionProvider {
	constructor(
		private getProjectData: () => {
			componentsWithProperties: Map<string, { properties: Set<string>; file: string }>
		},
	) {}

	private async findClassSymbol( tsUri: vscode.Uri, className: string ) {
		if( !( await this.fileExist( tsUri ) ) ) return
		const symbols = ( await vscode.commands.executeCommand(
			"vscode.executeDocumentSymbolProvider",
			tsUri,
		) ) as vscode.DocumentSymbol[]
		const classSymbol = symbols?.[ 0 ].children.find( ( symb ) => symb.name == className )
		return classSymbol
	}

	private async findPropSymbol( tsUri: vscode.Uri, className: string, propName: string ) {
		const classSymbol = await this.findClassSymbol( tsUri, className )
		const propSymbol = classSymbol?.children.find( ( symb ) => symb.name == propName )
		return propSymbol
	}

	private async fileExist( uri: vscode.Uri ) {
		try {
			await vscode.workspace.fs.stat( uri )
			return true
		} catch {
			return false
		}
	}

	private mamUri() {
		return vscode.workspace.workspaceFolders![ 0 ].uri
	}

	private getNodeType( document: vscode.TextDocument, wordRange: vscode.Range ): NodeType {
		if( wordRange.start.character == 1 && wordRange.start.line == 0 ) return "root_class"

		const firstChar = document.getText( new vscode.Range( wordRange.start.translate( 0, -1 ), wordRange.start ) )
		if( firstChar == "$" ) return "class"

		if( wordRange.start.character == 1 ) return "prop"
		const leftNodeChar = document.getText(
			new vscode.Range( wordRange.start.translate( 0, -2 ), wordRange.start.translate( 0, -1 ) ),
		)
		if( [ ">", "=", "^" ].includes( leftNodeChar ) ) return "prop"

		return "sub_prop"
	}

	private async handleRootClass( document: vscode.TextDocument, wordRange: vscode.Range ): Promise<vscode.Location[]> {
		const viewTsUri = vscode.Uri.file( document.uri.path.replace( /.tree$/, ".ts" ) )
		const nodeName = document.getText( wordRange )
		const classSymbol = await this.findClassSymbol( viewTsUri, "$" + nodeName )
		if( classSymbol ) return [ new vscode.Location( viewTsUri, classSymbol.range ) ]

		const locationRange = new vscode.Range( new vscode.Position( 0, 0 ), new vscode.Position( 0, 0 ) )
		return [ new vscode.Location( viewTsUri, locationRange ) ]
	}

	private async handleClass( document: vscode.TextDocument, wordRange: vscode.Range ): Promise<vscode.Location[]> {
		const nodeName = document.getText( wordRange )
		const parts = nodeName.split( "_" )

		const firstCharRange = new vscode.Range( new vscode.Position( 0, 0 ), new vscode.Position( 0, 0 ) )

		const viewTreeUri = vscode.Uri.joinPath( this.mamUri(), parts.join( "/" ), parts.at( -1 ) + ".view.tree" )
		if( await this.fileExist( viewTreeUri ) ) {
			return [ new vscode.Location( viewTreeUri, firstCharRange ) ]
		}

		const viewTreeUri2 = vscode.Uri.joinPath(
			this.mamUri(),
			[ ...parts, parts.at( -1 ) ].join( "/" ),
			parts.at( -1 ) + ".view.tree",
		)
		if( await this.fileExist( viewTreeUri2 ) ) {
			return [ new vscode.Location( viewTreeUri2, firstCharRange ) ]
		}

		const symbols = ( await vscode.commands.executeCommand(
			"vscode.executeWorkspaceSymbolProvider",
			"$" + nodeName,
		) ) as vscode.SymbolInformation[]
		if( symbols[ 0 ] ) return [ symbols[ 0 ].location ]

		return [ new vscode.Location( viewTreeUri, firstCharRange ) ]
	}

	private async handleComp( document: vscode.TextDocument, wordRange: vscode.Range ): Promise<vscode.Location[]> {
		const cssTsUri = vscode.Uri.file( document.uri.path.replace( /.tree$/, ".css.ts" ) )
		const symbols: vscode.DocumentSymbol[] = await vscode.commands.executeCommand(
			"vscode.executeDocumentSymbolProvider",
			cssTsUri,
		)

		const nodeName = document.getText( wordRange )
		const symb = symbols?.[ 0 ]?.children.find( ( symb ) => symb.name == nodeName )
		if( !symb ) return []

		const locations: any[] = await vscode.commands.executeCommand(
			"vscode.executeDefinitionProvider",
			cssTsUri,
			symb.selectionRange.start,
		)
		return locations.map( ( l ) => new vscode.Location( l.targetUri, l.targetRange ) )
	}

	private async handleProp( document: vscode.TextDocument, wordRange: vscode.Range ): Promise<vscode.Location[]> {
		const className = "$" + document.getText( document.getWordRangeAtPosition( new vscode.Position( 0, 1 ) ) )

		const viewTsUri = vscode.Uri.file( document.uri.path.replace( /.tree$/, ".ts" ) )
		const nodeName = document.getText( wordRange )
		const propSymbol = await this.findPropSymbol( viewTsUri, className, nodeName )

		if( !propSymbol ) return this.handleComp( document, wordRange )

		const locations: any[] = await vscode.commands.executeCommand(
			"vscode.executeDefinitionProvider",
			viewTsUri,
			propSymbol.selectionRange.start,
		)
		return locations.map( ( l ) => new vscode.Location( l.targetUri, l.targetRange ) )
	}

	private async handleSubProp( document: vscode.TextDocument, wordRange: vscode.Range ): Promise<vscode.Location[]> {
		const sourceMapUri = vscode.Uri.file( document.uri.path.replace( /([^\/]*$)/, "-view.tree/$1.d.ts.map" ) )
		const sourceMap = await vscode.workspace.openTextDocument( sourceMapUri )

		const consumer = new SourceMapConsumer( JSON.parse( sourceMap.getText() ) )

		const genPos = consumer.generatedPositionFor( {
			source: ( consumer as any ).sources[ 0 ],
			line: wordRange.start.line + 1,
			column: wordRange.start.character + 1,
		} )

		const dts = vscode.Uri.file( document.uri.path.replace( /([^\/]*$)/, "-view.tree/$1.d.ts" ) )
		const dtsDoc = await vscode.workspace.openTextDocument( dts )
		const symbolPos = dtsDoc.lineAt( Number( genPos.line ) + 2 ).range.end.translate( 0, -5 )

		const locations: any = await vscode.commands.executeCommand( "vscode.executeDefinitionProvider", dts, symbolPos )

		return locations?.[ 0 ]
			? [ new vscode.Location( locations[ 0 ].targetUri, locations[ 0 ].targetSelectionRange.end ) ]
			: []
	}

	async provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
	): Promise<vscode.Location[]> {
		const range = document.getWordRangeAtPosition( position )
		if( !range ) return []

		const nodeName = document.getText( range )
		if( !nodeName ) return []

		const nodeType = this.getNodeType( document, range )

		switch( nodeType ) {
			case "root_class":
				return this.handleRootClass( document, range )
			case "class":
				return this.handleClass( document, range )
			case "comp":
				return this.handleComp( document, range )
			case "prop":
				return this.handleProp( document, range )
			case "sub_prop":
				return this.handleSubProp( document, range )
			default:
				return []
		}
	}
}
