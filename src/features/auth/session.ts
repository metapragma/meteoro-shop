export type UserProfile = {
  id: string
  nickname: string
  avatar: string
}

export type Session = {
  token: string
  user: UserProfile
}

const STORAGE_TOKEN_KEY = 'auth.token'
const STORAGE_USER_KEY = 'auth.user'

export function getSession(): Session | null {
  const token = localStorage.getItem(STORAGE_TOKEN_KEY)
  const userRaw = localStorage.getItem(STORAGE_USER_KEY)
  if (!token || !userRaw) return null

  try {
    const user = JSON.parse(userRaw) as unknown
    if (!isUserProfile(user)) return null
    return { token, user }
  } catch {
    return null
  }
}

export function setSession(session: Session): void {
  localStorage.setItem(STORAGE_TOKEN_KEY, session.token)
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(session.user))
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_TOKEN_KEY)
  localStorage.removeItem(STORAGE_USER_KEY)
}

export function isAuthenticated(): boolean {
  return getSession() !== null
}

function isUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.nickname === 'string' &&
    typeof record.avatar === 'string'
  )
}
