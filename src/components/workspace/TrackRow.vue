<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import {
  GripVertical,
  Music2,
  Pause,
  Pencil,
  Play,
  Scissors,
  Trash2,
  Upload,
} from 'lucide-vue-next';
import type { Part, Track } from '@/db/types';
import { hasAudio } from '@/db/types';
import { PART_OPTIONS } from '@/lib/sortTracks';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/cn';
import IconButton from '@/components/ui/IconButton.vue';

const props = defineProps<{
  track: Track;
  isCurrent: boolean;
  isPlaying: boolean;
  sortable: boolean;
  dragActive: boolean;
  dropTarget: boolean;
}>();

const emit = defineEmits<{
  play: [id: string];
  crop: [track: Track];
  delete: [track: Track];
  attach: [track: Track];
  rename: [id: string, name: string];
  updatePart: [id: string, part: Part];
  updateNumber: [id: string, number: number | null];
  move: [id: string, delta: number];
  dragStart: [id: string];
  dragOver: [id: string];
  drop: [id: string];
  dragEnd: [];
}>();

const rowRef = ref<HTMLTableRowElement | null>(null);
const editing = ref(false);
const draftName = ref('');
const nameInput = ref<HTMLInputElement | null>(null);

const isTrimmed = computed(
  () =>
    props.track.trimStart > 0.005 ||
    Math.abs(props.track.trimEnd - props.track.duration) > 0.005,
);
const missingAudio = computed(() => !hasAudio(props.track));
const trimmedDuration = computed(() =>
  Math.max(0, props.track.trimEnd - props.track.trimStart),
);

const rowClass = computed(() =>
  cn(
    'group border-b border-line/80 transition-colors last:border-b-0',
    props.isCurrent
      ? 'bg-brand-soft/50'
      : 'hover:bg-surface-raised focus-within:bg-surface-raised',
    props.dragActive && 'opacity-40',
    props.dropTarget && 'bg-brand-soft',
  ),
);

async function startEdit(): Promise<void> {
  draftName.value = props.track.displayName;
  editing.value = true;
  await nextTick();
  nameInput.value?.focus();
  nameInput.value?.select();
}

function commitEdit(): void {
  if (!editing.value) return;
  editing.value = false;
  const name = draftName.value.trim();
  if (name && name !== props.track.displayName) {
    emit('rename', props.track.id, name);
  }
}

function cancelEdit(): void {
  editing.value = false;
  draftName.value = props.track.displayName;
}

function onEditKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    commitEdit();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    cancelEdit();
  }
}

function onPartChange(event: Event): void {
  emit('updatePart', props.track.id, (event.target as HTMLSelectElement).value as Part);
}

function onNumberChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const raw = input.value.trim();
  if (raw === '') {
    input.value = '';
    emit('updateNumber', props.track.id, null);
    return;
  }

  const value = Number.parseInt(raw, 10);
  const normalized = Number.isFinite(value) ? Math.max(1, value) : null;
  input.value = normalized === null ? '' : String(normalized);
  emit('updateNumber', props.track.id, normalized);
}

function onDragStart(event: DragEvent): void {
  if (!props.sortable) {
    event.preventDefault();
    return;
  }

  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', props.track.id);
    event.dataTransfer.effectAllowed = 'move';
    if (rowRef.value) event.dataTransfer.setDragImage(rowRef.value, 20, 20);
  }

  emit('dragStart', props.track.id);
}

function onHandleKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    emit('move', props.track.id, -1);
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    emit('move', props.track.id, 1);
  }
}
</script>

