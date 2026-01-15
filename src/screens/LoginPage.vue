<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

function handleLogin() {
  auth.loginMock()

  const next =
    typeof route.query.next === 'string' && route.query.next.length > 0
      ? route.query.next
      : '/catalog'

  router.replace(next)
}

function handleLogout() {
  auth.logout()
  router.replace('/login')
}
</script>

<template>
  <main class="mx-auto max-w-md p-6">
    <h1 class="text-2xl font-semibold">Вход</h1>
    <p class="mt-2 text-sm text-slate-600">Мок-аутентификация.</p>
    <div class="mt-4 flex gap-3">
      <button
        type="button"
        aria-label="Войти"
        class="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        @click="handleLogin"
      >
        Войти
      </button>
      <button
        type="button"
        aria-label="Выйти"
        class="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
        @click="handleLogout"
      >
        Выйти
      </button>
    </div>
  </main>
</template>
