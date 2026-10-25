<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import {
  ArrowDownUp,
  ArrowLeft,
  FileAudio,
  GraduationCap,
  Loader2,
  Play,
  Search,
  Settings2,
  UploadCloud,
  X,
} from 'lucide-vue-next';
import type { Part, Project, Track } from '@/db/types';
import type { ImportProgress } from '@/db/tracks';
import type { OrderPatch } from '@/db/tracks';
import {
  applyTrackOrder,
  duplicateTrackCrop,
  importAudioFiles,
  resetTrackCrop,
  restoreTrack,
  restoreTrackOrders,
  saveTrackCrop,
  softDeleteTrack,
  updateTrackMeta,
} from '@/db/tracks';
import { loadProject, loadTracks } from '@/db/queries';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { useDocumentTitle } from '@/composables/useDocumentTitle';
import { usePlayerStore } from '@/stores/player';
import { isSupportedAudioFile } from '@/lib/audio';
import { formatDuration, formatGap } from '@/lib/format';
import AppButton from '@/components/ui/AppButton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import LocalFirstBadge from '@/components/ui/LocalFirstBadge.vue';
import AutoSortDialog from '@/components/workspace/AutoSortDialog.vue';
import CropDialog from '@/components/workspace/CropDialog.vue';
import ExamModeOverlay from '@/components/workspace/ExamModeOverlay.vue';
import PlayerBar from '@/components/workspace/PlayerBar.vue';
import SettingsDialog from '@/components/workspace/SettingsDialog.vue';
import StatsStrip from '@/components/workspace/StatsStrip.vue';
import TrackTable from '@/components/workspace/TrackTable.vue';

const route = useRoute();
const router = useRouter();
const player = usePlayerStore();

const projectId = computed(() => String(route.params.id ?? ''));
const project = useLiveQuery<Project | null>(
  async () => (await loadProject(projectId.value)) ?? null,
  null,
  () => projectId.value,
);
const allTracks = useLiveQuery<Track[]>(
  () => loadTracks(projectId.value),
  [],
  () => projectId.value,
);
const tracks = computed(() => allTracks.value);

useDocumentTitle(() => project.value?.name ?? 'Sesi audio');

const projectChecked = ref(false);
const tracksLoaded = ref(false);
let projectCheckTimer: number | null = null;

watch(
  projectId,
  () => {
    projectChecked.value = false;
    tracksLoaded.value = false;
    if (projectCheckTimer !== null) window.clearTimeout(projectCheckTimer);
    projectCheckTimer = window.setTimeout(() => {
      projectChecked.value = true;
    }, 800);
  },
  { immediate: true },
);

watch(project, (value) => {
  if (!value) return;
  projectChecked.value = true;
  if (projectCheckTimer !== null) {
    window.clearTimeout(projectCheckTimer);
    projectCheckTimer = null;
  }
});

watch(allTracks, () => {
  tracksLoaded.value = true;
});

watch(
  project,
  (value) => {
    if (value) player.setGap(value.gapMs);
  },
  { immediate: true },
);

watch(
  () => player.error,
  (message) => {
    if (!message) return;
    toast.error(message, { id: 'player-error' });
    player.error = null;
  },
);

const search = ref('');
const filteredTracks = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) return tracks.value;

  return tracks.value.filter((track) => {
    const compact = `${track.part}${track.number ?? ''}`;
    const haystack =
      `${track.displayName} ${track.originalName} ${track.part} ${track.number ?? ''} ${compact}`.toLowerCase();
    return haystack.includes(query);
  });
});
const canReorder = computed(() => search.value.trim().length === 0);

const totalDuration = computed(() =>
  tracks.value.reduce(
    (sum, track) => sum + Math.max(0, track.trimEnd - track.trimStart),
    0,
  ),
);
const trimmedCount = computed(
  () =>
    tracks.value.filter(
      (track) =>
        track.trimStart > 0.005 ||
        Math.abs(track.trimEnd - track.duration) > 0.005,
    ).length,
);
const gapMs = computed(() => project.value?.gapMs ?? 0);
const gapSummary = computed(() =>
  gapMs.value > 0 ? `${formatGap(gapMs.value)} jeda` : 'tanpa jeda tambahan',
);

const importInput = ref<HTMLInputElement | null>(null);
const isImporting = ref(false);
const importProgress = ref<ImportProgress | null>(null);
const isDraggingFiles = ref(false);
let dragDepth = 0;

