<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { ArrowRight, Pencil, Trash2 } from 'lucide-vue-next';
import type { ProjectSummary } from '@/db/types';
import { formatDuration, formatRelativeDate } from '@/lib/format';
import IconButton from '@/components/ui/IconButton.vue';

const props = defineProps<{ project: ProjectSummary }>();

defineEmits<{
  rename: [];
  delete: [];
}>();

const initial = computed(() => props.project.name.trim().charAt(0).toUpperCase() || 'S');
</script>

<template>
  <article
    class="group flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-4 transition-colors last:border-b-0 hover:bg-surface-raised sm:flex-nowrap"
  >
    <div
      class="grid size-10 shrink-0 place-items-center rounded-md bg-brand-soft text-sm font-semibold text-brand-ink"
      aria-hidden="true"
    >
      {{ initial }}
    </div>

    <RouterLink
      :to="{ name: 'workspace', params: { id: project.id } }"
      class="min-w-0 flex-1 rounded-sm"
    >
      <h3 class="truncate text-sm font-semibold text-ink group-hover:text-brand-ink">
        {{ project.name }}
      </h3>
      <p class="mt-1 truncate text-xs text-muted">
        {{ project.trackCount }} audio
        <span aria-hidden="true">·</span>
        {{ formatDuration(project.totalDuration) }}
        <span aria-hidden="true">·</span>
        Diubah {{ formatRelativeDate(project.updatedAt) }}
      </p>
    </RouterLink>

    <div class="ml-auto flex shrink-0 items-center gap-1">
      <IconButton label="Ubah nama sesi" size="sm" @click="$emit('rename')">
        <Pencil class="size-4" />
      </IconButton>
      <IconButton label="Hapus sesi" size="sm" variant="danger" @click="$emit('delete')">
        <Trash2 class="size-4" />
      </IconButton>
      <RouterLink
        :to="{ name: 'workspace', params: { id: project.id } }"
        class="ml-1 inline-flex h-8 items-center gap-1 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-medium text-ink-soft hover:border-brand/30 hover:bg-brand-soft hover:text-brand-ink"
      >
        Buka
        <ArrowRight class="size-3.5" aria-hidden="true" />
      </RouterLink>
    </div>
  </article>
</template>
