<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useProductDetailsStore } from '../stores/productDetails'
import { useCartStore } from '../stores/cart'

const props = defineProps<{ id: string }>()
const details = useProductDetailsStore()
const cart = useCartStore()

watch(
  () => props.id,
  (id) => {
    details.load(id)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  details.clear()
})
</script>

<template>
  <section class="space-y-4 sm:space-y-5">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight">Товар</h1>
      <p class="muted mt-1">ID: {{ props.id }}</p>
    </header>

    <div v-if="details.errorMessage" class="notice notice-error">
      <p>{{ details.errorMessage }}</p>
    </div>

    <div v-else-if="details.isLoading" class="card card-pad">
      <div class="aspect-[4/3] animate-pulse rounded bg-slate-100" />
      <div class="mt-4 h-4 w-2/3 animate-pulse rounded bg-slate-100" />
      <div class="mt-2 h-4 w-1/3 animate-pulse rounded bg-slate-100" />
    </div>

    <div v-else-if="details.product" class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div class="card overflow-hidden md:col-span-2">
        <div class="flex h-72 w-full items-center justify-center bg-slate-50 p-5 sm:h-80 sm:p-6">
          <img :src="details.product.image" alt="" class="max-h-full w-auto object-contain" />
        </div>
        <div class="space-y-3 p-4 sm:p-6">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-lg font-semibold tracking-tight text-slate-900">
                {{ details.product.name }}
              </h2>
              <p class="muted mt-1">{{ details.product.rarity }}</p>
            </div>
            <div class="text-right">
              <div data-testid="product-price" class="text-lg font-semibold text-slate-900">
                ${{ details.product.price }}
              </div>
              <div
                class="mt-1 text-sm"
                :class="details.product.inStock ? 'text-emerald-700' : 'text-red-700'"
              >
                {{ details.product.inStock ? 'В наличии' : 'Нет в наличии' }}
              </div>
            </div>
          </div>

          <div class="flex flex-wrap gap-1">
            <span v-for="t in details.product.tags" :key="t" class="badge">
              {{ t }}
            </span>
          </div>

          <button
            type="button"
            aria-label="Добавить в корзину"
            class="btn btn-primary"
            :disabled="!details.product.inStock"
            @click="cart.addFromProduct(details.product, 1)"
          >
            Добавить в корзину
          </button>
        </div>
      </div>

      <aside class="card card-pad md:col-span-1">
        <h3 class="text-sm font-semibold text-slate-900">Живые обновления</h3>
        <p class="mt-1 text-sm text-slate-700">
          Цена и наличие обновляются через WebSocket (если сервер запущен).
        </p>
        <p class="mt-3 text-xs text-slate-600">
          Последнее обновление:
          <span data-testid="live-updated-at" class="font-medium text-slate-900">
            {{ details.lastLiveUpdate ?? '—' }}
          </span>
        </p>
      </aside>
    </div>
  </section>
</template>
