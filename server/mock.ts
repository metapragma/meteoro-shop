import { createRestApp } from './restApp.ts'
import { createState } from './state.ts'
import { startWsServer } from './wsApp.ts'

const REST_PORT = Number(process.env.REST_PORT ?? 3000)
const WS_PORT = Number(process.env.WS_PORT ?? 3001)
const REST_HOST = process.env.REST_HOST ?? '127.0.0.1'
const WS_HOST = process.env.WS_HOST ?? '127.0.0.1'

const state = createState()

const restApp = createRestApp(state)
const restServer = restApp.listen(REST_PORT, REST_HOST, () => {
  console.log(`[mock] REST listening on http://${REST_HOST}:${REST_PORT}/api`)
})

const { stop: stopWs } = startWsServer(state, WS_PORT, WS_HOST)
console.log(`[mock] WS listening on ws://${WS_HOST}:${WS_PORT}`)

function shutdown(signal: string) {
  console.log(`[mock] received ${signal}, shutting down...`)
  restServer.close(() => {
    stopWs()
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
