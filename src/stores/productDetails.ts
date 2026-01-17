import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '../shared/api'
import type { Product } from '../shared/api/types'

export const useProductDetailsStore = defineStore('productDetails', () => {
  const product = ref<Product | null>(null)
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)
  const lastLiveUpdate = ref<string | null>(null)

  const hasProduct = computed(() => product.value !== null)

  async function load(id: string) {
    isLoading.value = true
    errorMessage.value = null
    try {
      product.value = await api.getProduct(id)
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : 'Ошибка загрузки товара'
      product.value = null
    } finally {
      isLoading.value = false
    }
  }

  function clear() {
    product.value = null
    isLoading.value = false
    errorMessage.value = null
    lastLiveUpdate.value = null
  }

  function applyProductPatch(
    productId: string,
    changes: Partial<Pick<Product, 'price' | 'inStock' | 'updatedAt'>>
  ) {
    if (!product.value || product.value.id !== productId) return
    product.value = { ...product.value, ...changes }
    lastLiveUpdate.value = new Date().toISOString()
  }

  return {
    product,
    hasProduct,
    isLoading,
    errorMessage,
    lastLiveUpdate,
    load,
    clear,
    applyProductPatch,
  }
})
