import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Cart } from '../shared/api/types'
import { ApiError } from '../shared/api/http'
import { useCartStore } from './cart'

vi.mock('../shared/api', () => {
  return {
    api: {
      getCart: vi.fn(),
      cartAdd: vi.fn(),
      cartUpdate: vi.fn(),
      cartRemove: vi.fn(),
    },
  }
})

import { api } from '../shared/api'

function makeCart(overrides?: Partial<Cart>): Cart {
  return {
    items: [],
    subtotal: 0,
    currency: 'USD',
    updatedAt: '2025-08-21T10:00:00Z',
    ...(overrides ?? {}),
  }
}

describe('cart store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(api.getCart).mockReset()
    vi.mocked(api.cartAdd).mockReset()
    vi.mocked(api.cartUpdate).mockReset()
    vi.mocked(api.cartRemove).mockReset()
  })

  it('rolls back optimistic add on API error', async () => {
    const cart = useCartStore()
    cart.replaceFromServer(makeCart())

    vi.mocked(api.cartAdd).mockRejectedValueOnce(new Error('fail'))

    await expect(
      cart.addFromProduct(
        {
          id: 'knife_001',
          name: 'Test Knife',
          price: 10,
          rarity: 'covert',
          inStock: true,
          tags: ['knife'],
          image: '/img.png',
          updatedAt: '2025-08-01T00:00:00Z',
        },
        1
      )
    ).rejects.toBeInstanceOf(Error)

    expect(cart.items).toHaveLength(0)
    expect(cart.subtotal).toBe(0)
  })

  it('requires confirmation when API reports PRICE_CHANGED', async () => {
    const cart = useCartStore()

    cart.replaceFromServer(
      makeCart({
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
      })
    )

    vi.mocked(api.cartUpdate)
      .mockRejectedValueOnce(
        new ApiError(409, 'PRICE_CHANGED', { error: 'PRICE_CHANGED', newPrice: 12.5 })
      )
      .mockResolvedValueOnce(
        makeCart({
          items: [
            {
              productId: 'knife_001',
              name: 'Test Knife',
              price: 12.5,
              qty: 2,
              image: '/img.png',
              inStock: true,
            },
          ],
          subtotal: 25,
        })
      )

    await expect(cart.updateQty('knife_001', 2)).resolves.toBeUndefined()

    expect(cart.alertsByProductId['knife_001']).toEqual({
      type: 'priceChanged',
      oldPrice: 10,
      newPrice: 12.5,
      pendingQty: 2,
    })
    expect(cart.items[0]?.price).toBe(10)
    expect(cart.items[0]?.qty).toBe(1)

    await expect(cart.confirmPriceChange('knife_001')).resolves.toBeUndefined()
    expect(cart.alertsByProductId['knife_001']).toBeUndefined()
    expect(cart.items[0]?.price).toBe(12.5)
    expect(cart.items[0]?.qty).toBe(2)
  })

  it('marks out-of-stock and price-change alerts on WS product updates', async () => {
    const cart = useCartStore()
    cart.replaceFromServer(
      makeCart({
        items: [
          {
            productId: 'knife_001',
            name: 'Test Knife',
            price: 10,
            qty: 2,
            image: '/img.png',
            inStock: true,
          },
        ],
        subtotal: 20,
      })
    )

    cart.applyProductUpdate('knife_001', { inStock: false })
    expect(cart.alertsByProductId['knife_001']).toEqual({ type: 'outOfStock' })

    cart.applyProductUpdate('knife_001', { price: 11 })
    expect(cart.alertsByProductId['knife_001']).toEqual({
      type: 'priceChanged',
      oldPrice: 10,
      newPrice: 11,
    })
    await expect(cart.confirmPriceChange('knife_001')).resolves.toBeUndefined()
    expect(cart.items[0]?.price).toBe(11)
    expect(cart.subtotal).toBe(22)
  })
})
