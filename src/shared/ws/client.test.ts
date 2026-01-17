import { describe, expect, it, vi } from 'vitest'
import type { WsEvent } from './types'
import { WsClient } from './client'

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = []

  readonly url: string
  readyState = 0

  constructor(url: string) {
    super()
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send() {
    // no-op
  }

  close() {
    this.readyState = 3
    this.dispatchEvent(new CloseEvent('close'))
  }

  open() {
    this.readyState = 1
    this.dispatchEvent(new Event('open'))
  }

  message(data: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data }))
  }

  error() {
    this.dispatchEvent(new Event('error'))
  }
}

describe('WsClient', () => {
  it('connects, emits status changes, and forwards supported events', () => {
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)

    const events: WsEvent[] = []
    const statuses: string[] = []

    const client = new WsClient({
      url: 'ws://example.test',
      onEvent: (e) => events.push(e),
      onStatus: (s) => statuses.push(s.state),
    })

    client.start()
    expect(statuses[statuses.length - 1]).toBe('connecting')

    const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
    expect(ws?.url).toBe('ws://example.test')

    ws?.open()
    expect(statuses[statuses.length - 1]).toBe('open')

    ws?.message(JSON.stringify({ type: 'product.updated', data: { id: 'knife_001', changes: {} } }))
    ws?.message(JSON.stringify({ type: 'cart.synced', data: { cart: { items: [], subtotal: 0 } } }))
    ws?.message(JSON.stringify({ type: 'unknown.event', data: {} }))

    expect(events.map((e) => e.type)).toEqual(['product.updated', 'cart.synced'])
  })

  it('reconnects after close (when not stopped)', async () => {
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const client = new WsClient({
      url: 'ws://example.test',
      onEvent: () => undefined,
    })

    client.start()
    expect(FakeWebSocket.instances).toHaveLength(1)

    FakeWebSocket.instances[0]?.close()
    await vi.runOnlyPendingTimersAsync()

    expect(FakeWebSocket.instances.length).toBeGreaterThan(1)
  })

  it('does not reconnect after stop', async () => {
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const client = new WsClient({
      url: 'ws://example.test',
      onEvent: () => undefined,
    })

    client.start()
    expect(FakeWebSocket.instances).toHaveLength(1)
    FakeWebSocket.instances[0]?.close()

    client.stop()
    await vi.runOnlyPendingTimersAsync()

    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})
