<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { type Region } from 'wavesurfer.js/plugins/regions';
import TimelinePlugin from 'wavesurfer.js/plugins/timeline';
import { useResizeObserver } from '@vueuse/core';
import {
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-vue-next';
import type { Track } from '@/db/types';
import { loadBlob } from '@/db/queries';
import { formatDuration, formatTimecode } from '@/lib/format';
import AppButton from '@/components/ui/AppButton.vue';
import AppModal from '@/components/ui/AppModal.vue';

const props = defineProps<{
  track: Track;
  saving?: boolean;
}>();

type CropSaveMode = 'duplicate' | 'replace';

const emit = defineEmits<{
  close: [];
  save: [payload: { trimStart: number; trimEnd: number; mode: CropSaveMode }];
  reset: [track: Track];
}>();

const waveContainer = ref<HTMLDivElement | null>(null);
const ws = shallowRef<WaveSurfer | null>(null);
const region = shallowRef<Region | null>(null);

const loading = ref(true);
const loadError = ref('');
const saveError = ref('');
const trimStart = ref(props.track.trimStart);
const trimEnd = ref(props.track.trimEnd);
const duration = ref(props.track.duration);
const currentTime = ref(0);
const isPreviewing = ref(false);
const loopPreview = ref(false);
const zoom = ref(1);
const saveMode = ref<CropSaveMode>('duplicate');

let previewActive = false;
let destroyed = false;
let audioReady = false;

const selectionDuration = computed(() => Math.max(0, trimEnd.value - trimStart.value));
const removedDuration = computed(() => Math.max(0, duration.value - selectionDuration.value));

function roundTime(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function syncRegion(): void {
  region.value?.setOptions({
    start: trimStart.value,
    end: trimEnd.value,
  });
}

function applyZoom(): void {
  if (!audioReady) return;

  const player = ws.value;
  const container = waveContainer.value;
  if (!player || !container || duration.value <= 0) return;

  const width = container.clientWidth || 800;
  const base = width / duration.value;

  try {
    player.zoom(base * zoom.value);
  } catch {
    // WaveSurfer may still be loading; the next resize/load will retry.
  }
}

function setZoom(next: number): void {
  zoom.value = clamp(next, 1, 8);
  applyZoom();
}

function destroyPlayer(): void {
  destroyed = true;
  audioReady = false;
  previewActive = false;
  isPreviewing.value = false;
  if (ws.value) {
    ws.value.destroy();
    ws.value = null;
  }
  region.value = null;
}

async function init(): Promise<void> {
  destroyed = false;
  audioReady = false;
  loading.value = true;
  loadError.value = '';
  saveError.value = '';
  trimStart.value = props.track.trimStart;
  trimEnd.value = props.track.trimEnd;
  duration.value = props.track.duration;
  zoom.value = 1;
  currentTime.value = 0;
  isPreviewing.value = false;
  previewActive = false;
  saveMode.value = 'duplicate';

  await nextTick();
  if (destroyed || !waveContainer.value) return;

  try {
    const regionPlugin = RegionsPlugin.create();
    const timelinePlugin = TimelinePlugin.create({
      height: 18,
      timeInterval: 10,
      primaryLabelInterval: 30,
      style: {
        color: '#6b7872',
        fontSize: '10px',
      },
    });

    const player = WaveSurfer.create({
      container: waveContainer.value,
      height: 116,
      waveColor: '#b9c9c2',
      progressColor: '#0d6b58',
      cursorColor: '#07463a',
      cursorWidth: 1,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      dragToSeek: true,
      plugins: [regionPlugin, timelinePlugin],
    });

    ws.value = player;

    const blob = await loadBlob(props.track.blobId);
    if (!blob) throw new Error('File audio tidak ditemukan. Coba impor ulang.');
    if (destroyed) return;

    await player.loadBlob(blob);
    if (destroyed) return;

    duration.value = player.getDuration() || props.track.duration;
    trimStart.value = clamp(trimStart.value, 0, Math.max(0, duration.value - 0.1));
    trimEnd.value = clamp(trimEnd.value, trimStart.value + 0.1, duration.value);
    audioReady = true;

    const trimRegion = regionPlugin.addRegion({
      id: 'trim',
      start: trimStart.value,
      end: trimEnd.value,
      color: 'rgba(13, 107, 88, 0.18)',
      drag: true,
      resize: true,
      minLength: 0.1,
    });
    region.value = trimRegion;

    regionPlugin.on('region-updated', (updated) => {
      if (updated.id !== 'trim') return;
      trimStart.value = roundTime(updated.start);
      trimEnd.value = roundTime(updated.end);
    });

    player.on('timeupdate', (time) => {
      currentTime.value = time;
      if (!previewActive) return;

      if (time >= trimEnd.value - 0.03) {
        if (loopPreview.value) {
          player.setTime(trimStart.value);
          if (!player.isPlaying()) void player.play();
        } else {
          player.pause();
          player.setTime(trimEnd.value);
          previewActive = false;
        }
      }
    });

    player.on('play', () => {
      isPreviewing.value = true;
    });

    player.on('pause', () => {
      isPreviewing.value = false;
      previewActive = false;
    });

    player.on('finish', () => {
      if (previewActive && loopPreview.value) {
        player.setTime(trimStart.value);
        void player.play().catch(() => {
          previewActive = false;
          isPreviewing.value = false;
        });
        return;
      }
      isPreviewing.value = false;
      previewActive = false;
    });

    applyZoom();
    loading.value = false;
  } catch (errorValue) {
    if (destroyed) return;
    loading.value = false;
    loadError.value =
      errorValue instanceof Error ? errorValue.message : 'Gagal memuat waveform audio.';
  }
}

async function retry(): Promise<void> {
  destroyPlayer();
  await init();
}

async function togglePreview(): Promise<void> {
  const player = ws.value;
  if (!player) return;

  if (isPreviewing.value) {
    player.pause();
    return;
  }

  previewActive = true;
  isPreviewing.value = true;
  player.setTime(trimStart.value);

  try {
    await player.play();
  } catch {
    previewActive = false;
    isPreviewing.value = false;
  }
}

function nudgeStart(delta: number): void {
  const next = roundTime(clamp(trimStart.value + delta, 0, trimEnd.value - 0.1));
  trimStart.value = next;
  syncRegion();
}

function nudgeEnd(delta: number): void {
  const next = roundTime(clamp(trimEnd.value + delta, trimStart.value + 0.1, duration.value));
  trimEnd.value = next;
  syncRegion();
}

function setStartAtCursor(): void {
  const next = roundTime(clamp(currentTime.value, 0, trimEnd.value - 0.1));
  trimStart.value = next;
  syncRegion();
}

function setEndAtCursor(): void {
  const next = roundTime(clamp(currentTime.value, trimStart.value + 0.1, duration.value));
  trimEnd.value = next;
  syncRegion();
}

function resetSelection(): void {
  trimStart.value = 0;
  trimEnd.value = duration.value;
  syncRegion();
}

function save(): void {
  const start = roundTime(Math.min(trimStart.value, trimEnd.value - 0.1));
  const end = roundTime(Math.max(trimEnd.value, start + 0.1));

  if (end - start < 0.1) {
    saveError.value = 'Potongan minimal 0,1 detik.';
    return;
  }

  emit('save', { trimStart: start, trimEnd: end, mode: saveMode.value });
}

watch([trimStart, trimEnd], () => {
  saveError.value = '';
});

useResizeObserver(waveContainer, () => {
  if (ws.value) applyZoom();
});

onMounted(() => {
  void init();
});

onBeforeUnmount(() => {
  destroyPlayer();
});
</script>

<template>
  <AppModal
    :open="true"
    title="Potong audio"
    :description="track.displayName"
    size="2xl"
    @close="emit('close')"
  >
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface-raised px-3 py-2 text-xs text-muted">
        <span>Durasi asli <span class="font-mono text-ink-soft">{{ formatDuration(duration) }}</span></span>
        <span>
          Diputar
          <span class="font-mono text-brand-ink">{{ formatDuration(selectionDuration) }}</span>
        </span>
        <span v-if="removedDuration > 0.01">
          Dibuang
          <span class="font-mono text-warn">{{ formatDuration(removedDuration) }}</span>
        </span>
      </div>

      <div class="relative overflow-hidden rounded-lg border border-line bg-canvas">
        <div ref="waveContainer" class="min-h-[150px] overflow-x-auto px-2 py-2"></div>

        <div
          v-if="loading"
          class="absolute inset-0 grid place-items-center bg-surface/85 backdrop-blur-sm"
        >
          <div class="flex items-center gap-2 text-sm text-muted">
            <Loader2 class="size-4 animate-spin" aria-hidden="true" />
            Menyiapkan waveform…
          </div>
        </div>

        <div
          v-if="loadError && !loading"
          class="absolute inset-0 grid place-items-center bg-surface/92 p-4 text-center"
        >
          <div>
            <p class="text-sm font-medium text-danger">{{ loadError }}</p>
            <AppButton class="mt-3" size="sm" variant="secondary" @click="retry">
              Coba lagi
            </AppButton>
          </div>
        </div>
      </div>

      <p class="text-xs leading-5 text-muted">
        Geser area hijau untuk memilih bagian yang diputar, atau tarik ujung kiri/kanannya.
        Klik waveform untuk memindahkan kursor. Secara default, potongan disimpan sebagai
        audio baru dan audio asli tetap ada.
      </p>

      <div class="grid gap-2 sm:grid-cols-2">
        <div class="rounded-md border border-line bg-surface p-3">
          <p class="text-xs font-medium text-muted">Mulai</p>
          <p class="mt-1 font-mono text-lg font-semibold text-ink">
            {{ formatTimecode(trimStart) }}
          </p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <AppButton size="sm" variant="secondary" @click="nudgeStart(-1)">
              <Minus class="size-3.5" aria-hidden="true" />
              1 dtk
            </AppButton>
            <AppButton size="sm" variant="secondary" @click="nudgeStart(1)">
              <Plus class="size-3.5" aria-hidden="true" />
              1 dtk
            </AppButton>
            <button
              type="button"
              class="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-brand hover:bg-brand-soft"
              @click="setStartAtCursor"
            >
              Di kursor
            </button>
          </div>
        </div>

        <div class="rounded-md border border-line bg-surface p-3">
          <p class="text-xs font-medium text-muted">Selesai</p>
          <p class="mt-1 font-mono text-lg font-semibold text-ink">
            {{ formatTimecode(trimEnd) }}
          </p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <AppButton size="sm" variant="secondary" @click="nudgeEnd(-1)">
              <Minus class="size-3.5" aria-hidden="true" />
              1 dtk
            </AppButton>
            <AppButton size="sm" variant="secondary" @click="nudgeEnd(1)">
              <Plus class="size-3.5" aria-hidden="true" />
              1 dtk
            </AppButton>
            <button
              type="button"
              class="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-brand hover:bg-brand-soft"
              @click="setEndAtCursor"
            >
              Di kursor
            </button>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <AppButton
          variant="primary"
          size="sm"
          :disabled="loading || Boolean(loadError)"
          @click="togglePreview"
        >
          <Pause v-if="isPreviewing" class="size-4" fill="currentColor" />
          <Play v-else class="size-4" fill="currentColor" />
          {{ isPreviewing ? 'Jeda' : 'Putar seleksi' }}
        </AppButton>

        <label class="inline-flex h-8 items-center gap-2 rounded-md border border-line px-2.5 text-xs text-muted">
          <input v-model="loopPreview" type="checkbox" class="size-3.5 accent-[var(--color-brand)]" />
          Ulangi
        </label>

        <div class="ml-auto flex items-center gap-1">
          <button
            type="button"
            class="grid size-8 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink disabled:opacity-40"
            :disabled="zoom <= 1"
            aria-label="Perkecil waveform"
            @click="setZoom(zoom - 1)"
          >
            <ZoomOut class="size-4" />
          </button>
          <span class="w-9 text-center font-mono text-xs text-muted">{{ zoom }}×</span>
          <button
            type="button"
            class="grid size-8 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink disabled:opacity-40"
            :disabled="zoom >= 8"
            aria-label="Perbesar waveform"
            @click="setZoom(zoom + 1)"
          >
            <ZoomIn class="size-4" />
          </button>
          <AppButton size="sm" variant="quiet" @click="resetSelection">
            <RotateCcw class="size-3.5" aria-hidden="true" />
            Penuh
          </AppButton>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 rounded-md bg-canvas px-3 py-2 text-xs text-muted">
        <span>Kursor <span class="font-mono text-ink-soft">{{ formatTimecode(currentTime) }}</span></span>
        <button
          type="button"
          class="font-medium text-danger hover:underline"
          @click="emit('reset', track)"
        >
          Reset potongan tersimpan
        </button>
      </div>
    </div>

    <template #footer>
      <div class="mr-auto w-full space-y-1.5 sm:w-auto">
        <p v-if="saveError" class="text-sm text-danger" role="alert">{{ saveError }}</p>
        <fieldset class="space-y-1.5 text-xs text-muted">
          <legend class="sr-only">Cara menyimpan potongan</legend>
          <label class="flex items-center gap-2">
            <input
              v-model="saveMode"
              type="radio"
              value="duplicate"
              class="size-3.5 accent-[var(--color-brand)]"
            />
            <span>
              Simpan sebagai audio baru
              <span class="text-muted">(asli tetap ada)</span>
            </span>
          </label>
          <label class="flex items-center gap-2">
            <input
              v-model="saveMode"
              type="radio"
              value="replace"
              class="size-3.5 accent-[var(--color-brand)]"
            />
            <span>Ubah audio asli</span>
          </label>
        </fieldset>
      </div>
      <AppButton variant="secondary" @click="emit('close')">Batal</AppButton>
      <AppButton
        variant="primary"
        :loading="saving"
        :disabled="loading || Boolean(loadError)"
        @click="save"
      >
        Simpan potongan
      </AppButton>
    </template>
  </AppModal>
</template>
