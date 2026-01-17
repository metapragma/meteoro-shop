<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCatalogStore } from '../stores/catalog'
import type { ProductsListQuery, Rarity } from '../shared/api/types'
import { useCartStore } from '../stores/cart'
import { useNotificationsStore } from '../shared/notifications/store'

const catalog = useCatalogStore()
const cart = useCartStore()
const notifications = useNotificationsStore()

const route = useRoute()
const router = useRouter()

const isFiltersOpen = ref(false)
const recentlyAddedIds = ref<Set<string>>(new Set())

const filters = reactive<{
  q: string
  min: string
  max: string
  inStock: boolean
  rarity: '' | Rarity
  sort: '' | 'price_asc' | 'price_desc'
  page: number
  limit: number
}>({
  q: '',
  min: '',
  max: '',
  inStock: false,
  rarity: '',
  sort: '',
  page: 1,
  limit: 20,
})

function parsePositiveInt(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

function parseNumber(value: unknown): number | null {
  if (typeof value !== 'string') return null
  if (value.trim().length === 0) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return n
}

function toQuery(): ProductsListQuery {
  const min = parseNumber(filters.min)
  const max = parseNumber(filters.max)

  return {
    q: filters.q.trim() || undefined,
    min: min ?? undefined,
    max: max ?? undefined,
    inStock: filters.inStock ? true : undefined,
    rarity: filters.rarity || undefined,
    sort: filters.sort || undefined,
    page: filters.page,
    limit: filters.limit,
  }
}

function syncFromRoute() {
  filters.q = typeof route.query.q === 'string' ? route.query.q : ''
  filters.min = typeof route.query.min === 'string' ? route.query.min : ''
  filters.max = typeof route.query.max === 'string' ? route.query.max : ''
  filters.inStock = route.query.inStock === 'true'

  filters.rarity = typeof route.query.rarity === 'string' ? (route.query.rarity as Rarity) : ''
  filters.sort =
    route.query.sort === 'price_asc' || route.query.sort === 'price_desc' ? route.query.sort : ''

  filters.page = parsePositiveInt(route.query.page) ?? 1
  filters.limit = parsePositiveInt(route.query.limit) ?? 20
}

function syncToRoute(partial?: Partial<ProductsListQuery>) {
  const next = { ...toQuery(), ...(partial ?? {}) }

  const query: Record<string, string> = {}
  if (next.q) query.q = next.q
  if (typeof next.min === 'number') query.min = String(next.min)
  if (typeof next.max === 'number') query.max = String(next.max)
  if (typeof next.inStock === 'boolean') query.inStock = String(next.inStock)
  if (next.rarity) query.rarity = next.rarity
  if (next.sort) query.sort = next.sort
  if (next.page && next.page !== 1) query.page = String(next.page)
  if (next.limit && next.limit !== 20) query.limit = String(next.limit)

  router.replace({ query })
}

let searchTimer: number | null = null
watch(
  () => filters.q,
  () => {
    if (searchTimer !== null) window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => {
      filters.page = 1
      syncToRoute({ page: 1 })
    }, 350)
  }
)

watch(
  () => [filters.min, filters.max, filters.inStock, filters.rarity, filters.sort, filters.limit],
  () => {
    filters.page = 1
    syncToRoute({ page: 1 })
  }
)

watch(
  () => route.query,
  () => {
    syncFromRoute()
    catalog.fetchProducts(toQuery())
  },
  { immediate: true }
)

const totalLabel = computed(() =>
  catalog.isLoading ? 'Загрузка…' : `Найдено товаров: ${catalog.total}`
)

const totalPages = computed(() => {
  const pages = Math.ceil(catalog.total / Math.max(filters.limit, 1))
  return Math.max(pages, 1)
})

const pageLabel = computed(() => `${filters.page} / ${totalPages.value}`)

