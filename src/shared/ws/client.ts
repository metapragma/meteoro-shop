import type { WsEvent } from './types'

export type WsClientOptions = {
  url: string
  onEvent: (event: WsEvent) => void
  onStatus?: (status: WsStatus) => void
}

export type WsStatus =
  | { state: 'connecting' }
  | { state: 'open' }
  | { state: 'closed' }
  | { state: 'error'; message: string }

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function computeBackoffMs(attempt: number) {
  const base = 500
  const cap = 10_000
  const exp = Math.min(cap, base * 2 ** Math.min(attempt, 6))
  const jitter = Math.random() * 250
  return Math.floor(exp + jitter)
}

export class WsClient {
  private readonly url: string
  private readonly onEvent: (event: WsEvent) => void
  private readonly onStatus?: (status: WsStatus) => void
  private socket: WebSocket | null = null
  private reconnectAttempt = 0
  private reconnectTimer: number | null = null
  private isStopped = false

  constructor(opts: WsClientOptions) {
    this.url = opts.url
    this.onEvent = opts.onEvent
    this.onStatus = opts.onStatus
  }

  start() {
    this.isStopped = false
    this.connect()
  }

  stop() {
    this.isStopped = true
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.socket?.close()
    this.socket = null
    this.onStatus?.({ state: 'closed' })
  }

  private connect() {
    if (this.isStopped) return
    this.onStatus?.({ state: 'connecting' })

    const socket = new WebSocket(this.url)
    this.socket = socket

    socket.addEventListener('open', () => {
      this.reconnectAttempt = 0
      this.onStatus?.({ state: 'open' })
    })

    socket.addEventListener('message', (e) => {
      const data = typeof e.data === 'string' ? safeParseJson(e.data) : null
      if (!data || typeof data !== 'object') return
      const event = data as WsEvent
      if (event.type !== 'product.updated' && event.type !== 'cart.synced') return
      this.onEvent(event)
    })

    socket.addEventListener('close', () => {
      this.socket = null
      this.onStatus?.({ state: 'closed' })
      this.scheduleReconnect()
    })

    socket.addEventListener('error', () => {
      this.onStatus?.({ state: 'error', message: 'WebSocket error' })
      // close will trigger reconnect
    })
  }

  private scheduleReconnect() {
    if (this.isStopped) return
    if (this.reconnectTimer !== null) return
    const ms = computeBackoffMs(this.reconnectAttempt)
    this.reconnectAttempt += 1
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, ms)
  }
}
