import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type Notification = {
  id: string
  kind: 'info' | 'success' | 'warning' | 'error'
  message: string
  createdAt: number
}

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<Notification[]>([])

  const sorted = computed(() => [...items.value].sort((a, b) => a.createdAt - b.createdAt))

  function push(kind: Notification['kind'], message: string) {
    const createdAt = Date.now()
    const notification: Notification = { id: randomId(), kind, message, createdAt }
    items.value = [...items.value, notification]
    return notification.id
  }

  function remove(id: string) {
    items.value = items.value.filter((n) => n.id !== id)
  }

  function clear() {
    items.value = []
  }

  return { items, sorted, push, remove, clear }
})
