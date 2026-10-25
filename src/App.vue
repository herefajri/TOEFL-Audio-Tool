<script setup lang="ts">
import { RouterView } from 'vue-router';
import { Toaster } from 'vue-sonner';
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
  <Toaster position="top-right" rich-colors close-button :duration="4500" />
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.page-leave-to {
  opacity: 0;
}
</style>
