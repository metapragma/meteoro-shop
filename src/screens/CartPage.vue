<script setup lang="ts">
import { onMounted } from 'vue'
import { useCartStore } from '../stores/cart'
import { useNotificationsStore } from '../shared/notifications/store'

const cart = useCartStore()
const notifications = useNotificationsStore()

onMounted(() => {
  cart.load()
})

async function handleRemove(productId: string) {
  try {
    await cart.remove(productId)
  } catch {
    notifications.push('error', 'Не удалось удалить товар из корзины')
  }
}

async function handleUpdateQty(productId: string, qty: number) {
  try {
    await cart.updateQty(productId, qty)
  } catch {
    notifications.push('error', 'Не удалось обновить количество')
  }
}

function alertText(productId: string) {
  const alert = cart.alertsByProductId[productId]
  if (!alert) return null
  if (alert.type === 'outOfStock') return 'Товар закончился. Подтвердите действие.'
  return `Цена изменилась с $${alert.oldPrice} на $${alert.newPrice}. Подтвердите пересчёт.`
}

function getAlert(productId: string) {
  return cart.alertsByProductId[productId] ?? null
}

async function handleConfirmPrice(productId: string) {
  try {
    await cart.confirmPriceChange(productId)
  } catch {
    notifications.push('error', 'Не удалось подтвердить пересчёт цены')
  }
}
</script>

<template>
  <section class="mx-auto max-w-4xl space-y-4 sm:space-y-5">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Корзина</h1>
        <p class="muted mt-1">
          Итого: <span class="font-semibold text-slate-900">{{ cart.subtotal }}</span>
          {{ cart.currency }}
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <RouterLink
          to="/checkout"
          class="btn btn-primary px-3 py-1.5"
          aria-label="Перейти к оформлению"
        >
          К оформлению
        </RouterLink>
        <RouterLink
          to="/catalog"
          class="btn btn-secondary px-3 py-1.5"
          aria-label="Перейти в каталог"
        >
          В каталог
        </RouterLink>
      </div>
    </header>

    <div v-if="cart.errorMessage" class="notice notice-error">
      <p>{{ cart.errorMessage }}</p>
    </div>

    <div v-if="cart.isLoading" class="grid grid-cols-1 gap-3">
      <div v-for="i in 5" :key="i" class="card h-20 animate-pulse" />
    </div>

    <div v-else-if="cart.isEmpty" class="card card-pad">
      <p class="text-sm text-slate-700">Корзина пуста.</p>
      <div class="mt-4">
        <RouterLink to="/catalog" class="btn btn-primary" aria-label="Перейти в каталог">
          Перейти в каталог
        </RouterLink>
      </div>
    </div>

    <div v-else class="space-y-3">
      <article v-for="item in cart.items" :key="item.productId" class="card p-4 sm:p-6">
        <div class="flex items-start gap-4">
          <div class="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100 p-1">
            <img :src="item.image" alt="" class="h-full w-full object-contain" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-sm font-semibold text-slate-900">{{ item.name }}</h2>
                <p class="mt-1 text-xs text-slate-600">{{ item.productId }}</p>
              </div>
              <div class="text-right">
                <div
                  class="text-sm font-semibold text-slate-900"
                  :data-testid="`cart-item-price-${item.productId}`"
                >
                  ${{ item.price }}
                </div>
                <div class="mt-1 text-xs text-slate-700">
                  Сумма:
                  <span class="font-medium" :data-testid="`cart-item-sum-${item.productId}`"
                    >${{ item.price * item.qty }}</span
                  >
                </div>
              </div>
            </div>

            <p v-if="alertText(item.productId)" class="notice notice-warning mt-2 text-xs">
              {{ alertText(item.productId) }}
            </p>

            <div v-if="getAlert(item.productId)" class="mt-2 flex flex-wrap gap-2">
              <template v-if="getAlert(item.productId)?.type === 'outOfStock'">
                <button
                  type="button"
                  aria-label="Удалить из корзины"
                  class="btn btn-danger px-3 py-1.5 text-xs"
                  @click="handleRemove(item.productId)"
                >
                  Удалить
                </button>
                <button
                  type="button"
                  aria-label="Оставить как есть"
                  class="btn btn-secondary px-3 py-1.5 text-xs"
                  @click="cart.clearAlerts(item.productId)"
                >
                  Оставить
                </button>
              </template>

              <template v-else>
                <button
                  type="button"
                  aria-label="Подтвердить пересчёт"
                  class="btn btn-primary px-3 py-1.5 text-xs"
                  @click="handleConfirmPrice(item.productId)"
                >
                  Подтвердить
                </button>
                <button
                  type="button"
                  aria-label="Скрыть предупреждение"
                  class="btn btn-secondary px-3 py-1.5 text-xs"
                  @click="cart.clearAlerts(item.productId)"
                >
                  Позже
                </button>
              </template>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-3 sm:gap-4">
              <label class="text-sm text-slate-700" :for="`qty-${item.productId}`">Кол-во</label>
              <input
                :id="`qty-${item.productId}`"
                type="number"
                min="1"
                class="w-24 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
                :value="item.qty"
                @change="
                  handleUpdateQty(item.productId, Number(($event.target as HTMLInputElement).value))
                "
              />
              <button
                type="button"
                aria-label="Удалить"
                class="btn btn-secondary px-3 py-1.5 sm:ml-auto"
                @click="handleRemove(item.productId)"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
