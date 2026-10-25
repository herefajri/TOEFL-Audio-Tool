<script setup lang="ts">
import { AudioLines } from 'lucide-vue-next';
</script>

<template>
  <div class="flex items-center gap-2.5">
    <div class="grid size-9 shrink-0 place-items-center rounded-md bg-brand text-white shadow-sm">
      <AudioLines class="size-5" aria-hidden="true" />
    </div>
    <div class="leading-tight">
      <p class="text-sm font-semibold tracking-tight text-ink">TOEFL Audio Tools</p>
      <p class="text-xs font-medium uppercase tracking-[0.12em] text-muted">
        Listening workspace
      </p>
    </div>
  </div>
</template>
