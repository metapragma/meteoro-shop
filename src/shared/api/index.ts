import { apiRequest } from './http'
import type {
  AuthLoginRequest,
  AuthLoginResponse,
  Cart,
  CheckoutRequest,
  CheckoutResponse,
  Product,
  ProductsListQuery,
  ProductsListResponse,
} from './types'

function toQueryString(query: ProductsListQuery): string {
  const params = new URLSearchParams()

  if (query.q) params.set('q', query.q)
  if (typeof query.min === 'number') params.set('min', String(query.min))
  if (typeof query.max === 'number') params.set('max', String(query.max))
  if (typeof query.inStock === 'boolean') params.set('inStock', String(query.inStock))
  if (query.rarity) params.set('rarity', query.rarity)
  if (query.sort) params.set('sort', query.sort)
  if (typeof query.page === 'number') params.set('page', String(query.page))
  if (typeof query.limit === 'number') params.set('limit', String(query.limit))

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const api = {
  login(body: AuthLoginRequest) {
    return apiRequest<AuthLoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
  logout() {
    return apiRequest<void>('/auth/logout', { method: 'POST', body: '{}' })
  },

  listProducts(query: ProductsListQuery) {
    return apiRequest<ProductsListResponse>(`/products${toQueryString(query)}`)
  },
  getProduct(id: string) {
    return apiRequest<Product>(`/products/${encodeURIComponent(id)}`)
  },

  getCart() {
    return apiRequest<Cart>('/cart')
  },
  cartAdd(productId: string, qty: number) {
    return apiRequest<Cart>('/cart/add', {
      method: 'POST',
      body: JSON.stringify({ productId, qty }),
    })
  },
  cartUpdate(productId: string, qty: number) {
    return apiRequest<Cart>('/cart/update', {
      method: 'POST',
      body: JSON.stringify({ productId, qty }),
    })
  },
  cartRemove(productId: string) {
    return apiRequest<Cart>('/cart/remove', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    })
  },

  checkout(body: CheckoutRequest) {
    return apiRequest<CheckoutResponse>('/checkout', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
}
