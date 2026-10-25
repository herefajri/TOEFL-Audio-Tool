<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next';
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-ink"
    title="File audio tersimpan di browser ini dan tidak diunggah ke server."
  >
    <ShieldCheck class="size-3.5" aria-hidden="true" />
    Local-first
  </span>
</template>
