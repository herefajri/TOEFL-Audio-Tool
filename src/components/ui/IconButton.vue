<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/lib/cn';

const props = withDefaults(
  defineProps<{
    label: string;
    variant?: 'default' | 'danger' | 'ghost' | 'active';
    size?: 'sm' | 'md';
    disabled?: boolean;
  }>(),
  {
    variant: 'default',
    size: 'md',
    disabled: false,
  },
);

const classes = computed(() =>
  cn(
    'inline-grid place-items-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-40',
    props.size === 'sm' ? 'size-8' : 'size-9',
    props.variant === 'default' && 'text-muted hover:bg-canvas hover:text-ink',
    props.variant === 'ghost' && 'text-muted hover:bg-brand-soft hover:text-brand-ink',
    props.variant === 'danger' && 'text-muted hover:bg-danger-soft hover:text-danger',
    props.variant === 'active' && 'bg-brand-soft text-brand-ink',
  ),
);
</script>

<template>
  <button type="button" :aria-label="label" :title="label" :disabled="disabled" :class="classes">
    <slot />
  </button>
</template>
