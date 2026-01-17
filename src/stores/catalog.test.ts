import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCatalogStore } from './catalog'
import type { ProductsListResponse } from '../shared/api/types'

vi.mock('../shared/api', () => {
  return {
    api: {
      listProducts: vi.fn(),
    },
  }
})

import { api } from '../shared/api'

const response: ProductsListResponse = {
  items: [
    {
      id: 'knife_001',
      name: 'Crimson Edge',
      price: 129.99,
      rarity: 'covert',
      inStock: true,
      tags: ['knife', 'limited'],
      image: '/images/knife_001.png',
      updatedAt: '2025-08-01T12:00:00Z',
    },
  ],
  total: 87,
  page: 2,
  limit: 20,
}

describe('catalog store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(api.listProducts).mockReset()
  })

  it('fetches and stores products', async () => {
    vi.mocked(api.listProducts).mockResolvedValueOnce(response)

    const catalog = useCatalogStore()
    await expect(catalog.fetchProducts({ page: 2, limit: 20 })).resolves.toBeUndefined()

    expect(catalog.items).toHaveLength(1)
    expect(catalog.total).toBe(87)
    expect(catalog.page).toBe(2)
    expect(catalog.limit).toBe(20)
    expect(catalog.errorMessage).toBeNull()
  })

  it('clears items and sets errorMessage on fetch error', async () => {
    vi.mocked(api.listProducts).mockRejectedValueOnce(new Error('boom'))

    const catalog = useCatalogStore()
    await catalog.fetchProducts({ page: 1, limit: 20 })

    expect(catalog.items).toHaveLength(0)
    expect(catalog.total).toBe(0)
    expect(catalog.errorMessage).toBe('boom')
  })

  it('applies product patch in-place', async () => {
    vi.mocked(api.listProducts).mockResolvedValueOnce(response)
    const catalog = useCatalogStore()
    await catalog.fetchProducts({ page: 2, limit: 20 })

    catalog.applyProductPatch('knife_001', { price: 199.99, inStock: false })
    expect(catalog.items[0]?.price).toBe(199.99)
    expect(catalog.items[0]?.inStock).toBe(false)
  })
})
