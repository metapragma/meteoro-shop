import { describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from './http'

describe('apiRequest', () => {
  it('builds /api URL by default and returns parsed JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest<{ ok: boolean }>('/health')).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({
        headers: expect.objectContaining({ 'content-type': 'application/json' }),
      })
    )
  })

  it('returns undefined for 204 responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => '',
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest<void>('/auth/logout', { method: 'POST' })).resolves.toBeUndefined()
  })

  it('throws ApiError with body details for non-2xx responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () =>
        JSON.stringify({ error: 'PRODUCT_NOT_FOUND', message: 'Product not found' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/products/unknown')).rejects.toBeInstanceOf(ApiError)
    await expect(apiRequest('/products/unknown')).rejects.toMatchObject({
      status: 404,
      body: { error: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
    })
  })
})
