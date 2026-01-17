import type { Cart, Product } from '../api/types'

export type WsProductUpdatedEvent = {
  type: 'product.updated'
  data: {
    id: string
    changes: Partial<Pick<Product, 'price' | 'inStock' | 'updatedAt'>>
  }
}

export type WsCartSyncedEvent = {
  type: 'cart.synced'
  data: {
    cart: Cart
  }
}

export type WsEvent = WsProductUpdatedEvent | WsCartSyncedEvent
