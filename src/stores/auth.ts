import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  clearSession,
  getSession,
  setSession,
  type Session,
  type UserProfile,
} from '../features/auth/session'
import { api } from '../shared/api'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(getSession())
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)

  const isAuthenticated = computed(() => session.value !== null)
  const user = computed<UserProfile | null>(() => session.value?.user ?? null)
  const token = computed<string | null>(() => session.value?.token ?? null)

  async function login(nickname: string, avatar: string) {
    isLoading.value = true
    errorMessage.value = null
    try {
      const res = await api.login({ provider: 'mock', nickname, avatar })
      const newSession: Session = { token: res.token, user: res.user }
      setSession(newSession)
      session.value = newSession
      return true
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : 'Ошибка входа'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    isLoading.value = true
    errorMessage.value = null
    clearSession()
    session.value = null
    try {
      await api.logout()
    } catch {
      // ignore mock logout failures; local session is already cleared
    } finally {
      isLoading.value = false
    }
  }

  function refreshFromStorage() {
    session.value = getSession()
  }

  return {
    session,
    isAuthenticated,
    user,
    token,
    isLoading,
    errorMessage,
    login,
    logout,
    refreshFromStorage,
  }
})
