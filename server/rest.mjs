import express from 'express'
import cors from 'cors'

const PORT = Number(process.env.PORT ?? 3000)

const app = express()

app.disable('x-powered-by')

app.use(
  cors({
    origin: true,
    credentials: true,
  })
)
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// Placeholder routes (implemented in later tasks).
app.use('/api', (_req, res) => {
  res.status(501).json({
    error: 'NOT_IMPLEMENTED',
    message: 'Mock API endpoint is not implemented yet',
  })
})

// Not found handler (non-/api routes)
app.use((_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Not found' })
})

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'INTERNAL', message: 'Internal server error' })
})

const server = app.listen(PORT, () => {
  console.log(`[mock-rest] listening on http://localhost:${PORT}/api`)
})

function shutdown(signal) {
  console.log(`[mock-rest] received ${signal}, shutting down...`)
  server.close(() => process.exit(0))
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
