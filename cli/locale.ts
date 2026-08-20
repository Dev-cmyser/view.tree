import * as fs from 'fs'
import * as path from 'path'

// Раскладывает объединённые файлы локалей по модулям MAM.
//
// На входе — файлы вида `<что-угодно>.locale=<lang>.json`, где лежат ключи сразу
// многих модулей: так выглядит и локаль собранного приложения (`<app>/-/web.locale=ru.json`),
// и файл, который переводчику удобнее отдать одним куском. На выходе — привычные
// `<модуль>/<имя>.locale=<lang>.json` рядом с исходниками каждого модуля.
//
// Ключ несёт путь к модулю в себе: `$bog_apps_app_hero_title` живёт в `bog/apps/app`.
// Где кончается путь и начинается имя свойства, по одному ключу не понять: `_` —
// и разделитель папок, и разделитель слов. Одного «самого длинного совпавшего
// префикса» мало: у `$raggu_web_front_sidebar_lang_label_text` свойство начинается
// на `lang`, и рядом есть настоящий подмодуль `sidebar/lang` — ключ уехал бы в него.
//
// Поэтому спрашиваем сами модули: MAM кладёт в `<модуль>/-view.tree/*.locale=en.json`
// ровно те ключи, которые модуль объявил. Идём от самого глубокого кандидата к
// корню и берём первый, который ключ признаёт; если не признал никто — падаем
// обратно на самый глубокий существующий путь. Ключи, для которых нет ни одной
// папки, не раскладываем наугад, а показываем отдельным списком.

interface Locale_options {
	include: string[]
	exclude: string[]
	update: boolean
	dry: boolean
}

interface Bucket {
	dir: string
	lang: string
	keys: Record< string, string >
}

function parse_flags( args: string[] ): { target: string; options: Locale_options } {
	const options: Locale_options = { include: [], exclude: [], update: false, dry: false }
	let target = ''

	for( const arg of args ) {
		if( arg.startsWith( '--include=' ) ) options.include.push( arg.slice( 10 ) )
		else if( arg.startsWith( '--exclude=' ) ) options.exclude.push( arg.slice( 10 ) )
		else if( arg === '--update' ) options.update = true
		else if( arg === '--dry' || arg === '--dry-run' ) options.dry = true
		else if( !arg.startsWith( '--' ) ) target = target || arg
	}

	return { target, options }
}

/** `path/to/file.locale=ru.json` → `ru`; не локаль → null. */
function lang_of( file: string ): string | null {
	const match = path.basename( file ).match( /\.locale=([\w-]+)\.json$/ )
	return match ? match[ 1 ] : null
}

function source_files( target: string ): string[] {
	const stat = fs.statSync( target )
	if( stat.isFile() ) return lang_of( target ) ? [ target ] : []
	return fs.readdirSync( target )
		.map( name => path.join( target, name ) )
		.filter( file => fs.statSync( file ).isFile() && lang_of( file ) )
		.sort()
}

const dir_cache = new Map< string, string[] >()

/** Содержимое папки, с кэшем: резолвинг ключей дёргает одни и те же пути сотни раз. */
function entries_of( dir: string ): string[] {
	let list = dir_cache.get( dir )
	if( !list ) {
		try { list = fs.readdirSync( dir ) } catch { list = [] }
		dir_cache.set( dir, list )
	}
	return list
}

/**
 * Существует ли папка — с учётом регистра. `fs.existsSync` на macOS и Windows
 * регистр игнорирует, и `help/Section` совпал бы с настоящей папкой `help/section`,
 * уводя ключи подвью в несуществующий модуль.
 */
function dir_exists( root: string, rel: string ): boolean {
	let current = root
	for( const segment of rel.split( '/' ) ) {
		if( !entries_of( current ).includes( segment ) ) return false
		current = path.join( current, segment )
		try { if( !fs.statSync( current ).isDirectory() ) return false } catch { return false }
	}
	return true
}

const declared_cache = new Map< string, Set< string > >()

/** Ключи, которые модуль объявил сам: собираем из всех его файлов локалей. */
function declared_keys( root: string, rel: string ): Set< string > {
	let keys = declared_cache.get( rel )
	if( keys ) return keys
	keys = new Set< string >()

	const dir = path.join( root, rel )
	const places = [ dir, path.join( dir, '-view.tree' ) ]

	for( const place of places ) {
		for( const name of entries_of( place ) ) {
			if( !lang_of( name ) ) continue
			try {
				const data = JSON.parse( fs.readFileSync( path.join( place, name ), 'utf8' ) )
				for( const key of Object.keys( data ) ) keys.add( key )
			} catch {
				// битый или нечитаемый файл — просто не даёт подсказок
			}
		}
	}

	declared_cache.set( rel, keys )
	return keys
}

