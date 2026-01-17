export type Rarity = 'consumer' | 'industrial' | 'mil-spec' | 'restricted' | 'classified' | 'covert'

export type Product = {
  id: string
  name: string
  price: number
  rarity: Rarity
  inStock: boolean
  tags: string[]
  image: string
  updatedAt: string
}

export type CartItem = {
  productId: string
  name: string
  price: number
  qty: number
  image: string
  inStock: boolean
}

export type Cart = {
  items: CartItem[]
  subtotal: number
  currency: string
  updatedAt: string
}

export type UserProfile = {
  id: string
  nickname: string
  avatar: string
}

export type AuthLoginRequest = {
  provider: 'mock'
  nickname: string
  avatar: string
}

export type AuthLoginResponse = {
  token: string
  user: UserProfile
}

export type ProductsListQuery = {
  q?: string
  min?: number
  max?: number
  inStock?: boolean
  rarity?: Rarity
  sort?: 'price_asc' | 'price_desc'
  page?: number
  limit?: number
}

export type ProductsListResponse = {
  items: Product[]
  total: number
  page: number
  limit: number
}

export type CheckoutRequest = {
  customer: { name: string; comment?: string }
  cart: Cart
}

export type CheckoutResponse = {
  orderId: string
}