const importPercent = computed(() => {
  const progress = importProgress.value;
  if (!progress || progress.total === 0) return 0;
  return Math.round((progress.done / progress.total) * 100);
});

const showSettings = ref(false);
const showAutoSort = ref(false);
const showExam = ref(false);
const preparingExam = ref(false);
const cropTrack = ref<Track | null>(null);
const savingCrop = ref(false);

function openFilePicker(): void {
  if (isImporting.value) return;
  if (importInput.value) importInput.value.value = '';
  importInput.value?.click();
}

function onFileInputChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (files.length === 0) {
    input.value = '';
    return;
  }
  void handleFiles(files);
}

function hasFilePayload(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return types ? Array.from(types).includes('Files') : false;
}

function onDragEnter(event: DragEvent): void {
  if (!hasFilePayload(event)) return;
  event.preventDefault();
  dragDepth += 1;
  isDraggingFiles.value = true;
}

function onDragOver(event: DragEvent): void {
  if (!hasFilePayload(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
}

function onDragLeave(event: DragEvent): void {
  if (!hasFilePayload(event)) return;
  event.preventDefault();

  if (!event.relatedTarget) {
    dragDepth = 0;
    isDraggingFiles.value = false;
    return;
  }

  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) isDraggingFiles.value = false;
}

function onDrop(event: DragEvent): void {
  if (!hasFilePayload(event)) return;
  event.preventDefault();
  dragDepth = 0;
  isDraggingFiles.value = false;

  const files = Array.from(event.dataTransfer?.files ?? []);
  void handleFiles(files);
}

async function handleFiles(files: File[]): Promise<void> {
  if (!project.value || isImporting.value || files.length === 0) return;

  const supported = files.filter(isSupportedAudioFile);
  const rejected = files.length - supported.length;

  if (supported.length === 0) {
    toast.error('Tidak ada file MP3, WAV, atau MPEG audio yang bisa diimpor.');
    return;
  }

  if (rejected > 0) {
    toast.warning(`${rejected} file dilewati karena bukan MP3, WAV, atau MPEG audio.`);
  }

  isImporting.value = true;
  importProgress.value = {
    done: 0,
    total: supported.length,
    currentName: supported[0]?.name ?? '',
  };

  try {
    const result = await importAudioFiles(project.value.id, supported, (progress) => {
      importProgress.value = progress;
    });

    if (result.imported.length > 0) {
      toast.success(
        `${result.imported.length} audio ditambahkan`,
        {
          description:
            result.imported.length === 1
              ? result.imported[0]?.displayName
              : 'Urutan awal mengikuti nama file. Gunakan urutkan otomatis untuk merapikan.',
        },
      );
    }

    if (result.errors.length > 0) {
      const details = result.errors
        .slice(0, 2)
        .map((item) => `${item.fileName}: ${item.message}`)
        .join('\n');
      toast.error(`${result.errors.length} file gagal diimpor`, {
        description: details,
      });
      console.warn('Import errors', result.errors);
    }
  } catch (errorValue) {
    toast.error(
      errorValue instanceof Error ? errorValue.message : 'Gagal mengimpor audio.',
    );
  } finally {
    isImporting.value = false;
    importProgress.value = null;
    if (importInput.value) importInput.value.value = '';
  }
}

async function playAll(): Promise<void> {
  if (!project.value || tracks.value.length === 0) return;
  await player.startQueue(tracks.value, 0, {
    gapMs: project.value.gapMs,
    autoplay: true,
  });
}

async function handlePlayTrack(id: string): Promise<void> {
  if (!project.value) return;

  const track = tracks.value.find((item) => item.id === id);
  if (!track) return;

  if (player.current?.id === id) {
    await player.toggle();
    return;
  }

  const list = filteredTracks.value.length > 0 ? filteredTracks.value : tracks.value;
  let index = list.findIndex((item) => item.id === id);
  if (index < 0) {
    index = tracks.value.findIndex((item) => item.id === id);
    await player.startQueue(tracks.value, Math.max(0, index), {
      gapMs: project.value.gapMs,
      autoplay: true,
    });
    return;
  }

  await player.startQueue(list, index, {
    gapMs: project.value.gapMs,
    autoplay: true,
  });
}

function queueMatchesProjectTracks(): boolean {
  if (player.queueProjectId !== projectId.value) return false;
  if (player.queue.length !== tracks.value.length) return false;
  const ids = new Set(player.queue.map((item) => item.id));
  return tracks.value.every((track) => ids.has(track.id));
}

async function openExam(): Promise<void> {
  if (!project.value || tracks.value.length === 0 || preparingExam.value) return;

  preparingExam.value = true;
  try {
    if (!queueMatchesProjectTracks()) {
      await player.prepareQueue(tracks.value, 0, { gapMs: project.value.gapMs });
    }
    player.enterExam();
    showExam.value = true;
  } finally {
    preparingExam.value = false;
  }
}

function closeExam(): void {
  showExam.value = false;
  player.exitExam();
}

function openAutoSort(): void {
  if (tracks.value.length < 2) return;
  showAutoSort.value = true;
}

function onAutoSortApplied(sorted: Track[]): void {
  player.syncQueueOrder(sorted);
}

function onAutoSortRestored(sorted: Track[]): void {
  player.syncQueueOrder(sorted);
}

async function handleRename(id: string, name: string): Promise<void> {
  const current = tracks.value.find((track) => track.id === id);
  if (!current) return;
  const previousName = current.displayName;

  try {
    const updated = await updateTrackMeta(id, { displayName: name });
    if (!updated) return;

    player.updateTrackInQueue(updated);
    toast.success('Nama audio diperbarui', {
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: () => {
          void undoRename(updated.id, previousName);
        },
      },
    });
  } catch (errorValue) {
    toast.error(
      errorValue instanceof Error ? errorValue.message : 'Gagal mengubah nama audio.',
    );
  }
}

