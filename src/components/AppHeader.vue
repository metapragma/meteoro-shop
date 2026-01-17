<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const show = computed(() => auth.isAuthenticated && route.name !== 'login')

async function handleLogout() {
  await auth.logout()
  router.replace('/login')
}
</script>

<template>
  <header v-if="show" class="border-b border-slate-200 bg-white">
    <div class="app-container flex h-14 items-center justify-between gap-4">
      <div class="flex min-w-0 items-center gap-4">
        <RouterLink to="/catalog" class="text-sm font-semibold tracking-tight text-slate-900">
          Магазин
        </RouterLink>

        <nav class="flex min-w-0 items-center gap-4 overflow-x-auto text-sm font-medium">
          <RouterLink to="/catalog" class="nav-link" active-class="nav-link-active">
            Каталог
          </RouterLink>
          <RouterLink to="/cart" class="nav-link" active-class="nav-link-active">
            Корзина
          </RouterLink>
          <RouterLink to="/checkout" class="nav-link" active-class="nav-link-active">
            Оформление
          </RouterLink>
        </nav>
      </div>

      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 text-sm text-slate-700">
          <img
            v-if="auth.user?.avatar"
            :src="auth.user.avatar"
            alt=""
            class="h-7 w-7 rounded-full bg-slate-100 object-cover"
          />
          <span v-if="auth.user?.nickname" class="hidden sm:inline">{{ auth.user.nickname }}</span>
        </div>
        <button
          type="button"
          aria-label="Выйти"
          class="btn btn-secondary px-3 py-1.5"
          :disabled="auth.isLoading"
          @click="handleLogout"
        >
          Выйти
        </button>
      </div>
    </div>
  </header>
</template>
