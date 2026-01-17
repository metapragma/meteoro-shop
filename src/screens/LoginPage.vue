<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

async function handleLogin() {
  const ok = await auth.login('User', '/avatars/u1.png')
  if (!ok) return

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
  <section class="mx-auto max-w-md px-4 py-10 sm:py-14">
    <div class="card card-pad">
      <h1 class="text-2xl font-semibold tracking-tight">Вход</h1>
      <p class="muted mt-2">Мок-аутентификация.</p>

      <p v-if="auth.errorMessage" class="mt-3 text-sm text-red-700">
        {{ auth.errorMessage }}
      </p>

      <div class="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          aria-label="Войти"
          class="btn btn-primary w-full sm:w-auto"
          :disabled="auth.isLoading"
          @click="handleLogin"
        >
          Войти
        </button>
        <button
          type="button"
          aria-label="Выйти"
          class="btn btn-secondary w-full sm:w-auto"
          :disabled="auth.isLoading"
          @click="handleLogout"
        >
          Выйти
        </button>
      </div>
    </div>
  </section>
</template>
