<script setup lang="ts">
import { computed } from 'vue';
import {
  AudioLines,
  Loader2,
  Pause,
  Play,
  Repeat1,
  SkipBack,
  SkipForward,
  Timer,
  Volume2,
} from 'lucide-vue-next';
import { usePlayerStore } from '@/stores/player';
import { formatDuration, formatGap } from '@/lib/format';
import PartBadge from '@/components/ui/PartBadge.vue';

const player = usePlayerStore();

const progressStyle = computed(() => ({
  '--progress': `${Math.round(player.progress * 100)}%`,
}));

const gapLabel = computed(() => (player.gapMs > 0 ? formatGap(player.gapMs) : 'Tanpa jeda'));

function handleToggle(): void {
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

function toggleLoop(): void {
  player.setLoop(!player.loop);
}

function toggleAutoAdvance(): void {
  player.setAutoAdvance(!player.autoAdvance);
}
</script>

<template>
  <div
    v-if="player.hasQueue"
    class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 shadow-[0_-8px_30px_rgba(20,32,28,0.06)] backdrop-blur"
  >
    <div
      v-if="player.countdown !== null"
      class="absolute -top-11 right-4 flex items-center gap-2 rounded-full border border-brand/20 bg-surface px-3 py-1.5 text-xs text-ink-soft shadow-md"
      role="status"
    >
      <Timer class="size-3.5 text-brand" aria-hidden="true" />
      <span>Jeda {{ player.countdown.toFixed(1) }} dtk</span>
      <button
        type="button"
        class="font-medium text-brand hover:underline"
        @click="player.next()"
      >
        Lewati
      </button>
    </div>

    <div
      class="mx-auto flex max-w-6xl flex-col gap-2.5 px-4 py-3 lg:flex-row lg:items-center lg:gap-5"
    >
      <div class="flex min-w-0 items-center gap-2.5 lg:w-64 lg:shrink-0">
        <div
          class="grid size-9 shrink-0 place-items-center rounded-md bg-brand-soft text-brand-ink"
          aria-hidden="true"
        >
          <AudioLines class="size-4" />
        </div>
        <div class="min-w-0 flex-1" aria-live="polite">
          <p class="truncate text-sm font-semibold text-ink">
            {{ player.current?.displayName ?? 'Tidak ada audio aktif' }}
          </p>
          <div class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
            <PartBadge v-if="player.current" :part="player.current.part" compact />
            <span class="shrink-0">{{ player.position }}</span>
            <span v-if="player.nextTrack" class="truncate">
              <span aria-hidden="true">·</span>
              Berikutnya {{ player.nextTrack.displayName }}
            </span>
          </div>
        </div>
      </div>

      <div class="flex min-w-0 flex-1 items-center gap-2.5">
        <div class="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            class="grid size-8 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink disabled:opacity-40"
            :disabled="!player.current"
            aria-label="Audio sebelumnya"
            @click="player.previous()"
          >
            <SkipBack class="size-4" fill="currentColor" />
          </button>

          <button
            type="button"
            class="grid size-11 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-hover focus-visible:outline-offset-4"
            :aria-label="player.isPlaying ? 'Jeda audio' : 'Putar audio'"
            :disabled="!player.hasQueue"
            @click="handleToggle"
          >
            <Loader2 v-if="player.isLoading" class="size-5 animate-spin" aria-hidden="true" />
            <Pause
              v-else-if="player.isPlaying"
              class="size-5"
              fill="currentColor"
              aria-hidden="true"
            />
            <Play
              v-else
              class="size-5 translate-x-px"
              fill="currentColor"
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            class="grid size-8 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink disabled:opacity-40"
            :disabled="!player.current"
            aria-label="Audio berikutnya"
            @click="player.next()"
          >
            <SkipForward class="size-4" fill="currentColor" />
          </button>
        </div>

        <div class="min-w-0 flex-1">
          <input
            type="range"
            min="0"
            :max="Math.max(0.1, player.duration)"
            step="0.05"
            :value="player.currentTime"
            :style="progressStyle"
            class="player-range w-full"
            aria-label="Posisi audio"
            :disabled="!player.current"
            @input="onSeek"
          />
          <div class="mt-1 flex justify-between font-mono text-[11px] text-muted">
            <span>{{ formatDuration(player.currentTime) }}</span>
            <span>{{ formatDuration(player.duration) }}</span>
          </div>
        </div>
      </div>

      <div class="flex shrink-0 items-center justify-between gap-2 lg:w-64 lg:justify-end">
        <span class="hidden text-xs text-muted xl:inline">{{ gapLabel }}</span>

        <button
          type="button"
          class="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors"
          :class="
            player.autoAdvance
              ? 'bg-brand-soft text-brand-ink'
              : 'text-muted hover:bg-canvas hover:text-ink'
          "
          :aria-pressed="player.autoAdvance"
          @click="toggleAutoAdvance"
        >
          <SkipForward class="size-3.5" aria-hidden="true" />
          Otomatis
        </button>

        <button
          type="button"
          class="grid size-8 place-items-center rounded-md transition-colors"
          :class="
            player.loop
              ? 'bg-brand-soft text-brand-ink'
              : 'text-muted hover:bg-canvas hover:text-ink'
          "
          :aria-pressed="player.loop"
          aria-label="Ulangi audio aktif"
          title="Ulangi audio aktif"
          @click="toggleLoop"
        >
          <Repeat1 class="size-4" />
        </button>

        <div class="hidden items-center gap-1.5 sm:flex">
          <Volume2 class="size-4 text-muted" aria-hidden="true" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="player.volume"
            class="w-20"
            aria-label="Volume"
            @input="onVolume"
          />
        </div>
      </div>
    </div>
  </div>
</template>
