import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useNotificationsStore } from '../shared/notifications/store'
import { WsClient } from '../shared/ws/client'
import { getWsUrl } from '../shared/ws/url'
import type { WsEvent } from '../shared/ws/types'
import { useCatalogStore } from './catalog'
import { useCartStore } from './cart'
import { useProductDetailsStore } from './productDetails'

export const useRealtimeStore = defineStore('realtime', () => {
  const status = ref<'idle' | 'connecting' | 'open' | 'closed' | 'error'>('idle')

  let client: WsClient | null = null

  function ensureClient() {
    if (client) return client

    client = new WsClient({
      url: getWsUrl(),
      onEvent: handleEvent,
      onStatus: (s) => {
        if (s.state === 'connecting') status.value = 'connecting'
        else if (s.state === 'open') status.value = 'open'
        else if (s.state === 'closed') status.value = 'closed'
        else status.value = 'error'
      },
    })

    return client
  }

  function handleEvent(event: WsEvent) {
    const catalog = useCatalogStore()
    const productDetails = useProductDetailsStore()
    const cart = useCartStore()
    const notifications = useNotificationsStore()

    if (event.type === 'product.updated') {
      catalog.applyProductPatch(event.data.id, event.data.changes)
      productDetails.applyProductPatch(event.data.id, event.data.changes)
      cart.applyProductUpdate(event.data.id, event.data.changes)
      return
    }

    if (event.type === 'cart.synced') {
      cart.replaceFromServer(event.data.cart)
      notifications.push('info', 'Корзина обновлена')
      return
    }
  }

  function start() {
    if (status.value !== 'idle') return
    status.value = 'connecting'
    ensureClient().start()
  }

  function stop() {
    client?.stop()
    client = null
    status.value = 'idle'
  }

  return { status, start, stop }
})
