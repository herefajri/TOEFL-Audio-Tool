<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-14 text-center"
  >
    <div class="grid size-12 place-items-center rounded-lg bg-brand-soft text-brand">
      <slot name="icon" />
    </div>
    <h3 class="mt-4 text-base font-semibold text-ink">{{ title }}</h3>
    <p v-if="description" class="mt-1.5 max-w-md text-sm leading-6 text-muted">
      {{ description }}
    </p>
    <div v-if="$slots.action" class="mt-5 flex flex-wrap items-center justify-center gap-2">
      <slot name="action" />
    </div>
  </div>
</template>