async function undoRename(id: string, name: string): Promise<void> {
  try {
    const updated = await updateTrackMeta(id, { displayName: name });
    if (updated) {
      player.updateTrackInQueue(updated);
      toast.success('Nama dikembalikan');
    }
  } catch (errorValue) {
    toast.error(
      errorValue instanceof Error ? errorValue.message : 'Gagal mengembalikan nama.',
    );
  }
}

async function handleUpdatePart(id: string, part: Part): Promise<void> {
  try {
    const updated = await updateTrackMeta(id, { part });
    if (updated) player.updateTrackInQueue(updated);
  } catch (errorValue) {
    toast.error(
      errorValue instanceof Error ? errorValue.message : 'Gagal mengubah Part.',
    );
  }
}

async function handleUpdateNumber(id: string, number: number | null): Promise<void> {
  try {
    const updated = await updateTrackMeta(id, { number });
    if (updated) player.updateTrackInQueue(updated);
  } catch (errorValue) {
    toast.error(
      errorValue instanceof Error ? errorValue.message : 'Gagal mengubah nomor audio.',
    );
  }
}

async function handleDelete(track: Track): Promise<void> {
  player.removeTrackFromQueue(track.id);

  try {
    await softDeleteTrack(track.id);
    toast(`"${track.displayName}" dihapus`, {
      description: 'Audio bisa dikembalikan dalam 12 detik.',
      duration: 10_000,
      action: {
        label: 'Undo',
        onClick: () => {
          void undoDelete(track.id);
        },
      },
    });
  } catch (errorValue) {
    toast.error(
      errorValue instanceof Error ? errorValue.message : 'Gagal menghapus audio.',
    );
  }
}

async function undoDelete(id: string): Promise<void> {
  try {
    const restored = await restoreTrack(id);
    if (!restored) {
      toast.error('Audio sudah dihapus permanen.');
      return;
    }
    toast.success('Audio dikembalikan');
  } catch (errorValue) {
    toast.error(
      errorValue instanceof Error ? errorValue.message : 'Gagal mengembalikan audio.',
    );
  }
}

async function commitOrder(nextTracks: Track[], message: string): Promise<void> {
  const previousOrders: OrderPatch[] = tracks.value.map((track) => ({
    id: track.id,
    order: track.order,
  }));

  await applyTrackOrder(
    projectId.value,
    nextTracks.map((track) => track.id),
  );
  player.syncQueueOrder(nextTracks);

  toast(message, {
    duration: 7000,
    action: {
      label: 'Undo',
      onClick: () => {
        void undoOrder(previousOrders);
      },
    },
  });
}

async function handleReorder(fromId: string, toId: string): Promise<void> {
  const list = [...tracks.value];
  const from = list.findIndex((track) => track.id === fromId);
  const to = list.findIndex((track) => track.id === toId);
  if (from < 0 || to < 0 || from === to) return;

  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);

  try {
    await commitOrder(list, 'Urutan diperbarui');
  } catch (errorValue) {
    toast.error(
      errorValue instanceof Error ? errorValue.message : 'Gagal mengubah urutan.',
    );
  }
}

