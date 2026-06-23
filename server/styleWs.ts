/**
 * WebSocket endpoint for the `mol.style` browser extension.
 *
 * Opens a single connection per port (default 7531). Speaks a minimal request/response
 * protocol over JSON text frames:
 *
 *   client → server: { id: number, method: string, params: any }
 *   server → client: { id: number, result: any }   |   { id: number, error: string }
 *
 * Methods:
 *   - resolveSelector({ name }) → { selector, matches: ResolveMatch[] }
 *   - editStyle({ uri, path, value })  → { ok: false, error: 'not implemented' } in v1
 */

import { WebSocketServer, WebSocket } from 'ws'
import { resolveSelector, applyEdit } from './styleIndex'

type Req = { id?: number; method?: string; params?: any }

export type StyleWsServer = {
	close: () => void
	port: number
}

export function startStyleWs(port: number, log: (msg: string) => void): StyleWsServer | null {
	let wss: WebSocketServer
	try {
		wss = new WebSocketServer({ port, host: '127.0.0.1' })
	} catch (e: any) {
		log(`[style-ws] failed to bind :${port} — ${e?.message || e}`)
		return null
	}

	wss.on('listening', () => {
		log(`[style-ws] listening on ws://127.0.0.1:${port}/mol.style`)
	})

	wss.on('connection', (ws: WebSocket, req) => {
		const peer = req.socket.remoteAddress ?? '?'
		log(`[style-ws] client connected from ${peer}`)
		ws.on('message', raw => {
			let msg: Req
			try {
				msg = JSON.parse(String(raw))
			} catch {
				return
			}
			if (typeof msg.id !== 'number' || !msg.method) return
			handle(msg)
				.then(result => ws.send(JSON.stringify({ id: msg.id, result })))
				.catch(err => ws.send(JSON.stringify({ id: msg.id, error: String(err?.message || err) })))
		})
		ws.on('close', () => log(`[style-ws] client ${peer} disconnected`))
	})

	wss.on('error', e => log(`[style-ws] server error: ${e?.message || e}`))

	return {
		close: () => wss.close(),
		port,
	}
}

async function handle(req: Req): Promise<unknown> {
	switch (req.method) {
		case 'resolveSelector':
			return doResolve(req.params)
		case 'editStyle':
			return doEdit(req.params)
		default:
			throw new Error(`unknown method: ${req.method}`)
	}
}

async function doEdit(params: any) {
	const uri = String(params?.uri || '')
	const rootClass = String(params?.rootClass || '')
	const targetPath = Array.isArray(params?.path) ? params.path.map(String) : []
	const value = String(params?.value || '')
	if (!uri || !rootClass) return { ok: false, error: 'uri and rootClass are required' }
	return applyEdit(uri, rootClass, targetPath, value)
}

function doResolve(params: any): { selector: string; matches: any[] } {
	const name = String(params?.name || '')
	if (!name) return { selector: '', matches: [] }
	const hits = resolveSelector(name)
	const matches = hits.map(h => ({
		selector: name,
		uri: h.uri,
		file: h.file,
		line: h.line,
		col: h.col,
		path: h.path,
		source: h.source,
		rawCss: false,
		kind: h.kind,
		rootClass: h.rootClass,
	}))
	return { selector: name, matches }
}
