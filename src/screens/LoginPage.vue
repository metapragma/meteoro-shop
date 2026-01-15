<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { clearSession, setSession } from '../features/auth/session'

const router = useRouter()
const route = useRoute()

function handleLogin() {
  setSession({
    token: 'fake-jwt-token',
    user: {
      id: 'u_123',
      nickname: 'User',
      avatar: '/avatars/u1.png',
    },
  })

  const next =
    typeof route.query.next === 'string' && route.query.next.length > 0
      ? route.query.next
      : '/catalog'

  router.replace(next)
}

function handleLogout() {
  clearSession()
  router.replace('/login')
}
</script>

<template>
  <main style="padding: 24px">
    <h1>Login</h1>
    <p>Mock auth screen (will be replaced with spec UI).</p>
    <div style="display: flex; gap: 12px; margin-top: 12px">
      <button type="button" aria-label="Login" @click="handleLogin">Login</button>
      <button type="button" aria-label="Logout" @click="handleLogout">
        Logout
      </button>
    </div>
  </main>
</template>

