import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  clearSession,
  getSession,
  setSession,
  type Session,
  type UserProfile,
} from '../features/auth/session'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(getSession())

  const isAuthenticated = computed(() => session.value !== null)
  const user = computed<UserProfile | null>(() => session.value?.user ?? null)
  const token = computed<string | null>(() => session.value?.token ?? null)

  function loginMock() {
    const newSession: Session = {
      token: 'fake-jwt-token',
      user: {
        id: 'u_123',
        nickname: 'User',
        avatar: '/avatars/u1.png',
      },
    }
    setSession(newSession)
    session.value = newSession
  }

  function logout() {
    clearSession()
    session.value = null
  }

  function refreshFromStorage() {
    session.value = getSession()
  }

  return {
    session,
    isAuthenticated,
    user,
    token,
    loginMock,
    logout,
    refreshFromStorage,
  }
})
