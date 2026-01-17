import { createState } from './state.ts'
import { startWsServer } from './wsApp.ts'

const PORT = Number(process.env.WS_PORT ?? process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? process.env.WS_HOST ?? '127.0.0.1'

const state = createState()
const { stop } = startWsServer(state, PORT, HOST)

console.log(`[mock-ws] listening on ws://${HOST}:${PORT}`)

function shutdown(signal: string) {
  console.log(`[mock-ws] received ${signal}, shutting down...`)
  stop()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
