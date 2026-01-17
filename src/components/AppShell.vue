<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import AppHeader from './AppHeader.vue'
import Toasts from '../shared/notifications/Toasts.vue'
import { useRealtimeStore } from '../stores/realtime'

const realtime = useRealtimeStore()

onMounted(() => {
  realtime.start()
})

onBeforeUnmount(() => {
  realtime.stop()
})
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <AppHeader />
    <main class="app-container py-5 sm:py-8">
      <RouterView />
    </main>
    <Toasts />
  </div>
</template>
