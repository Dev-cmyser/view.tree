import * as vscode from "vscode"
import { DefinitionProvider } from "./definition-provider"
import { CompletionProvider } from "./completion-provider"
import { createViewCssTs, createViewTs, newModuleTs, newModuleViewTree } from './commands';

interface ProjectData {
	componentsWithProperties: Map<string, { properties: Set<string>; file: string }>
}

let projectData: ProjectData = {
	componentsWithProperties: new Map(),
}

async function refreshProjectData() {
	console.log( "[view.tree] Refreshing project data..." )
	projectData = await scanProject()
}

async function scanProject(): Promise<ProjectData> {
	const data: ProjectData = {
		componentsWithProperties: new Map(),
	}

	console.log( "[view.tree] Starting project scan..." )

	if( !vscode.workspace.workspaceFolders ) {
		console.log( "[view.tree] No workspace folders found" )
		return data
	}

	const tsFiles = await vscode.workspace.findFiles( "**/*.ts", "**/node_modules/**" )
	const viewTreeFiles = await vscode.workspace.findFiles( "**/*.view.tree", "**/node_modules/**" )

	for( const file of tsFiles ) {
		if( file.path.endsWith( ".d.ts" ) ) {
			continue
		}
		const componentsFromFile = await getComponentsFromFile( file )
		for( const [ component, properties ] of componentsFromFile ) {
			data.componentsWithProperties.set( component, { properties, file: file.path } )
		}
	}
	for( const file of viewTreeFiles ) {
		const componentsFromFile = await getComponentsFromFile( file )
		for( const [ component, properties ] of componentsFromFile ) {
			data.componentsWithProperties.set( component, { properties, file: file.path } )
		}
	}

	console.log( `[view.tree] Scan complete: ${ data.componentsWithProperties.size } components with properties` )
	return data
}

function parseViewTreeFile( content: string ): { componentsWithProperties: Map<string, Set<string>> } {
	const lines = content.split( "\n" )
	let currentComponent: string | null = null

	// Локальные данные для возврата
	const componentsWithProperties = new Map<string, Set<string>>()

	for (const line of lines) {

		const trimmed = line.trim();

		// Берем только первое слово из строк без отступа
		if (!line.startsWith("\t")) {
			const words = trimmed.split(/\s+/);
			currentComponent = words[0];
			componentsWithProperties.set(currentComponent, new Set());
			continue
		}
		if (!currentComponent) continue

		// Проверяем строки с одним табом и берем первое слово после пробела
		if (!line.startsWith("\t\t")) {
			const words = trimmed.split(/\s+/);
			componentsWithProperties.get(currentComponent)!.add(words[0]);
		}

		const matches = trimmed.matchAll(/(?:=>|<=>|<=) (\w*)/g);
		for (const match of matches) {
			componentsWithProperties.get(currentComponent)!.add(match[1]);
		}

	}

	return { componentsWithProperties }
}

function parseTsFile( content: string ): { componentsWithProperties: Map<string, Set<string>> } {
	// Ищем только первый $компонент в TypeScript файле
	const lines = content.split( "\n" )
	let currentClass: string | null = null

	// Локальные данные для возврата
	const componentsWithProperties = new Map<string, Set<string>>()

	for( const line of lines ) {
		// Если еще не нашли компонент, ищем объявление класса с $ компонентом
		if( !currentClass ) {
			const classMatch = line.match( /export\s+class\s+(\$\w+)/ )
			if( classMatch ) {
				currentClass = classMatch[ 1 ]
				if( !componentsWithProperties.has( currentClass ) ) {
					componentsWithProperties.set( currentClass, new Set() )
				}
			}
		}

		// Ищем методы с двумя табами (свойства компонента)
		if( currentClass ) {
			const methodMatch = line.match( /^\t\t([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/ )
			if( methodMatch ) {
				const methodName = methodMatch[ 1 ]
				// Исключаем конструктор и стандартные методы
				if( methodName !== "constructor" && !methodName.startsWith( "_" ) ) {
					componentsWithProperties.get( currentClass )!.add( methodName )
				}
			}
		}
	}

	return { componentsWithProperties }
}

async function getComponentsFromFile( uri: vscode.Uri ): Promise<Map<string, Set<string>>> {
	const componentsWithProperties = new Map<string, Set<string>>()
	try {
		const buffer = await vscode.workspace.fs.readFile( uri )
		const content = buffer.toString()

		if( !uri.path.includes( "/-/" ) && !uri.path.includes( "/-view.tree/" ) ) {
			if( uri.path.endsWith( ".view.tree" ) ) {
				const result = parseViewTreeFile( content )
				for( const [ component, properties ] of result.componentsWithProperties ) {
					componentsWithProperties.set( component, properties )
				}
			}

			if( uri.path.endsWith( ".ts" ) ) {
				const result = parseTsFile( content )
				for( const [ component, properties ] of result.componentsWithProperties ) {
					componentsWithProperties.set( component, properties )
				}
			}
		}
	} catch( error ) {
		console.log( `[view.tree] Error reading file for component extraction ${ uri.path }:`, error )
	}
	return componentsWithProperties
}

async function updateSingleFile( uri: vscode.Uri ) {
	console.log( `[view.tree] Updating single file: ${ uri.path }` )
	// Получаем актуальные компоненты из файла
	const components = await getComponentsFromFile( uri )

	// Удаляем все компоненты которые могли быть из этого файла
	// (так как 1 файл = 1 компонент, удаляем по ключам новых компонентов)
	for( const component of components.keys() ) {
		projectData.componentsWithProperties.delete( component )
	}

	// Добавляем актуальные компоненты с их свойствами
	for( const [ component, properties ] of components ) {
		projectData.componentsWithProperties.set( component, { properties, file: uri.path } )
		console.log( `[view.tree] New components  ${ components } \n ${ properties }:` )
	}
}

async function removeSingleFile( uri: vscode.Uri ) {
	console.log( `[view.tree] File deleted: ${ uri.path }` )

	// Получаем компоненты, которые были в удаленном файле
	const componentsToRemove = await getComponentsFromFile( uri )

	// Удаляем только эти компоненты из projectData
	for( const component of componentsToRemove.keys() ) {
		projectData.componentsWithProperties.delete( component )
		console.log( `[view.tree] Removed component: ${ component }` )
	}
}

export function activate( context: vscode.ExtensionContext ) {
	// Инициализируем сканирование
	refreshProjectData()

	// Создаем экземпляры провайдеров
	const definitionProvider = new DefinitionProvider( () => projectData )
	const completionProvider = new CompletionProvider( () => projectData )

	// Регистрируем провайдеры для .view.tree файлов
	const treeSelector = { language: 'tree', pattern: '**/*.view.tree' }

	context.subscriptions.push(
		// Definition Provider (Go to Definition)
		vscode.languages.registerDefinitionProvider( treeSelector, definitionProvider ),

		// Completion Provider (IntelliSense)
		vscode.languages.registerCompletionItemProvider(
			treeSelector,
			completionProvider,
			"$", // Trigger completion when typing $
		),
		
		newModuleTs,
		newModuleViewTree,
		createViewTs,
		createViewCssTs,
		
	)

	// Отслеживаем изменения файлов
	const fileWatcher = vscode.workspace.createFileSystemWatcher( "**/*.{view.tree,ts}" )
	context.subscriptions.push(
		fileWatcher,
		fileWatcher.onDidChange( updateSingleFile ),
		fileWatcher.onDidCreate( updateSingleFile ),
		fileWatcher.onDidDelete( removeSingleFile ),
	)

	console.log( "[view.tree] Extension activated with all providers" )
}