async function handleMove(id: string, delta: number): Promise<void> {
  const list = [...tracks.value];
  const index = list.findIndex((track) => track.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= list.length) return;

  const [moved] = list.splice(index, 1);
  list.splice(target, 0, moved);

  try {
    await commitOrder(list, 'Urutan diperbarui');
  } catch (errorValue) {
    toast.error(
      errorValue instanceof Error ? errorValue.message : 'Gagal mengubah urutan.',
    );
  }
}

async function undoOrder(previousOrders: OrderPatch[]): Promise<void> {
  if (previousOrders.length === 0) return;

  try {
    await restoreTrackOrders(projectId.value, previousOrders);
    const orderMap = new Map(previousOrders.map((item) => [item.id, item.order]));
    const restored = [...tracks.value].sort(
      (a, b) => (orderMap.get(a.id) ?? a.order) - (orderMap.get(b.id) ?? b.order),
    );
    player.syncQueueOrder(restored);
    toast.success('Urutan dikembalikan');
  } catch (errorValue) {
    toast.error(
      errorValue instanceof Error ? errorValue.message : 'Gagal mengembalikan urutan.',
    );
  }
}

function openCrop(track: Track): void {
  cropTrack.value = track;
}

async function handleCropSave(payload: {
  trimStart: number;
  trimEnd: number;
  mode: 'duplicate' | 'replace';
}): Promise<void> {
  if (!cropTrack.value) return;

  savingCrop.value = true;
  try {
    const updated =
      payload.mode === 'replace'
        ? await saveTrackCrop(
            cropTrack.value.id,
            payload.trimStart,
            payload.trimEnd,
          )
        : await duplicateTrackCrop(
            cropTrack.value.id,
            payload.trimStart,
            payload.trimEnd,
          );

    if (!updated) {
      toast.error('Audio tidak ditemukan.');
      cropTrack.value = null;
      return;
    }

    if (payload.mode === 'replace') {
      player.updateTrackInQueue(updated);
      toast.success('Audio asli diperbarui');
    } else {
      toast.success('Potongan disimpan sebagai audio baru', {
        description: 'Audio asli tetap ada dan tidak diubah.',
      });
    }
    cropTrack.value = null;
  } catch (errorValue) {
    toast.error(
      errorValue instanceof Error ? errorValue.message : 'Gagal menyimpan potongan.',
    );
  } finally {
    savingCrop.value = false;
  }
}

async function handleCropReset(track: Track): Promise<void> {
  savingCrop.value = true;
  try {
    const updated = await resetTrackCrop(track.id);
    if (updated) {
      player.updateTrackInQueue(updated);
      toast.success('Potongan audio direset');
    }
    cropTrack.value = null;
  } catch (errorValue) {
    toast.error(
      errorValue instanceof Error ? errorValue.message : 'Gagal mereset potongan.',
    );
  } finally {
    savingCrop.value = false;
  }
}

function onProjectDeleted(): void {
  player.clearProjectQueue(projectId.value);
  void router.push({ name: 'home' });
}

onMounted(() => {
  if (player.queueProjectId && player.queueProjectId !== projectId.value) {
    player.clearQueue();
  }
});

onBeforeUnmount(() => {
  if (projectCheckTimer !== null) window.clearTimeout(projectCheckTimer);
  player.pause();
});
</script>

