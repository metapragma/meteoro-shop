<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '../shared/api/http'
import { api } from '../shared/api'
import type { Cart } from '../shared/api/types'
import { useNotificationsStore } from '../shared/notifications/store'
import { useCartStore } from '../stores/cart'

const router = useRouter()
const cart = useCartStore()
const notifications = useNotificationsStore()

const name = ref('')
const comment = ref('')

const isSubmitting = ref(false)
const orderId = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

function isCart(value: unknown): value is Cart {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    Array.isArray(record.items) &&
    typeof record.subtotal === 'number' &&
    typeof record.currency === 'string' &&
    typeof record.updatedAt === 'string'
  )
}

onMounted(() => {
  cart.load()
})

const canSubmit = computed(() => {
  return !isSubmitting.value && !cart.isLoading && !cart.isEmpty && name.value.trim().length > 0
})

async function handleSubmit() {
  errorMessage.value = null
  if (!cart.cart) {
    await cart.load()
  }
  if (!cart.cart || cart.isEmpty) {
    errorMessage.value = 'Корзина пуста'
    return
  }

  const customerName = name.value.trim()
  if (!customerName) {
    errorMessage.value = 'Введите имя'
    return
  }

  isSubmitting.value = true
  try {
    const res = await api.checkout({
      customer: { name: customerName, comment: comment.value.trim() || undefined },
      cart: cart.cart,
    })
    orderId.value = res.orderId
    cart.clear()
  } catch (e) {
    if (e instanceof ApiError && e.status === 409 && e.body?.error === 'CART_OUTDATED') {
      const record = e.body as Record<string, unknown>
      const serverCart = record.serverCart
      if (isCart(serverCart)) {
        cart.replaceFromServer(serverCart)
        notifications.push('warning', 'Корзина была обновлена на сервере. Проверьте и повторите.')
      }
      errorMessage.value = 'Корзина устарела'
    } else if (e instanceof ApiError && e.status === 422 && e.body?.error === 'INVALID_CUSTOMER') {
      errorMessage.value = 'Некорректные данные покупателя'
    } else {
      errorMessage.value = e instanceof Error ? e.message : 'Ошибка оформления заказа'
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-4 sm:space-y-5">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight">Оформление заказа</h1>
      <p class="muted mt-1">
        Сумма: <span class="font-semibold text-slate-900">{{ cart.subtotal }}</span>
        {{ cart.currency }}
      </p>
    </header>

    <div v-if="orderId" class="notice notice-success p-6">
      <p>
        Заказ <span class="font-semibold">№{{ orderId }}</span> оформлен.
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-primary"
          aria-label="Перейти в каталог"
          @click="router.push('/catalog')"
        >
          В каталог
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          aria-label="Перейти в корзину"
          @click="router.push('/cart')"
        >
          В корзину
        </button>
      </div>
    </div>

    <div v-else class="card card-pad">
      <div v-if="cart.isEmpty" class="text-sm text-slate-700">
        Корзина пуста. Перейдите в каталог, чтобы добавить товары.
      </div>

      <form v-else class="space-y-4" @submit.prevent="handleSubmit">
        <div>
          <label class="label" for="name">Имя</label>
          <input id="name" v-model="name" type="text" class="input" autocomplete="name" />
        </div>
        <div>
          <label class="label" for="comment">Комментарий</label>
          <textarea id="comment" v-model="comment" rows="3" class="input" />
        </div>

        <p v-if="errorMessage" class="mt-2 text-sm text-red-700">{{ errorMessage }}</p>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            aria-label="Оформить заказ"
            class="btn btn-primary"
            :disabled="!canSubmit"
          >
            Оформить заказ
          </button>
          <button
            type="button"
            aria-label="Перейти в корзину"
            class="btn btn-secondary"
            @click="router.push('/cart')"
          >
            В корзину
          </button>
        </div>
      </form>
    </div>
  </section>
</template>
