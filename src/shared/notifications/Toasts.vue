<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useNotificationsStore } from './store'

const notifications = useNotificationsStore()

const timers = new Map<string, number>()

function schedule(id: string) {
  if (timers.has(id)) return
  const t = window.setTimeout(() => {
    notifications.remove(id)
    timers.delete(id)
  }, 4000)
  timers.set(id, t)
}

watch(
  () => notifications.items,
  (items) => {
    for (const n of items) schedule(n.id)
  },
  { deep: true, immediate: true }
)

onBeforeUnmount(() => {
  for (const t of timers.values()) window.clearTimeout(t)
  timers.clear()
})

function classes(kind: string) {
  switch (kind) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900'
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900'
    case 'error':
      return 'border-red-200 bg-red-50 text-red-900'
    default:
      return 'border-slate-200 bg-white text-slate-900'
  }
}
</script>

<template>
  <div
    class="pointer-events-none fixed top-16 right-4 left-4 z-50 flex w-auto flex-col gap-2 sm:top-6 sm:right-6 sm:left-auto sm:w-[420px]"
  >
    <div
      v-for="n in notifications.sorted"
      :key="n.id"
      class="card pointer-events-auto px-3 py-2 text-sm shadow-sm"
      :class="classes(n.kind)"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="leading-5">{{ n.message }}</div>
        <button
          type="button"
          class="rounded px-2 py-1 text-xs font-medium text-slate-700 opacity-80 hover:opacity-100"
          aria-label="Закрыть уведомление"
          @click="notifications.remove(n.id)"
        >
          Закрыть
        </button>
      </div>
    </div>
  </div>
</template>