<template>
  <tr
    ref="rowRef"
    :class="rowClass"
    @dragover.prevent="emit('dragOver', track.id)"
    @drop.prevent="emit('drop', track.id)"
  >
    <td
      class="w-10 px-1 py-2.5 align-middle"
      :class="isCurrent && 'shadow-[inset_2px_0_0_var(--color-brand)]'"
    >
      <button
        type="button"
        :draggable="sortable"
        :disabled="!sortable"
        class="grid size-8 cursor-grab place-items-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-ink-soft disabled:cursor-not-allowed disabled:opacity-35 active:cursor-grabbing"
        :aria-label="`Geser ${track.displayName}. Gunakan panah atas atau bawah untuk memindahkan.`"
        :title="sortable ? 'Drag untuk mengubah urutan' : 'Hapus pencarian untuk mengubah urutan'"
        @dragstart="onDragStart"
        @dragend="emit('dragEnd')"
        @keydown="onHandleKeydown"
      >
        <GripVertical class="size-4" aria-hidden="true" />
      </button>
    </td>

    <td
      class="w-10 px-2 py-2.5 text-right align-middle font-mono text-xs tabular-nums"
      :class="isCurrent ? 'font-semibold text-brand-ink' : 'text-muted'"
    >
      {{ track.order }}
    </td>

    <td class="min-w-[240px] px-3 py-2.5 align-middle">
      <div v-if="editing" class="flex min-w-0 items-center">
        <input
          ref="nameInput"
          v-model="draftName"
          type="text"
          maxlength="160"
          aria-label="Nama audio"
          class="h-9 w-full rounded-md border border-brand bg-surface px-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/15"
          @keydown="onEditKeydown"
          @blur="commitEdit"
        />
      </div>

      <button
        v-else
        type="button"
        class="flex w-full min-w-0 items-center gap-2 rounded-md text-left"
        :title="`${track.displayName} — klik untuk mengubah nama`"
        @click="startEdit"
      >
        <span
          v-if="isCurrent && isPlaying"
          class="flex h-4 shrink-0 items-end gap-0.5"
          aria-label="Sedang diputar"
        >
          <span
            class="equalizer-bar h-2 w-0.5 rounded-full bg-brand"
            style="animation-delay: 0ms"
          ></span>
          <span
            class="equalizer-bar h-3 w-0.5 rounded-full bg-brand"
            style="animation-delay: 140ms"
          ></span>
          <span
            class="equalizer-bar h-1.5 w-0.5 rounded-full bg-brand"
            style="animation-delay: 280ms"
          ></span>
        </span>
        <Music2
          v-else-if="isCurrent"
          class="size-3.5 shrink-0 text-brand"
          aria-label="Audio aktif"
        />
        <span
          class="truncate text-sm"
          :class="isCurrent ? 'font-semibold text-brand-ink' : 'font-medium text-ink'"
        >
          {{ track.displayName }}
        </span>
        <Pencil
          class="size-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          aria-hidden="true"
        />
      </button>
    </td>

    <td class="w-24 px-2 py-2.5 align-middle">
      <select
        :value="track.part"
        aria-label="Part audio"
        class="h-8 w-full cursor-pointer rounded-md border border-line bg-surface px-2 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        @change="onPartChange"
      >
        <option v-for="option in PART_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </td>

    <td class="w-20 px-2 py-2.5 align-middle">
      <input
        :value="track.number ?? ''"
        type="number"
        min="1"
        step="1"
        inputmode="numeric"
        :disabled="track.part === 'FULL'"
        aria-label="Nomor audio"
        placeholder="—"
        class="h-8 w-full rounded-md border border-line bg-surface px-2 text-center font-mono text-xs tabular-nums text-ink-soft transition-colors hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        @change="onNumberChange"
      />
    </td>

    <td
      class="w-24 px-3 py-2.5 text-right align-middle font-mono text-xs tabular-nums text-ink-soft"
      :title="isTrimmed ? `Durasi asli: ${formatDuration(track.duration)}` : undefined"
    >
      {{ formatDuration(trimmedDuration) }}
    </td>

    <td class="w-32 px-3 py-2.5 align-middle">
      <span
        v-if="missingAudio"
        class="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn"
        title="Impor file audio dengan nama yang sama untuk melampirkan"
      >
        <Upload class="size-3" aria-hidden="true" />
        Tanpa audio
      </span>
      <span
        v-else-if="isTrimmed"
        class="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn"
        :title="`Diputar ${formatDuration(trimmedDuration)} dari ${formatDuration(track.duration)}`"
      >
        <Scissors class="size-3" aria-hidden="true" />
        Dipotong
      </span>
      <span v-else class="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">
        <span class="size-1.5 rounded-full bg-brand" aria-hidden="true"></span>
        Utuh
      </span>
    </td>

    <td class="w-32 px-2 py-2.5 align-middle">
      <div class="flex items-center justify-end gap-0.5">
        <IconButton
          :label="isCurrent && isPlaying ? 'Jeda audio' : 'Putar dari sini'"
          size="sm"
          :disabled="missingAudio"
          @click="emit('play', track.id)"
        >
          <Pause v-if="isCurrent && isPlaying" class="size-4" fill="currentColor" />
          <Play v-else class="size-4" fill="currentColor" />
        </IconButton>
        <IconButton
          v-if="missingAudio"
          label="Lampirkan file audio"
          size="sm"
          @click="emit('attach', track)"
        >
          <Upload class="size-4" />
        </IconButton>
        <IconButton v-else label="Potong audio" size="sm" @click="emit('crop', track)">
          <Scissors class="size-4" />
        </IconButton>
        <span class="mx-0.5 h-4 w-px shrink-0 bg-line" aria-hidden="true"></span>
        <IconButton label="Hapus audio" size="sm" variant="danger" @click="emit('delete', track)">
          <Trash2 class="size-4" />
        </IconButton>
      </div>
    </td>
  </tr>
</template>
