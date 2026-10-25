<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useWakeLock } from '@vueuse/core';
import {
  AudioLines,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sun,
  Timer,
  X,
} from 'lucide-vue-next';
import { usePlayerStore } from '@/stores/player';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { formatDuration, formatGap } from '@/lib/format';

defineProps<{ projectName: string }>();

const emit = defineEmits<{ exit: [] }>();
const player = usePlayerStore();
const playButton = ref<HTMLButtonElement | null>(null);
const overlayRef = ref<HTMLElement | null>(null);
let previousActive: HTMLElement | null = null;

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

useBodyScrollLock(() => true);

const { isActive, request, release } = useWakeLock();

const progressStyle = computed(() => ({
  '--progress': `${Math.round(player.progress * 100)}%`,
}));

const gapLabel = computed(() =>
  player.gapMs > 0 ? `${formatGap(player.gapMs)} jeda` : 'tanpa jeda tambahan',
);

const hasStarted = computed(
  () =>
    Boolean(player.current) &&
    (player.isPlaying || player.currentTime > 0.2 || player.currentIndex > 0),
);

const statusLabel = computed(() => {
  if (player.countdown !== null) return 'Jeda antar audio';
  if (player.isPlaying) return 'Sedang berjalan';
  if (hasStarted.value) return 'Dijeda';
  return 'Siap memulai';
});

function handlePlay(): void {
  if (player.current) {
    void player.toggle();
    return;
  }
  if (player.hasQueue) {
    void player.playIndex(0, { autoplay: true });
  }
}

function onSeek(event: Event): void {
  player.seek(Number((event.target as HTMLInputElement).value));
}

function onVolume(event: Event): void {
  player.setVolume(Number((event.target as HTMLInputElement).value));
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('exit');
    return;
  }

  if (event.key === 'Tab') {
    trapTab(event);
    return;
  }

  const target = event.target as HTMLElement | null;
  const tag = target?.tagName.toLowerCase();
  const isRange = tag === 'input' && (target as HTMLInputElement).type === 'range';
  const isTextField =
    (tag === 'input' && !isRange) || tag === 'textarea' || tag === 'select';

  if (isTextField) return;

  if (event.code === 'Space') {
    // Let native button activation handle Space when a button has focus.
    if (tag === 'button') return;
    event.preventDefault();
    handlePlay();
  } else if (!isRange && event.key === 'ArrowRight') {
    event.preventDefault();
    void player.next();
  } else if (!isRange && event.key === 'ArrowLeft') {
    event.preventDefault();
    void player.previous();
  }
}

