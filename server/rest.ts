import { createRestApp } from './restApp.ts'
import { createState } from './state.ts'

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? process.env.REST_HOST ?? '127.0.0.1'

const state = createState()
const app = createRestApp(state)

const server = app.listen(PORT, HOST, () => {
  console.log(`[mock-rest] listening on http://${HOST}:${PORT}/api`)
})

function shutdown(signal: string) {
  console.log(`[mock-rest] received ${signal}, shutting down...`)
  server.close(() => process.exit(0))
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
