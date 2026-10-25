<script setup lang="ts">
import { computed } from 'vue';
import { Clock3, ListMusic, Scissors, Timer } from 'lucide-vue-next';
import { formatDuration, formatGap } from '@/lib/format';

const props = defineProps<{
  trackCount: number;
  totalDuration: number;
  trimmedCount: number;
  gapMs: number;
}>();

const gapLabel = computed(() => (props.gapMs > 0 ? formatGap(props.gapMs) : 'Tanpa jeda'));

const cells = computed(() => [
  {
    label: 'Audio',
    value: String(props.trackCount),
    icon: ListMusic,
  },
  {
    label: 'Total durasi',
    value: formatDuration(props.totalDuration),
    icon: Clock3,
  },
  {
    label: 'Dipotong',
    value: String(props.trimmedCount),
    icon: Scissors,
  },
  {
    label: 'Jeda antar audio',
    value: gapLabel.value,
    icon: Timer,
  },
]);
</script>

<template>
  <dl class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
    <div v-for="cell in cells" :key="cell.label" class="bg-surface px-4 py-3.5">
      <dt class="flex items-center gap-1.5 text-xs text-muted">
        <component :is="cell.icon" class="size-3.5 text-brand" aria-hidden="true" />
        {{ cell.label }}
      </dt>
      <dd class="mt-1.5 font-mono text-lg font-semibold tracking-tight text-ink">
        {{ cell.value }}
      </dd>
    </div>
  </dl>
</template>
