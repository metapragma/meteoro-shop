<script setup lang="ts">
defineProps<{ id: string }>()
</script>

<template>
  <main style="padding: 24px">
    <h1>Product</h1>
    <p>Placeholder screen for /product/:id.</p>
    <p><strong>id:</strong> {{ id }}</p>
  </main>
</template>
