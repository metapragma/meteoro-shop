import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth'

vi.mock('../shared/api', () => {
  return {
    api: {
      login: vi.fn(),
      logout: vi.fn(),
    },
  }
})

import { api } from '../shared/api'

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    if (typeof localStorage?.clear === 'function') {
      localStorage.clear()
    } else if (typeof localStorage?.removeItem === 'function') {
      localStorage.removeItem('auth.token')
      localStorage.removeItem('auth.user')
    }
    vi.mocked(api.login).mockReset()
    vi.mocked(api.logout).mockReset()
  })

  it('persists session on successful login', async () => {
    vi.mocked(api.login).mockResolvedValueOnce({
      token: 'fake-jwt-token',
      user: { id: 'u_123', nickname: 'User', avatar: '/avatars/u1.png' },
    })

    const auth = useAuthStore()
    await expect(auth.login('User', '/avatars/u1.png')).resolves.toBe(true)

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.token).toBe('fake-jwt-token')
    expect(auth.user?.nickname).toBe('User')
    expect(localStorage.getItem('auth.token')).toBe('fake-jwt-token')
    expect(localStorage.getItem('auth.user')).toContain('"nickname":"User"')
  })

  it('clears session on logout even if API fails', async () => {
    vi.mocked(api.login).mockResolvedValueOnce({
      token: 'fake-jwt-token',
      user: { id: 'u_123', nickname: 'User', avatar: '/avatars/u1.png' },
    })
    vi.mocked(api.logout).mockRejectedValueOnce(new Error('logout failed'))

    const auth = useAuthStore()
    await auth.login('User', '/avatars/u1.png')
    await expect(auth.logout()).resolves.toBeUndefined()

    expect(auth.isAuthenticated).toBe(false)
    expect(localStorage.getItem('auth.token')).toBeNull()
    expect(localStorage.getItem('auth.user')).toBeNull()
  })

  it('sets errorMessage on login failure', async () => {
    vi.mocked(api.login).mockRejectedValueOnce(new Error('fail'))

    const auth = useAuthStore()
    await expect(auth.login('User', '/avatars/u1.png')).resolves.toBe(false)

    expect(auth.isAuthenticated).toBe(false)
    expect(auth.errorMessage).toBe('fail')
  })
})