/** `$bog_apps_app_hero_title` → `bog/apps/app`. */
function module_of( key: string, root: string ): string | null {
	const parts = key.replace( /^\$/, '' ).split( '_' )
	const candidates: string[] = []

	for( let len = parts.length; len > 0; len-- ) {
		const dir = parts.slice( 0, len ).join( '/' )
		if( dir_exists( root, dir ) ) candidates.push( dir )
	}

	for( const dir of candidates ) {
		if( declared_keys( root, dir ).has( key ) ) return dir
	}

	return candidates[ 0 ] ?? null
}

function passes( dir: string, options: Locale_options ): boolean {
	if( options.exclude.some( frag => dir.includes( frag ) ) ) return false
	if( options.include.length && !options.include.some( frag => dir.includes( frag ) ) ) return false
	return true
}

export function locale( args: string[] ) {
	const { target, options } = parse_flags( args )

	if( !target ) {
		console.error( 'Укажите папку или файл с локалями. Пример: view-tree-lsp locale bog/apps/app/-' )
		process.exit( 1 )
	}
	if( !fs.existsSync( target ) ) {
		console.error( `Не найдено: ${ target }` )
		process.exit( 1 )
	}

	// Модульные пути в ключах отсчитываются от корня MAM — того места, откуда
	// запущена команда. Так же это работает и у сборщика.
	const root = process.cwd()

	const files = source_files( target )
	if( !files.length ) {
		console.error( `В ${ target } нет файлов вида *.locale=<lang>.json` )
		process.exit( 1 )
	}

	const buckets = new Map< string, Bucket >()
	const unresolved = new Set< string >()
	let skipped = 0

	for( const file of files ) {
		const lang = lang_of( file )!
		let source: Record< string, string >

		try {
			source = JSON.parse( fs.readFileSync( file, 'utf8' ) )
		} catch( error: any ) {
			console.error( `Битый JSON, файл пропущен: ${ file } — ${ error.message }` )
			process.exitCode = 1
			continue
		}

		for( const [ key, text ] of Object.entries( source ) ) {
			const dir = module_of( key, root )
			if( !dir ) { unresolved.add( key ); continue }
			if( !passes( dir, options ) ) { skipped++; continue }

			// Не переписываем сам источник: он мог лежать в папке модуля.
			const dest = path.join( root, dir, `${ path.basename( dir ) }.locale=${ lang }.json` )
			if( path.resolve( dest ) === path.resolve( file ) ) continue

			const id = `${ dir }|${ lang }`
			const bucket = buckets.get( id ) ?? { dir, lang, keys: {} }
			bucket.keys[ key ] = text
			buckets.set( id, bucket )
		}
	}

	let written = 0

	for( const bucket of [ ... buckets.values() ].sort( ( a, b ) => a.dir.localeCompare( b.dir ) ) ) {
		const dest = path.join( root, bucket.dir, `${ path.basename( bucket.dir ) }.locale=${ bucket.lang }.json` )

		let result = bucket.keys
		let mode = 'создан'

		if( fs.existsSync( dest ) ) {
			if( options.update ) {
				// Значения из источника свежее — они и побеждают; ключи, которых
				// в источнике нет, остаются нетронутыми.
				const existing = JSON.parse( fs.readFileSync( dest, 'utf8' ) )
				result = { ... existing, ... bucket.keys }
				mode = 'обновлён'
			} else {
				mode = 'перезаписан'
			}
		}

		const sorted: Record< string, string > = {}
		for( const key of Object.keys( result ).sort() ) sorted[ key ] = result[ key ]

		const body = JSON.stringify( sorted, null, '\t' ) + '\n'

		if( options.dry ) {
			console.log( `[dry] ${ mode }: ${ path.relative( root, dest ) } (${ Object.keys( sorted ).length })` )
		} else {
			fs.writeFileSync( dest, body )
			console.log( `${ mode }: ${ path.relative( root, dest ) } (${ Object.keys( sorted ).length })` )
		}
		written++
	}

	console.log( `\nисточников: ${ files.length }, файлов модулей: ${ written }${ skipped ? `, ключей отфильтровано: ${ skipped }` : '' }` )

	if( unresolved.size ) {
		console.log( `\nне нашлось папки модуля (${ unresolved.size }) — разложены не были:` )
		for( const key of [ ... unresolved ].sort().slice( 0, 20 ) ) console.log( `  ${ key }` )
		if( unresolved.size > 20 ) console.log( `  … и ещё ${ unresolved.size - 20 }` )
	}
}