<template>
  <div
    class="min-h-screen"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <input
      ref="importInput"
      type="file"
      accept=".mp3,.wav,.mpeg,.mpg,audio/mpeg,audio/wav,video/mpeg"
      multiple
      class="hidden"
      @change="onFileInputChange"
    />

    <header class="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <RouterLink
          :to="{ name: 'home' }"
          class="inline-flex h-8 items-center gap-1.5 rounded-md px-1.5 text-sm font-medium text-muted hover:bg-canvas hover:text-ink"
        >
          <ArrowLeft class="size-4" aria-hidden="true" />
          <span class="hidden sm:inline">Semua sesi</span>
        </RouterLink>

        <div class="h-5 w-px bg-line" aria-hidden="true"></div>

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-ink">
            {{ project?.name ?? (projectChecked ? 'Sesi tidak ditemukan' : 'Memuat sesi…') }}
          </p>
          <p class="text-xs text-muted">{{ tracks.length }} audio</p>
        </div>

        <LocalFirstBadge class="hidden md:inline-flex" />

        <AppButton
          variant="ghost"
          size="sm"
          :disabled="!project"
          @click="showSettings = true"
        >
          <Settings2 class="size-4" aria-hidden="true" />
          <span class="hidden sm:inline">Pengaturan</span>
        </AppButton>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 pb-40 pt-6 sm:px-6 sm:pt-8">
      <div v-if="!projectChecked && !project" class="animate-pulse space-y-4">
        <div class="h-3 w-24 rounded bg-surface"></div>
        <div class="h-8 w-1/2 rounded bg-surface"></div>
        <div class="h-4 w-1/3 rounded bg-surface"></div>
        <div class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
          <div v-for="index in 4" :key="index" class="h-20 bg-surface"></div>
        </div>
        <div class="h-64 rounded-lg border border-line bg-surface"></div>
      </div>

      <EmptyState
        v-else-if="!project"
        title="Sesi tidak ditemukan"
        description="Sesi ini mungkin sudah dihapus, atau tautannya salah. Kembali ke daftar sesi untuk memilih sesi lain."
      >
        <template #icon>
          <FileAudio class="size-6" aria-hidden="true" />
        </template>
        <template #action>
          <AppButton variant="primary" @click="router.push({ name: 'home' })">
            Kembali ke daftar sesi
          </AppButton>
        </template>
      </EmptyState>

      <template v-else>
        <section>
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            Sesi audio
          </p>
          <h1 class="mt-1.5 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {{ project.name }}
          </h1>
          <p class="mt-1.5 text-sm text-muted">
            {{ tracks.length }} audio
            <span aria-hidden="true">·</span>
            {{ formatDuration(totalDuration) }}
            <span aria-hidden="true">·</span>
            {{ gapSummary }}
          </p>
        </section>

        <div class="mt-5 flex flex-wrap items-center gap-2">
          <AppButton
            variant="primary"
            :disabled="tracks.length === 0"
            @click="playAll"
          >
            <Play class="size-4" fill="currentColor" aria-hidden="true" />
            Putar semua
          </AppButton>

          <AppButton
            variant="secondary"
            :loading="isImporting"
            @click="openFilePicker"
          >
            <UploadCloud v-if="!isImporting" class="size-4" aria-hidden="true" />
            Impor audio
          </AppButton>

          <AppButton
            variant="secondary"
            :disabled="tracks.length < 2"
            @click="openAutoSort"
          >
            <ArrowDownUp class="size-4" aria-hidden="true" />
            Urutkan otomatis
          </AppButton>

          <AppButton
            variant="ghost"
            :disabled="tracks.length === 0"
            :loading="preparingExam"
            @click="openExam"
          >
            <GraduationCap v-if="!preparingExam" class="size-4" aria-hidden="true" />
            Mode ujian
          </AppButton>

          <div class="relative w-full sm:ml-auto sm:w-64">
            <Search
              class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              v-model="search"
              type="search"
              placeholder="Cari nama audio…"
              aria-label="Cari audio"
              class="h-9 w-full rounded-md border border-line-strong bg-surface pl-8 pr-8 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none"
            />
            <button
              v-if="search"
              type="button"
              class="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted hover:bg-canvas hover:text-ink"
              aria-label="Hapus pencarian"
              @click="search = ''"
            >
              <X class="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <StatsStrip
          class="mt-5"
          :track-count="tracks.length"
          :total-duration="totalDuration"
          :trimmed-count="trimmedCount"
          :gap-ms="gapMs"
        />

        <div
          v-if="isImporting && importProgress"
          class="mt-3 rounded-lg border border-line bg-surface p-3"
        >
          <div class="flex items-center justify-between gap-3 text-xs">
            <span class="inline-flex items-center gap-1.5 font-medium text-ink">
              <Loader2 class="size-3.5 animate-spin text-brand" aria-hidden="true" />
              Mengimpor audio…
            </span>
            <span class="font-mono text-muted">
              {{ importProgress.done }} / {{ importProgress.total }}
            </span>
          </div>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas">
            <div
              class="h-full rounded-full bg-brand transition-[width] duration-200"
              :style="{ width: `${importPercent}%` }"
            ></div>
          </div>
          <p class="mt-1.5 truncate text-xs text-muted">{{ importProgress.currentName }}</p>
        </div>

        <section class="mt-6" aria-labelledby="track-list-title">
          <div class="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="track-list-title" class="text-sm font-semibold text-ink">
                Daftar audio
              </h2>
              <p class="mt-0.5 text-xs text-muted">
                <template v-if="search">
                  Menampilkan {{ filteredTracks.length }} dari {{ tracks.length }} audio
                </template>
                <template v-else-if="tracks.length > 0">
                  Drag ikon di kiri untuk mengubah urutan manual.
                </template>
                <template v-else>Belum ada file di sesi ini.</template>
              </p>
            </div>
            <span v-if="trimmedCount > 0" class="text-xs text-muted">
              {{ trimmedCount }} audio dipotong
            </span>
          </div>

          <div
            v-if="!tracksLoaded && tracks.length === 0"
            class="overflow-hidden rounded-lg border border-line bg-surface"
          >
            <div
              v-for="index in 4"
              :key="index"
              class="flex items-center gap-4 border-b border-line px-4 py-4 last:border-b-0"
            >
              <div class="size-4 animate-pulse rounded bg-canvas"></div>
              <div class="h-3 flex-1 animate-pulse rounded bg-canvas"></div>
              <div class="h-6 w-16 animate-pulse rounded bg-canvas"></div>
            </div>
          </div>

          <div
            v-else-if="tracks.length === 0"
            class="rounded-lg border border-dashed border-line-strong bg-surface px-6 py-14 text-center"
          >
            <div class="mx-auto grid size-12 place-items-center rounded-lg bg-brand-soft text-brand">
              <UploadCloud class="size-6" aria-hidden="true" />
            </div>
            <h3 class="mt-4 text-base font-semibold text-ink">Belum ada audio</h3>
            <p class="mx-auto mt-1.5 max-w-md text-sm leading-6 text-muted">
              Impor file MP3, WAV, atau MPEG audio. Anda bisa memilih banyak file
              sekaligus, atau tarik file ke halaman ini.
            </p>
            <AppButton class="mt-5" variant="primary" @click="openFilePicker">
              <UploadCloud class="size-4" aria-hidden="true" />
              Impor audio
            </AppButton>
            <p class="mt-3 text-xs text-muted">MP3 / WAV / MPEG · maks. 300 MB per file</p>
          </div>

          <EmptyState
            v-else-if="filteredTracks.length === 0"
            title="Tidak ada audio yang cocok"
            description="Coba kata kunci lain, atau hapus pencarian untuk melihat semua audio."
          >
            <template #icon>
              <Search class="size-6" aria-hidden="true" />
            </template>
            <template #action>
              <AppButton variant="secondary" @click="search = ''">
                Hapus pencarian
              </AppButton>
            </template>
          </EmptyState>

          <TrackTable
            v-else
            :tracks="filteredTracks"
            :current-id="player.current?.id ?? null"
            :is-playing="player.isPlaying"
            :sortable="canReorder"
            @play="handlePlayTrack"
            @crop="openCrop"
            @delete="handleDelete"
            @rename="handleRename"
            @update-part="handleUpdatePart"
            @update-number="handleUpdateNumber"
            @move="handleMove"
            @reorder="handleReorder"
          />
        </section>
      </template>
    </main>

    <div
      v-if="isDraggingFiles"
      class="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-brand/10 p-6 backdrop-blur-sm"
    >
      <div class="rounded-xl border-2 border-dashed border-brand bg-surface px-8 py-6 text-center shadow-xl">
        <UploadCloud class="mx-auto size-8 text-brand" aria-hidden="true" />
        <p class="mt-2 text-base font-semibold text-ink">Lepaskan file MP3/WAV/MPEG</p>
        <p class="mt-1 text-sm text-muted">File akan ditambahkan ke sesi ini.</p>
      </div>
    </div>

    <PlayerBar />

    <SettingsDialog
      :open="showSettings"
      :project="project"
      :track-count="tracks.length"
      :total-duration="totalDuration"
      @close="showSettings = false"
      @deleted="onProjectDeleted"
    />

    <AutoSortDialog
      :open="showAutoSort"
      :tracks="tracks"
      :project-id="projectId"
      @close="showAutoSort = false"
      @applied="onAutoSortApplied"
      @restored="onAutoSortRestored"
    />

    <CropDialog
      v-if="cropTrack"
      :key="cropTrack.id"
      :track="cropTrack"
      :saving="savingCrop"
      @close="cropTrack = null"
      @save="handleCropSave"
      @reset="handleCropReset"
    />

    <ExamModeOverlay
      v-if="showExam && project"
      :project-name="project.name"
      @exit="closeExam"
    />
  </div>
</template>
