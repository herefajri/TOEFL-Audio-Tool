import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useStorage } from '@vueuse/core';
import { db } from '@/db';
import type { Part, Track } from '@/db/types';

export interface QueueTrack {
  id: string;
  projectId: string;
  blobId: string;
  displayName: string;
  part: Part;
  number: number | null;
  trimStart: number;
  trimEnd: number;
  duration: number;
}

interface LoadOptions {
  autoplay?: boolean;
}

export interface StartQueueOptions {
  autoplay?: boolean;
  gapMs?: number;
  autoAdvance?: boolean;
}

const audio = new Audio();
audio.preload = 'auto';

const preloadAudio = new Audio();
preloadAudio.preload = 'auto';
preloadAudio.volume = 0;

const urlCache = new Map<string, string>();
let tickTimer: number | null = null;
let countdownTimer: number | null = null;
let preloadToken = 0;
let loadToken = 0;
let endHandled = false;

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0.9;
  return Math.min(1, Math.max(0, value));
}

function isAbortError(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    (value as { name?: unknown }).name === 'AbortError'
  );
}

export const usePlayerStore = defineStore('player', () => {
  const queue = ref<QueueTrack[]>([]);
  const currentIndex = ref(-1);
  const isPlaying = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const currentTime = ref(0);
  const gapMs = ref(0);
  const countdown = ref<number | null>(null);
  const queueProjectId = ref<string | null>(null);
  const isExamMode = ref(false);
  const loop = ref(false);

  const volume = useStorage<number>('toefl-audio-volume', 0.9);
  const autoAdvance = useStorage<boolean>('toefl-auto-advance', true);
  let autoAdvanceBeforeExam = true;

  const current = computed(() => queue.value[currentIndex.value] ?? null);
  const nextTrack = computed(() => queue.value[currentIndex.value + 1] ?? null);
  const duration = computed(() => {
    const item = current.value;
    return item ? Math.max(0, item.trimEnd - item.trimStart) : 0;
  });
  const progress = computed(() =>
    duration.value > 0 ? Math.min(1, Math.max(0, currentTime.value / duration.value)) : 0,
  );
  const remaining = computed(() => Math.max(0, duration.value - currentTime.value));
  const hasQueue = computed(() => queue.value.length > 0);
  const position = computed(() =>
    currentIndex.value >= 0 ? `${currentIndex.value + 1} / ${queue.value.length}` : '—',
  );

  audio.addEventListener('play', () => {
    isPlaying.value = true;
  });

  audio.addEventListener('pause', () => {
    if (!endHandled) isPlaying.value = false;
  });

  audio.addEventListener('ended', () => {
    void handleEnd();
  });

  audio.addEventListener('error', () => {
    if (!audio.src) return;
    isPlaying.value = false;
    error.value = 'Gagal memutar audio. Coba putar ulang.';
  });

  watch(
    volume,
    (value) => {
      audio.volume = clampVolume(value);
    },
    { immediate: true },
  );

  function clearTimers(): void {
    if (tickTimer !== null) {
      window.clearInterval(tickTimer);
      tickTimer = null;
    }
    if (countdownTimer !== null) {
      window.clearInterval(countdownTimer);
      countdownTimer = null;
    }
    countdown.value = null;
  }

  function makeQueueTrack(track: Track): QueueTrack {
    return {
      id: track.id,
      projectId: track.projectId,
      blobId: track.blobId,
      displayName: track.displayName,
      part: track.part,
      number: track.number,
      trimStart: track.trimStart,
      trimEnd: track.trimEnd,
      duration: track.duration,
    };
  }

  async function resolveUrl(item: QueueTrack): Promise<string> {
    const cached = urlCache.get(item.id);
    if (cached) return cached;

    const record = await db.blobs.get(item.blobId);
    if (!record) {
      throw new Error('File audio tidak ditemukan. Coba impor ulang.');
    }

    const url = URL.createObjectURL(record.blob);
    urlCache.set(item.id, url);
    return url;
  }

  function revokeUrls(): void {
    for (const url of urlCache.values()) {
      URL.revokeObjectURL(url);
    }
    urlCache.clear();
    preloadAudio.removeAttribute('src');
    preloadAudio.load();
  }

  function pruneUrlCache(items: QueueTrack[]): void {
    const ids = new Set(items.map((item) => item.id));
    for (const [id, url] of urlCache) {
      if (!ids.has(id)) {
        URL.revokeObjectURL(url);
        urlCache.delete(id);
      }
    }

    if (preloadAudio.src && !Array.from(urlCache.values()).includes(preloadAudio.src)) {
      preloadAudio.removeAttribute('src');
      preloadAudio.load();
    }
  }

  function waitForMetadata(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (audio.readyState >= 1) {
        resolve();
        return;
      }

      const cleanup = (): void => {
        window.clearTimeout(timeout);
        audio.removeEventListener('loadedmetadata', onLoaded);
        audio.removeEventListener('error', onError);
      };

      const onLoaded = (): void => {
        cleanup();
        resolve();
      };

      const onError = (): void => {
        cleanup();
        reject(new Error('Audio tidak dapat dimuat.'));
      };

      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error('Audio terlalu lama dimuat. Coba lagi.'));
      }, 15_000);

      audio.addEventListener('loadedmetadata', onLoaded, { once: true });
      audio.addEventListener('error', onError, { once: true });
    });
  }

  function fadeIn(durationMs = 40): void {
    const target = clampVolume(volume.value);
    const started = performance.now();

    const step = (): void => {
      const ratio = Math.min(1, (performance.now() - started) / durationMs);
      audio.volume = target * ratio;
      if (ratio < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }

  function startTicker(): void {
    if (tickTimer !== null) window.clearInterval(tickTimer);

    tickTimer = window.setInterval(() => {
      const item = current.value;
      if (!item || !Number.isFinite(audio.currentTime)) return;

      const relative = Math.max(0, audio.currentTime - item.trimStart);
      currentTime.value = Math.min(relative, Math.max(0, item.trimEnd - item.trimStart));

      if (!audio.paused && audio.currentTime >= item.trimEnd - 0.02) {
        void handleEnd();
      }
    }, 80);
  }

  async function loadCurrent(options: LoadOptions = {}): Promise<void> {
    const item = current.value;
    if (!item) return;

    const token = ++loadToken;
    clearTimers();
    endHandled = false;
    currentTime.value = 0;
    error.value = null;
    isLoading.value = true;
    audio.pause();
    audio.volume = 0;

    try {
      const url = await resolveUrl(item);
      if (token !== loadToken) return;

      if (audio.src !== url) {
        audio.src = url;
        audio.load();
        await waitForMetadata();
      }
      if (token !== loadToken) return;

      const maxStart = Math.min(item.trimStart, Math.max(0, audio.duration - 0.05));
      audio.currentTime = maxStart;

      if (options.autoplay ?? true) {
        await audio.play();
        if (token !== loadToken) return;
        isPlaying.value = true;
        fadeIn(40);
        startTicker();
        void preloadNext();
      } else {
        isPlaying.value = false;
        audio.volume = clampVolume(volume.value);
      }
    } catch (errorValue) {
      if (token !== loadToken) return;
      // Pausing or switching tracks while play() is still pending rejects with
      // AbortError. That is normal, not a playback failure worth surfacing.
      if (isAbortError(errorValue)) {
        isPlaying.value = !audio.paused;
        return;
      }
      isPlaying.value = false;
      error.value =
        errorValue instanceof Error ? errorValue.message : 'Gagal memutar audio.';
    } finally {
      if (token === loadToken) isLoading.value = false;
    }
  }

  async function playIndex(index: number, options: LoadOptions = {}): Promise<void> {
    if (index < 0 || index >= queue.value.length) {
      stop();
      return;
    }

    clearTimers();
    currentIndex.value = index;
    endHandled = false;
    await loadCurrent(options);
  }

  function startCountdown(milliseconds: number, nextIndex: number): void {
    if (countdownTimer !== null) window.clearInterval(countdownTimer);

    const endsAt = Date.now() + milliseconds;
    countdown.value = milliseconds / 1000;

    countdownTimer = window.setInterval(() => {
      const remainingMs = Math.max(0, endsAt - Date.now());
      countdown.value = remainingMs / 1000;

      if (remainingMs <= 0) {
        if (countdownTimer !== null) window.clearInterval(countdownTimer);
        countdownTimer = null;
        countdown.value = null;
        void playIndex(nextIndex, { autoplay: true });
      }
    }, 100);
  }

  async function handleEnd(): Promise<void> {
    if (endHandled) return;
    endHandled = true;
    clearTimers();
    audio.pause();

    const item = current.value;
    if (item) {
      currentTime.value = Math.max(0, item.trimEnd - item.trimStart);
    }
    isPlaying.value = false;

    if (loop.value && item) {
      endHandled = false;
      await loadCurrent({ autoplay: true });
      return;
    }

    if (autoAdvance.value && currentIndex.value < queue.value.length - 1) {
      if (gapMs.value > 0) {
        startCountdown(gapMs.value, currentIndex.value + 1);
      } else {
        await playIndex(currentIndex.value + 1, { autoplay: true });
      }
    }
  }

  async function startQueue(
    tracks: Track[],
    startIndex = 0,
    options: StartQueueOptions = {},
  ): Promise<void> {
    const items = tracks.map(makeQueueTrack);
    if (items.length === 0) return;

    const projectId = items[0].projectId;
    if (queueProjectId.value && queueProjectId.value !== projectId) {
      stop();
      revokeUrls();
    } else {
      audio.pause();
    }

    clearTimers();
    pruneUrlCache(items);

    queue.value = items;
    queueProjectId.value = projectId;
    currentIndex.value = Math.max(0, Math.min(startIndex, items.length - 1));
    gapMs.value = options.gapMs ?? gapMs.value;
    if (options.autoAdvance !== undefined) autoAdvance.value = options.autoAdvance;
    endHandled = false;

    await loadCurrent({ autoplay: options.autoplay ?? true });
  }

  async function prepareQueue(
    tracks: Track[],
    startIndex = 0,
    options: Omit<StartQueueOptions, 'autoplay'> = {},
  ): Promise<void> {
    await startQueue(tracks, startIndex, { ...options, autoplay: false });
  }

  function pause(): void {
    audio.pause();
    isPlaying.value = false;
    clearTimers();
  }

  async function toggle(): Promise<void> {
    if (!current.value) return;

    if (isPlaying.value) {
      pause();
      return;
    }

    if (countdown.value !== null) {
      countdown.value = null;
      await playIndex(currentIndex.value + 1, { autoplay: true });
      return;
    }

    if (
      currentTime.value >= duration.value - 0.05 &&
      currentIndex.value < queue.value.length - 1
    ) {
      await playIndex(currentIndex.value + 1, { autoplay: true });
      return;
    }

    if (!audio.src) {
      await loadCurrent({ autoplay: true });
      return;
    }

    try {
      if (currentTime.value >= duration.value - 0.05) {
        audio.currentTime = current.value.trimStart;
        currentTime.value = 0;
      }

      endHandled = false;
      audio.volume = 0;
      await audio.play();
      isPlaying.value = true;
      fadeIn(40);
      startTicker();
      void preloadNext();
    } catch (errorValue) {
      if (isAbortError(errorValue)) {
        isPlaying.value = !audio.paused;
        return;
      }
      error.value =
        errorValue instanceof Error ? errorValue.message : 'Gagal memutar audio.';
    }
  }

  async function next(): Promise<void> {
    if (currentIndex.value < queue.value.length - 1) {
      await playIndex(currentIndex.value + 1, { autoplay: true });
      return;
    }
    pause();
  }

  async function previous(): Promise<void> {
    if (currentTime.value > 3 || currentIndex.value <= 0) {
      await playIndex(Math.max(0, currentIndex.value), { autoplay: true });
      return;
    }
    await playIndex(currentIndex.value - 1, { autoplay: true });
  }

  function seek(relativeSeconds: number): void {
    const item = current.value;
    if (!item) return;

    const max = Math.max(0, item.trimEnd - item.trimStart);
    const safe = Math.max(0, Math.min(relativeSeconds, max));

    if (audio.readyState >= 1) {
      audio.currentTime = item.trimStart + safe;
    }
    currentTime.value = safe;
  }

  function setVolume(value: number): void {
    volume.value = clampVolume(value);
    audio.volume = volume.value;
  }

  function setGap(value: number): void {
    gapMs.value = Math.max(0, Math.min(30_000, Math.round(value)));
  }

  function setAutoAdvance(value: boolean): void {
    autoAdvance.value = value;
  }

  function setLoop(value: boolean): void {
    loop.value = value;
  }

  function updateTrackInQueue(track: Track): void {
    const item = queue.value.find((entry) => entry.id === track.id);
    if (!item) return;

    const isCurrent = current.value?.id === track.id;
    item.displayName = track.displayName;
    item.part = track.part;
    item.number = track.number;
    item.trimStart = track.trimStart;
    item.trimEnd = track.trimEnd;
    item.duration = track.duration;

    if (isCurrent) {
      if (!audio.paused) {
        if (audio.currentTime < item.trimStart) audio.currentTime = item.trimStart;
        if (audio.currentTime >= item.trimEnd) void handleEnd();
      }
      const relative = Math.max(0, audio.currentTime - item.trimStart);
      currentTime.value = Math.min(relative, Math.max(0, item.trimEnd - item.trimStart));
    }
  }

  function syncQueueOrder(tracks: Track[]): void {
    if (queue.value.length === 0 || tracks.length !== queue.value.length) return;

    const trackIds = new Set(tracks.map((track) => track.id));
    if (!queue.value.every((item) => trackIds.has(item.id))) return;

    const currentId = current.value?.id ?? null;
    const byId = new Map(queue.value.map((item) => [item.id, item]));
    const nextQueue = tracks
      .map((track) => byId.get(track.id))
      .filter((item): item is QueueTrack => Boolean(item));

    if (nextQueue.length !== tracks.length) return;

    queue.value = nextQueue;
    currentIndex.value = currentId
      ? nextQueue.findIndex((item) => item.id === currentId)
      : -1;
  }

  function removeTrackFromQueue(id: string): void {
    const index = queue.value.findIndex((item) => item.id === id);
    if (index === -1) return;

    if (index === currentIndex.value) {
      stop();
      queue.value.splice(index, 1);
      currentIndex.value = -1;
      if (queue.value.length === 0) queueProjectId.value = null;
      return;
    }

    queue.value.splice(index, 1);
    if (index < currentIndex.value) currentIndex.value -= 1;
  }

  function stop(): void {
    loadToken += 1;
    clearTimers();
    endHandled = false;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audio.volume = clampVolume(volume.value);
    isPlaying.value = false;
    isLoading.value = false;
    currentTime.value = 0;
  }

  function clearQueue(): void {
    stop();
    queue.value = [];
    currentIndex.value = -1;
    queueProjectId.value = null;
    revokeUrls();
  }

  function clearProjectQueue(projectId: string): void {
    if (queueProjectId.value === projectId) clearQueue();
  }

  function enterExam(): void {
    if (isExamMode.value) return;
    autoAdvanceBeforeExam = autoAdvance.value;
    isExamMode.value = true;
    autoAdvance.value = true;
  }

  function exitExam(): void {
    if (!isExamMode.value) return;
    isExamMode.value = false;
    autoAdvance.value = autoAdvanceBeforeExam;
    pause();
  }

  async function preloadNext(): Promise<void> {
    const nextItem = queue.value[currentIndex.value + 1];
    if (!nextItem) return;

    const token = ++preloadToken;
    try {
      const url = await resolveUrl(nextItem);
      if (token !== preloadToken) return;
      if (preloadAudio.src !== url) {
        preloadAudio.src = url;
        preloadAudio.load();
      }
    } catch {
      // Preloading is an optimization; ignore failures.
    }
  }

  return {
    queue,
    currentIndex,
    current,
    nextTrack,
    isPlaying,
    isLoading,
    error,
    currentTime,
    duration,
    progress,
    remaining,
    gapMs,
    countdown,
    queueProjectId,
    isExamMode,
    loop,
    volume,
    autoAdvance,
    hasQueue,
    position,
    startQueue,
    prepareQueue,
    playIndex,
    toggle,
    pause,
    next,
    previous,
    seek,
    setVolume,
    setGap,
    setAutoAdvance,
    setLoop,
    updateTrackInQueue,
    syncQueueOrder,
    removeTrackFromQueue,
    stop,
    clearQueue,
    clearProjectQueue,
    enterExam,
    exitExam,
  };
});
