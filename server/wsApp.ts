import { WebSocketServer } from 'ws'
import {
  applyProductChanges,
  getCart,
  isoNow,
  pickRandomProduct,
  type ProductChanges,
  type State,
} from './state.ts'

type WsEvent =
  | {
      type: 'product.updated'
      data: { id: string; changes: ProductChanges }
    }
  | {
      type: 'cart.synced'
      data: { cart: ReturnType<typeof getCart> }
    }

function safeJsonStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max)
}

function wsProductIntervalMs() {
  const raw = Number(process.env.WS_PRODUCT_UPDATE_INTERVAL_MS ?? 5000)
  if (!Number.isFinite(raw) || raw < 500) return 5000
  return Math.floor(raw)
}

function wsCartIntervalMs() {
  const raw = Number(process.env.WS_CART_SYNC_INTERVAL_MS ?? 15000)
  if (!Number.isFinite(raw) || raw < 500) return 15000
  return Math.floor(raw)
}

export function startWsServer(state: State, port: number, host = '127.0.0.1') {
  const wss = new WebSocketServer({ port, host })

  const clients = new Set<WebSocket>()

  function broadcast(event: WsEvent) {
    const json = safeJsonStringify(event)
    if (!json) return
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) ws.send(json)
    }
  }

  function emitProductUpdated(productId: string, changes: ProductChanges) {
    broadcast({
      type: 'product.updated',
      data: { id: productId, changes },
    })
  }

  function emitCartSynced() {
    broadcast({
      type: 'cart.synced',
      data: { cart: getCart(state) },
    })
  }

  function simulateProductUpdate() {
    const product = pickRandomProduct(state)
    if (!product) return

    const shouldToggleStock = Math.random() < 0.25
    const shouldChangePrice = Math.random() < 0.8

    const changes: ProductChanges = { updatedAt: isoNow() }

    if (shouldToggleStock) {
      changes.inStock = !product.inStock
    }

    if (shouldChangePrice) {
      const delta = 1 + (Math.random() * 0.2 - 0.1) // -10%..+10%
      const newPrice = Number(clamp(product.price * delta, 0.99, 99999).toFixed(2))
      changes.price = newPrice
    }

    applyProductChanges(state, product.id, changes)
    emitProductUpdated(product.id, changes)
  }

  wss.on('connection', (ws) => {
    clients.add(ws)

    ws.on('message', (raw) => {
      if (process.env.WS_DEBUG !== '1') return
      const text = typeof raw === 'string' ? raw : raw.toString()
      const data = safeParseJson(text)
      if (!data || typeof data !== 'object') return
      const record = data as Record<string, unknown>

      if (record.type === 'debug.product.update') {
        const payload = record.data as Record<string, unknown> | undefined
        const id = typeof payload?.id === 'string' ? payload.id : null
        if (!id) return
        const changes = (payload?.changes ?? {}) as ProductChanges
        const merged: ProductChanges = { ...changes, updatedAt: isoNow() }
        const updated = applyProductChanges(state, id, merged)
        if (!updated) return
        emitProductUpdated(id, merged)
      }

      if (record.type === 'debug.cart.sync') {
        emitCartSynced()
      }
    })

    ws.on('close', () => {
      clients.delete(ws)
    })

    ws.on('error', () => {
      clients.delete(ws)
    })
  })

  const productTimer = setInterval(simulateProductUpdate, wsProductIntervalMs())
  const cartTimer = setInterval(emitCartSynced, wsCartIntervalMs())

  function stop() {
    clearInterval(productTimer)
    clearInterval(cartTimer)
    for (const ws of clients) ws.close()
    clients.clear()
    wss.close()
  }

  return { wss, stop }
}
