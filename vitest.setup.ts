import { afterEach, vi } from 'vitest'

function ensureLocalStorage() {
  const needsPolyfill =
    typeof globalThis.localStorage === 'undefined' ||
    typeof globalThis.localStorage?.getItem !== 'function' ||
    typeof globalThis.localStorage?.setItem !== 'function' ||
    typeof globalThis.localStorage?.removeItem !== 'function' ||
    typeof globalThis.localStorage?.clear !== 'function'

  if (!needsPolyfill) return

  const store = new Map<string, string>()
  const memoryStorage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  }

  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
  })
}

ensureLocalStorage()

afterEach(() => {
  vi.restoreAllMocks()
  if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
    localStorage.clear()
  }
})
