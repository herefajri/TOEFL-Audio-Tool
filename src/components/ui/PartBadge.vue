<script setup lang="ts">
import { computed } from 'vue';
import type { Part } from '@/db/types';
import { cn } from '@/lib/cn';

const props = withDefaults(
  defineProps<{
    part: Part;
    compact?: boolean;
  }>(),
  {
    compact: false,
  },
);

const label = computed(() => {
  if (props.part === 'FULL') return 'Full';
  if (props.part === 'OTHER') return 'Lain';
  return props.compact ? props.part : `Part ${props.part}`;
});

const classes = computed(() =>
  cn(
    'inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-semibold tracking-wide',
    props.part === 'A' && 'border-brand/20 bg-brand-soft text-brand-ink',
    props.part === 'B' && 'border-info/20 bg-info-soft text-info',
    props.part === 'C' && 'border-warn/20 bg-warn-soft text-warn',
    props.part === 'FULL' && 'border-ink/15 bg-ink/5 text-ink-soft',
    props.part === 'OTHER' && 'border-line-strong bg-canvas text-muted',
  ),
);
</script>

<template>
  <span :class="classes">{{ label }}</span>
</template>
