import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProductDetailsStore } from './productDetails'

vi.mock('../shared/api', () => {
  return {
    api: {
      getProduct: vi.fn(),
    },
  }
})

import { api } from '../shared/api'

describe('product details store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(api.getProduct).mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-08-21T10:00:00Z'))
  })

  it('loads product', async () => {
    vi.mocked(api.getProduct).mockResolvedValueOnce({
      id: 'knife_001',
      name: 'Crimson Edge',
      price: 129.99,
      rarity: 'covert',
      inStock: true,
      tags: ['knife'],
      image: '/img.png',
      updatedAt: '2025-08-01T00:00:00Z',
    })

    const details = useProductDetailsStore()
    await expect(details.load('knife_001')).resolves.toBeUndefined()
    expect(details.product?.id).toBe('knife_001')
    expect(details.errorMessage).toBeNull()
  })

  it('sets errorMessage on load error', async () => {
    vi.mocked(api.getProduct).mockRejectedValueOnce(new Error('not found'))

    const details = useProductDetailsStore()
    await details.load('knife_001')
    expect(details.product).toBeNull()
    expect(details.errorMessage).toBe('not found')
  })

  it('applies live patch only to current product and updates lastLiveUpdate', async () => {
    vi.mocked(api.getProduct).mockResolvedValueOnce({
      id: 'knife_001',
      name: 'Crimson Edge',
      price: 129.99,
      rarity: 'covert',
      inStock: true,
      tags: ['knife'],
      image: '/img.png',
      updatedAt: '2025-08-01T00:00:00Z',
    })

    const details = useProductDetailsStore()
    await details.load('knife_001')

    details.applyProductPatch('knife_002', { price: 1 })
    expect(details.product?.price).toBe(129.99)
    expect(details.lastLiveUpdate).toBeNull()

    details.applyProductPatch('knife_001', { price: 199.99, updatedAt: '2025-08-21T10:00:00Z' })
    expect(details.product?.price).toBe(199.99)
    expect(details.lastLiveUpdate).toBe('2025-08-21T10:00:00.000Z')
  })
})