function trapTab(event: KeyboardEvent): void {
  const root = overlayRef.value;
  if (!root) return;

  const items = Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => element.getClientRects().length > 0);

  if (items.length === 0) return;

  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement as HTMLElement | null;

  if (!active || !root.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return;
  }

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(async () => {
  previousActive =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  window.addEventListener('keydown', onKeydown);
  playButton.value?.focus();

  try {
    await request('screen');
  } catch {
    // Wake lock is a nice-to-have; ignore failures.
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  void release();
  if (previousActive?.isConnected) previousActive.focus();
});
</script>

<template>
  <Teleport to="body">
    <div
      ref="overlayRef"
      class="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[#091512] text-white"
      style="background-image: radial-gradient(circle at 50% 0%, rgba(13, 107, 88, 0.32), transparent 48%)"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-title"
    >
      <header class="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <div class="flex min-w-0 items-center gap-3">
          <div class="grid size-9 shrink-0 place-items-center rounded-md bg-white/10 text-[#5eead4]">
            <AudioLines class="size-5" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-[0.2em] text-white/45">
              Mode ujian
            </p>
            <h1 id="exam-title" class="truncate text-sm font-semibold text-white">
              {{ projectName }}
            </h1>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <span
            v-if="isActive"
            class="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60 sm:inline-flex"
          >
            <Sun class="size-3.5" aria-hidden="true" />
            Layar aktif
          </span>
          <button
            type="button"
            class="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            @click="emit('exit')"
          >
            <X class="size-4" aria-hidden="true" />
            Keluar
          </button>
        </div>
      </header>

      <main class="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 pb-6 sm:px-8">
        <div class="w-full max-w-3xl text-center">
          <div
            class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60"
          >
            <span
              class="size-1.5 rounded-full"
              :class="player.isPlaying ? 'bg-[#5eead4]' : 'bg-white/30'"
              aria-hidden="true"
            ></span>
            {{ statusLabel }}
            <span v-if="player.current" class="text-white/30" aria-hidden="true">·</span>
            <span v-if="player.current" class="font-mono">{{ player.position }}</span>
          </div>

          <template v-if="player.current">
            <p class="mt-7 text-xs font-medium uppercase tracking-[0.18em] text-[#5eead4]">
              {{ player.current.part === 'FULL' ? 'Full set' : player.current.part === 'OTHER' ? 'Audio' : `Part ${player.current.part}` }}
              <template v-if="player.current.number !== null">
                · Nomor {{ player.current.number }}
              </template>
            </p>
            <h2
              class="mx-auto mt-3 max-w-3xl text-balance text-3xl font-semibold tracking-tight text-white sm:text-5xl"
            >
              {{ player.current.displayName }}
            </h2>
            <p class="mt-3 text-sm text-white/50">
              Audio {{ player.currentIndex + 1 }} dari {{ player.queue.length }}
              <span aria-hidden="true">·</span>
              {{ gapLabel }}
            </p>
          </template>

          <template v-else>
            <h2 class="mt-7 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              {{ player.hasQueue ? 'Siap memulai ujian' : 'Antrian audio kosong' }}
            </h2>
            <p class="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/50">
              {{
                player.hasQueue
                  ? 'Pastikan volume sudah nyaman. Setelah dimulai, audio akan berjalan berurutan secara otomatis.'
                  : 'Kembali ke sesi dan tambahkan audio terlebih dahulu.'
              }}
            </p>
          </template>

          <div
            v-if="player.countdown !== null"
            class="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-[#5eead4]/25 bg-[#5eead4]/10 px-4 py-2 text-sm text-[#a7f3d0]"
            role="status"
          >
            <Timer class="size-4" aria-hidden="true" />
            Jeda {{ player.countdown.toFixed(1) }} detik
            <button
              type="button"
              class="ml-1 font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
              @click="player.next()"
            >
              Lewati
            </button>
          </div>

          <div class="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              class="grid size-11 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
              :disabled="!player.current"
              aria-label="Audio sebelumnya"
              @click="player.previous()"
            >
              <SkipBack class="size-5" fill="currentColor" />
            </button>

            <button
              ref="playButton"
              type="button"
              class="grid size-20 place-items-center rounded-full bg-[#0d6b58] text-white shadow-[0_0_0_8px_rgba(13,107,88,0.18)] transition-colors hover:bg-[#0a5849] disabled:cursor-not-allowed disabled:opacity-40 sm:size-24"
              :disabled="!player.hasQueue"
              :aria-label="player.isPlaying ? 'Jeda audio' : 'Putar audio'"
              @click="handlePlay"
            >
              <Loader2 v-if="player.isLoading" class="size-8 animate-spin" aria-hidden="true" />
              <Pause
                v-else-if="player.isPlaying"
                class="size-8"
                fill="currentColor"
                aria-hidden="true"
              />
              <Play
                v-else
                class="size-8 translate-x-0.5"
                fill="currentColor"
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              class="grid size-11 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
              :disabled="!player.current"
              aria-label="Audio berikutnya"
              @click="player.next()"
            >
              <SkipForward class="size-5" fill="currentColor" />
            </button>
          </div>

          <div class="mx-auto mt-8 max-w-2xl">
            <input
              type="range"
              min="0"
              :max="Math.max(0.1, player.duration)"
              step="0.05"
              :value="player.currentTime"
              :style="progressStyle"
              class="exam-range w-full"
              aria-label="Posisi audio"
              :disabled="!player.current"
              @input="onSeek"
            />
            <div class="mt-2 flex justify-between font-mono text-xs text-white/45">
              <span>{{ formatDuration(player.currentTime) }}</span>
              <span>{{ formatDuration(player.duration) }}</span>
            </div>
          </div>

          <p
            v-if="player.nextTrack"
            class="mt-5 truncate text-xs text-white/40"
          >
            Berikutnya: {{ player.nextTrack.displayName }}
          </p>
        </div>
      </main>

      <footer
        class="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3 text-xs text-white/45 sm:px-8"
      >
        <div class="flex flex-wrap items-center gap-3">
          <span class="inline-flex items-center gap-1.5">
            <kbd class="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">Space</kbd>
            putar / jeda
          </span>
          <span class="hidden items-center gap-1.5 sm:inline-flex">
            <kbd class="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">←</kbd>
            <kbd class="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">→</kbd>
            pindah audio
          </span>
          <span class="hidden items-center gap-1.5 md:inline-flex">
            <kbd class="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
            keluar
          </span>
        </div>

        <label class="flex items-center gap-2">
          <span class="sr-only">Volume</span>
          <span class="text-white/45">Volume</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="player.volume"
            class="w-24"
            style="accent-color: #5eead4"
            aria-label="Volume"
            @input="onVolume"
          />
        </label>
      </footer>
    </div>
  </Teleport>
</template>
