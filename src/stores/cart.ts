import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { api } from '../shared/api'
import type { Cart, CartItem, Product } from '../shared/api/types'
import { ApiError } from '../shared/api/http'

export type CartAlert =
  | { type: 'outOfStock' }
  | { type: 'priceChanged'; oldPrice: number; newPrice: number; pendingQty?: number }

function recalcSubtotal(items: CartItem[]): number {
  return Number(items.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(2))
}

function extractNewPrice(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  const value = record.newPrice
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export const useCartStore = defineStore('cart', () => {
  const cart = ref<Cart | null>(null)
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)

  const alertsByProductId = ref<Record<string, CartAlert>>({})

  const isEmpty = computed(() => (cart.value?.items.length ?? 0) === 0)
  const items = computed(() => cart.value?.items ?? [])
  const subtotal = computed(() => cart.value?.subtotal ?? 0)
  const currency = computed(() => cart.value?.currency ?? 'USD')

  function setCart(next: Cart) {
    cart.value = next
  }

  function ensureCart(): Cart {
    if (cart.value) return cart.value
    cart.value = { items: [], subtotal: 0, currency: 'USD', updatedAt: new Date().toISOString() }
    return cart.value
  }

  async function load() {
    isLoading.value = true
    errorMessage.value = null
    try {
      setCart(await api.getCart())
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : 'Ошибка загрузки корзины'
    } finally {
      isLoading.value = false
    }
  }

  function optimisticAddFromProduct(product: Product, qty: number) {
    const c = ensureCart()
    const existing = c.items.find((i) => i.productId === product.id)

    if (existing) {
      existing.qty += qty
    } else {
      c.items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        qty,
        image: product.image,
        inStock: product.inStock,
      })
    }

    c.subtotal = recalcSubtotal(c.items)
    c.updatedAt = new Date().toISOString()
  }

  function optimisticUpdateQty(productId: string, qty: number) {
    const c = ensureCart()
    const item = c.items.find((i) => i.productId === productId)
    if (!item) return
    item.qty = qty
    c.subtotal = recalcSubtotal(c.items)
    c.updatedAt = new Date().toISOString()
  }

  function optimisticRemove(productId: string) {
    const c = ensureCart()
    c.items = c.items.filter((i) => i.productId !== productId)
    c.subtotal = recalcSubtotal(c.items)
    c.updatedAt = new Date().toISOString()
  }

  async function addFromProduct(product: Product, qty = 1) {
    errorMessage.value = null
    const snapshot = cart.value ? structuredClone(toRaw(cart.value)) : null

    optimisticAddFromProduct(product, qty)
    try {
      const serverCart = await api.cartAdd(product.id, qty)
      setCart(serverCart)
    } catch (e) {
      if (snapshot) setCart(snapshot)
      errorMessage.value = e instanceof Error ? e.message : 'Ошибка добавления в корзину'
      throw e
    }
  }

  async function updateQty(productId: string, qty: number) {
    errorMessage.value = null
    const snapshot = cart.value ? structuredClone(toRaw(cart.value)) : null

    optimisticUpdateQty(productId, qty)

    try {
      const serverCart = await api.cartUpdate(productId, qty)
      setCart(serverCart)
    } catch (e) {
      if (snapshot) setCart(snapshot)

      if (e instanceof ApiError && e.status === 409 && e.body?.error === 'PRICE_CHANGED') {
        const newPrice = extractNewPrice(e.body)
        if (newPrice !== null) {
          const oldPrice =
            cart.value?.items.find((i) => i.productId === productId)?.price ?? newPrice
          alertsByProductId.value = {
            ...alertsByProductId.value,
            [productId]: { type: 'priceChanged', oldPrice, newPrice, pendingQty: qty },
          }
        }
        return
      }

      errorMessage.value = e instanceof Error ? e.message : 'Ошибка обновления корзины'
      throw e
    }
  }

  async function remove(productId: string) {
    errorMessage.value = null
    const snapshot = cart.value ? structuredClone(toRaw(cart.value)) : null
    optimisticRemove(productId)

    try {
      const serverCart = await api.cartRemove(productId)
      setCart(serverCart)
      const next = { ...alertsByProductId.value }
      delete next[productId]
      alertsByProductId.value = next
    } catch (e) {
      if (snapshot) setCart(snapshot)
      errorMessage.value = e instanceof Error ? e.message : 'Ошибка удаления из корзины'
      throw e
    }
  }

  function applyProductUpdate(
    productId: string,
    changes: Partial<Pick<Product, 'price' | 'inStock'>>
  ) {
    if (!cart.value) return
    const item = cart.value.items.find((i) => i.productId === productId)
    if (!item) return

    if (typeof changes.inStock === 'boolean') {
      item.inStock = changes.inStock
      if (!changes.inStock) {
        alertsByProductId.value = {
          ...alertsByProductId.value,
          [productId]: { type: 'outOfStock' },
        }
      }
    }

    if (typeof changes.price === 'number' && changes.price !== item.price) {
      alertsByProductId.value = {
        ...alertsByProductId.value,
        [productId]: { type: 'priceChanged', oldPrice: item.price, newPrice: changes.price },
      }
    }
  }

  function clearAlerts(productId: string) {
    const next = { ...alertsByProductId.value }
    delete next[productId]
    alertsByProductId.value = next
  }

  async function confirmPriceChange(productId: string) {
    const alert = alertsByProductId.value[productId]
    if (!alert || alert.type !== 'priceChanged') return

    if (typeof alert.pendingQty === 'number') {
      errorMessage.value = null
      try {
        const serverCart = await api.cartUpdate(productId, alert.pendingQty)
        setCart(serverCart)
        clearAlerts(productId)
      } catch (e) {
        errorMessage.value = e instanceof Error ? e.message : 'Ошибка обновления корзины'
        throw e
      }
      return
    }

    if (!cart.value) return
    const item = cart.value.items.find((i) => i.productId === productId)
    if (!item) return

    item.price = alert.newPrice
    cart.value.subtotal = recalcSubtotal(cart.value.items)
    cart.value.updatedAt = new Date().toISOString()
    clearAlerts(productId)
  }

  function replaceFromServer(next: Cart) {
    setCart(next)
    alertsByProductId.value = {}
  }

  function clear() {
    cart.value = { items: [], subtotal: 0, currency: 'USD', updatedAt: new Date().toISOString() }
    alertsByProductId.value = {}
  }

  return {
    cart,
    items,
    subtotal,
    currency,
    isEmpty,
    isLoading,
    errorMessage,
    alertsByProductId,
    load,
    addFromProduct,
    updateQty,
    remove,
    applyProductUpdate,
    clearAlerts,
    confirmPriceChange,
    replaceFromServer,
    clear,
  }
})
