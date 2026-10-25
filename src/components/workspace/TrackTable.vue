<script setup lang="ts">
import { ref } from 'vue';
import { GripVertical } from 'lucide-vue-next';
import type { Part, Track } from '@/db/types';
import TrackRow from './TrackRow.vue';

const props = defineProps<{
  tracks: Track[];
  currentId: string | null;
  isPlaying: boolean;
  sortable: boolean;
}>();

const emit = defineEmits<{
  play: [id: string];
  crop: [track: Track];
  delete: [track: Track];
  rename: [id: string, name: string];
  updatePart: [id: string, part: Part];
  updateNumber: [id: string, number: number | null];
  move: [id: string, delta: number];
  reorder: [fromId: string, toId: string];
}>();

const draggedId = ref<string | null>(null);
const overId = ref<string | null>(null);

function onDragStart(id: string): void {
  if (!props.sortable) return;
  draggedId.value = id;
  overId.value = null;
}

function onDragOver(id: string): void {
  if (!draggedId.value || draggedId.value === id) return;
  overId.value = id;
}

function onDrop(id: string): void {
  const from = draggedId.value;
  resetDrag();
  if (!from || from === id) return;
  emit('reorder', from, id);
}

function resetDrag(): void {
  draggedId.value = null;
  overId.value = null;
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-line bg-surface">
    <div class="overflow-x-auto">
      <table class="w-full min-w-[820px] border-collapse text-left">
        <thead class="bg-surface-raised">
          <tr class="border-b border-line text-xs font-medium uppercase tracking-[0.06em] text-muted">
            <th scope="col" class="w-10 px-1.5 py-2.5">
              <GripVertical class="mx-auto size-3.5 opacity-60" aria-hidden="true" />
              <span class="sr-only">Urutan</span>
            </th>
            <th scope="col" class="w-10 px-1 py-2.5 text-right">#</th>
            <th scope="col" class="min-w-[240px] px-3 py-2.5">Nama audio</th>
            <th scope="col" class="w-24 px-2 py-2.5">Part</th>
            <th scope="col" class="w-20 px-2 py-2.5">No.</th>
            <th scope="col" class="w-24 px-3 py-2.5 text-right">Durasi</th>
            <th scope="col" class="w-28 px-3 py-2.5">Status</th>
            <th scope="col" class="w-32 px-2 py-2.5 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <TrackRow
            v-for="track in tracks"
            :key="track.id"
            :track="track"
            :is-current="currentId === track.id"
            :is-playing="isPlaying && currentId === track.id"
            :sortable="sortable"
            :drag-active="draggedId === track.id"
            :drop-target="overId === track.id && draggedId !== track.id"
            @play="emit('play', $event)"
            @crop="emit('crop', $event)"
            @delete="emit('delete', $event)"
            @rename="(id, name) => emit('rename', id, name)"
            @update-part="(id, part) => emit('updatePart', id, part)"
            @update-number="(id, number) => emit('updateNumber', id, number)"
            @move="(id, delta) => emit('move', id, delta)"
            @drag-start="onDragStart"
            @drag-over="onDragOver"
            @drop="onDrop"
            @drag-end="resetDrag"
          />
        </tbody>
      </table>
    </div>

    <div v-if="!sortable" class="border-t border-line bg-warn-soft px-3 py-2 text-xs text-warn">
      Hapus pencarian untuk mengubah urutan manual.
    </div>
  </div>
</template>
