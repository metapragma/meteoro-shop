import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useRealtimeStore } from './realtime'
import { useCatalogStore } from './catalog'
import { useCartStore } from './cart'
import { useProductDetailsStore } from './productDetails'
import { useNotificationsStore } from '../shared/notifications/store'
import type { WsEvent } from '../shared/ws/types'

type WsStatus = { state: 'connecting' | 'open' | 'closed' | 'error' }
type WsClientOptions = {
  url: string
  onEvent: (event: WsEvent) => void
  onStatus: (status: WsStatus) => void
}

let lastWsClientOptions: WsClientOptions | null = null

vi.mock('../shared/ws/client', () => {
  class WsClient {
    private readonly options: WsClientOptions

    constructor(options: WsClientOptions) {
      lastWsClientOptions = options
      this.options = options
    }

    start() {
      this.options.onStatus({ state: 'connecting' })
      this.options.onStatus({ state: 'open' })
    }

    stop() {
      this.options.onStatus({ state: 'closed' })
    }
  }

  return { WsClient }
})

describe('realtime store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    lastWsClientOptions = null
  })

  it('updates status on start/stop', () => {
    const realtime = useRealtimeStore()
    expect(realtime.status).toBe('idle')

    realtime.start()
    expect(realtime.status).toBe('open')

    realtime.stop()
    expect(realtime.status).toBe('idle')
  })

  it('routes product.updated patches to stores', () => {
    const catalog = useCatalogStore()
    const productDetails = useProductDetailsStore()
    const cart = useCartStore()
    const notifications = useNotificationsStore()

    catalog.items = [
      {
        id: 'knife_001',
        name: 'Test Knife',
        price: 10,
        rarity: 'covert',
        inStock: true,
        tags: [],
        image: '/img.png',
        updatedAt: '2025-08-01T00:00:00Z',
      },
    ]
    productDetails.product = {
      id: 'knife_001',
      name: 'Test Knife',
      price: 10,
      rarity: 'covert',
      inStock: true,
      tags: [],
      image: '/img.png',
      updatedAt: '2025-08-01T00:00:00Z',
    }
    cart.replaceFromServer({
      items: [
        {
          productId: 'knife_001',
          name: 'Test Knife',
          price: 10,
          qty: 1,
          image: '/img.png',
          inStock: true,
        },
      ],
      subtotal: 10,
      currency: 'USD',
      updatedAt: '2025-08-21T10:00:00Z',
    })

    const realtime = useRealtimeStore()
    realtime.start()

    expect(lastWsClientOptions).not.toBeNull()
    lastWsClientOptions!.onEvent({
      type: 'product.updated',
      data: { id: 'knife_001', changes: { inStock: false, updatedAt: '2025-08-21T10:05:00Z' } },
    })
    expect(cart.alertsByProductId['knife_001']).toEqual({ type: 'outOfStock' })

    lastWsClientOptions!.onEvent({
      type: 'product.updated',
      data: { id: 'knife_001', changes: { price: 12, updatedAt: '2025-08-21T10:05:01Z' } },
    })

    expect(catalog.items[0]?.price).toBe(12)
    expect(productDetails.product?.price).toBe(12)
    expect(cart.alertsByProductId['knife_001']).toEqual({
      type: 'priceChanged',
      oldPrice: 10,
      newPrice: 12,
    })
    expect(notifications.items).toHaveLength(0)
  })

  it('replaces cart and shows a notification on cart.synced', () => {
    const cart = useCartStore()
    const notifications = useNotificationsStore()

    const realtime = useRealtimeStore()
    realtime.start()

    lastWsClientOptions!.onEvent({
      type: 'cart.synced',
      data: {
        cart: {
          items: [
            {
              productId: 'knife_002',
              name: 'Another Knife',
              price: 99,
              qty: 1,
              image: '/img.png',
              inStock: true,
            },
          ],
          subtotal: 99,
          currency: 'USD',
          updatedAt: '2025-08-21T10:07:00Z',
        },
      },
    })

    expect(cart.items).toHaveLength(1)
    expect(cart.items[0]?.productId).toBe('knife_002')
    expect(notifications.sorted[notifications.sorted.length - 1]?.message).toBe('Корзина обновлена')
  })
})
