<script setup lang="ts">
import { computed } from 'vue';
import { Loader2 } from 'lucide-vue-next';
import { cn } from '@/lib/cn';

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
    size?: 'sm' | 'md' | 'lg';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    loading?: boolean;
    block?: boolean;
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    type: 'button',
    disabled: false,
    loading: false,
    block: false,
  },
);

const classes = computed(() =>
  cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
    'disabled:pointer-events-none disabled:opacity-50',
    props.size === 'sm' && 'h-8 px-3 text-xs',
    props.size === 'md' && 'h-9 px-3.5 text-sm',
    props.size === 'lg' && 'h-11 px-5 text-sm',
    props.variant === 'primary' && 'bg-brand text-white hover:bg-brand-hover',
    props.variant === 'secondary' &&
      'border border-line-strong bg-surface text-ink hover:bg-surface-raised',
    props.variant === 'ghost' && 'text-ink-soft hover:bg-brand-soft hover:text-brand-ink',
    props.variant === 'danger' && 'bg-danger text-white hover:bg-danger-hover',
    props.variant === 'quiet' && 'text-muted hover:bg-canvas hover:text-ink',
    props.block && 'w-full',
  ),
);
</script>

<template>
  <button :type="type" :disabled="disabled || loading" :class="classes">
    <Loader2 v-if="loading" class="size-4 animate-spin" aria-hidden="true" />
    <slot />
  </button>
</template>
