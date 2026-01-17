import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '../shared/api'
import type { Product, ProductsListQuery, ProductsListResponse, Rarity } from '../shared/api/types'

export type CatalogState = {
  items: Product[]
  total: number
  page: number
  limit: number
  isLoading: boolean
  errorMessage: string | null
}

export const useCatalogStore = defineStore('catalog', () => {
  const items = ref<Product[]>([])
  const total = ref(0)
  const page = ref(1)
  const limit = ref(20)
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)

  const hasResults = computed(() => items.value.length > 0)

  async function fetchProducts(query: ProductsListQuery) {
    isLoading.value = true
    errorMessage.value = null
    try {
      const res: ProductsListResponse = await api.listProducts(query)
      items.value = res.items
      total.value = res.total
      page.value = res.page
      limit.value = res.limit
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : 'Ошибка загрузки каталога'
      items.value = []
      total.value = 0
    } finally {
      isLoading.value = false
    }
  }

  function applyProductPatch(
    productId: string,
    changes: Partial<Pick<Product, 'price' | 'inStock' | 'updatedAt'>>
  ) {
    const idx = items.value.findIndex((p) => p.id === productId)
    if (idx === -1) return
    const current = items.value[idx]
    if (!current) return
    items.value[idx] = { ...current, ...changes }
  }

  function clear() {
    items.value = []
    total.value = 0
    page.value = 1
    limit.value = 20
    errorMessage.value = null
    isLoading.value = false
  }

  return {
    items,
    total,
    page,
    limit,
    isLoading,
    errorMessage,
    hasResults,
    fetchProducts,
    applyProductPatch,
    clear,
  }
})

export const RARITY_OPTIONS: { value: Rarity; label: string }[] = [
  { value: 'consumer', label: 'consumer' },
  { value: 'industrial', label: 'industrial' },
  { value: 'mil-spec', label: 'mil-spec' },
  { value: 'restricted', label: 'restricted' },
  { value: 'classified', label: 'classified' },
  { value: 'covert', label: 'covert' },
]