function goToPage(page: number) {
  const safe = Math.min(Math.max(page, 1), totalPages.value)
  filters.page = safe
  syncToRoute({ page: safe })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function markRecentlyAdded(productId: string) {
  recentlyAddedIds.value = new Set(recentlyAddedIds.value).add(productId)
  window.setTimeout(() => {
    const next = new Set(recentlyAddedIds.value)
    next.delete(productId)
    recentlyAddedIds.value = next
  }, 1200)
}

function isRecentlyAdded(productId: string) {
  return recentlyAddedIds.value.has(productId)
}

async function handleAddToCart(productId: string) {
  const product = catalog.items.find((p) => p.id === productId)
  if (!product) return
  try {
    await cart.addFromProduct(product, 1)
    markRecentlyAdded(productId)
    notifications.push('success', 'Добавлено в корзину')
  } catch {
    notifications.push('error', 'Не удалось добавить в корзину')
  }
}
</script>

<template>
  <section class="space-y-4 sm:space-y-5">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <h1 class="text-2xl font-semibold tracking-tight">Каталог</h1>
        <p class="muted mt-1">{{ totalLabel }}</p>
      </div>

      <div class="w-full sm:w-80">
        <label class="label" for="q">Поиск</label>
        <input id="q" v-model="filters.q" type="text" class="input" placeholder="По названию…" />
      </div>
    </header>

    <div class="card">
      <div class="flex items-center justify-between px-4 py-2.5 sm:hidden">
        <div class="text-sm font-medium text-slate-900">Фильтры</div>
        <button
          type="button"
          class="btn btn-secondary px-3 py-1.5"
          aria-label="Показать или скрыть фильтры"
          @click="isFiltersOpen = !isFiltersOpen"
        >
          {{ isFiltersOpen ? 'Скрыть' : 'Показать' }}
        </button>
      </div>

      <div
        class="grid grid-cols-1 gap-3 border-t border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        :class="isFiltersOpen ? '' : 'hidden sm:grid'"
      >
        <div class="lg:col-span-1">
          <label class="label" for="min">Мин. цена</label>
          <input
            id="min"
            v-model="filters.min"
            inputmode="decimal"
            type="text"
            class="input"
            placeholder="0"
          />
        </div>
        <div class="lg:col-span-1">
          <label class="label" for="max">Макс. цена</label>
          <input
            id="max"
            v-model="filters.max"
            inputmode="decimal"
            type="text"
            class="input"
            placeholder="999"
          />
        </div>
        <div class="lg:col-span-1">
          <label class="label" for="sort">Сортировка</label>
          <select id="sort" v-model="filters.sort" class="select">
            <option value="">По умолчанию</option>
            <option value="price_asc">Цена ↑</option>
            <option value="price_desc">Цена ↓</option>
          </select>
        </div>
        <div class="lg:col-span-2 xl:col-span-2">
          <label class="label" for="rarity">Редкость</label>
          <select id="rarity" v-model="filters.rarity" class="select">
            <option value="">Любая</option>
            <option value="consumer">consumer</option>
            <option value="industrial">industrial</option>
            <option value="mil-spec">mil-spec</option>
            <option value="restricted">restricted</option>
            <option value="classified">classified</option>
            <option value="covert">covert</option>
          </select>
        </div>
        <div class="sm:col-span-2 lg:col-span-1">
          <label class="label" for="limit">На странице</label>
          <select id="limit" v-model.number="filters.limit" class="select">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
        </div>
        <div class="flex items-center gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-6">
          <input
            id="inStock"
            v-model="filters.inStock"
            type="checkbox"
            class="h-4 w-4 rounded border-slate-300"
          />
          <label for="inStock" class="text-sm text-slate-700">Только в наличии</label>
          <button
            type="button"
            class="btn btn-secondary ml-auto px-3 py-1.5"
            aria-label="Сбросить фильтры"
            @click="router.replace({ query: {} })"
          >
            Сбросить
          </button>
        </div>
      </div>
    </div>

    <div v-if="catalog.errorMessage" class="notice notice-error">
      <p>{{ catalog.errorMessage }}</p>
      <p class="mt-1 text-xs opacity-80">Проверьте, что мок-сервер запущен.</p>
    </div>

    <div v-else-if="catalog.isLoading" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 9" :key="i" class="card h-36 animate-pulse" />
    </div>

    <div v-else-if="!catalog.hasResults" class="card card-pad text-sm text-slate-700">
      Нет товаров по заданным условиям.
    </div>

    <div v-else class="space-y-3">
      <div
        class="card flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="text-sm text-slate-700">
          Страница: <span class="font-medium text-slate-900">{{ pageLabel }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn btn-secondary px-3 py-1.5"
            aria-label="Предыдущая страница"
            :disabled="filters.page <= 1"
            @click="goToPage(filters.page - 1)"
          >
            Назад
          </button>
          <button
            type="button"
            class="btn btn-secondary px-3 py-1.5"
            aria-label="Следующая страница"
            :disabled="filters.page >= totalPages"
            @click="goToPage(filters.page + 1)"
          >
            Вперёд
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="p in catalog.items"
          :key="p.id"
          class="card card-hover overflow-hidden transition"
          :class="isRecentlyAdded(p.id) ? 'ring-1 ring-slate-900/10' : ''"
          :data-testid="`catalog-card-${p.id}`"
        >
          <div class="flex h-44 w-full items-center justify-center bg-slate-50 p-4 sm:h-48">
            <img :src="p.image" alt="" class="max-h-full w-auto object-contain" />
          </div>
          <div class="space-y-2 p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-sm font-semibold text-slate-900">{{ p.name }}</h2>
                <p class="mt-1 text-xs text-slate-600">{{ p.id }}</p>
              </div>
              <div class="text-right">
                <div class="text-sm font-semibold text-slate-900">${{ p.price }}</div>
                <div class="mt-1 text-xs" :class="p.inStock ? 'text-emerald-700' : 'text-red-700'">
                  {{ p.inStock ? 'В наличии' : 'Нет в наличии' }}
                </div>
              </div>
            </div>
            <div class="flex flex-wrap gap-1">
              <span class="badge">{{ p.rarity }}</span>
              <span v-for="t in p.tags" :key="t" class="badge">
                {{ t }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-3 pt-1">
              <RouterLink
                class="text-sm font-medium text-slate-900 hover:underline"
                :to="`/product/${encodeURIComponent(p.id)}`"
              >
                Открыть
              </RouterLink>
              <div class="flex items-center gap-2">
                <span
                  v-if="isRecentlyAdded(p.id)"
                  class="text-xs font-medium text-slate-700"
                  :data-testid="`catalog-added-${p.id}`"
                >
                  Добавлено
                </span>
                <button
                  type="button"
                  aria-label="В корзину"
                  class="btn btn-primary px-3 py-1.5"
                  :disabled="!p.inStock"
                  :data-testid="`catalog-add-to-cart-${p.id}`"
                  @click="handleAddToCart(p.id)"
                >
                  В корзину
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
