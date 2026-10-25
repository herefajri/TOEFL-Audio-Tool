import { db } from './index';
import type { ImportResult, Part, Track, TrackKind } from './types';
import {
  getAudioDuration,
  guessMimeType,
  isSupportedAudioFile,
  MAX_AUDIO_BYTES,
  normalizeAudioBlob,
} from '@/lib/audio';
import { createId } from '@/lib/id';
import { uniqueDisplayName } from '@/lib/names';
import { parseTrackName } from '@/lib/parseTrackName';
import { touchProject } from './projects';

export interface ImportProgress {
  done: number;
  total: number;
  currentName: string;
}

type ProgressHandler = (progress: ImportProgress) => void;

export interface TrackMetaPatch {
  displayName?: string;
  part?: Part;
  number?: number | null;
}

export interface OrderPatch {
  id: string;
  order: number;
}

const deleteTimers = new Map<string, number>();

function deriveKind(part: Part, number: number | null): TrackKind {
  if (part === 'FULL') return 'full';
  if (number !== null) return 'question';
  if (part === 'OTHER') return 'other';
  return 'part';
}

function uniqueTrackName(usedNames: Set<string>, base: string): string {
  const clean = base.trim().slice(0, 160) || 'Audio';
  if (!usedNames.has(clean)) return clean;

  let counter = 2;
  while (usedNames.has(`${clean} (${counter})`)) counter += 1;
  return `${clean} (${counter})`;
}

export async function importAudioFiles(
  projectId: string,
  files: File[],
  onProgress?: ProgressHandler,
): Promise<ImportResult> {
  const existing = await db.tracks.where('projectId').equals(projectId).toArray();
  const visible = existing.filter((track) => !track.deletedAt);
  const usedNames = new Set(visible.map((track) => track.displayName));
  let nextOrder = visible.reduce((max, track) => Math.max(max, track.order), 0) + 1;

  const imported: Track[] = [];
  const errors: ImportResult['errors'] = [];
  let done = 0;

  for (const file of files) {
    onProgress?.({ done, total: files.length, currentName: file.name });
    try {
      if (file.size > MAX_AUDIO_BYTES) {
        throw new Error('Ukuran file melebihi 300 MB.');
      }
      if (!isSupportedAudioFile(file)) {
        throw new Error('Format tidak didukung. Gunakan MP3, WAV, atau MPEG audio.');
      }

      const audioBlob = normalizeAudioBlob(file);
      const duration = await getAudioDuration(audioBlob);
      const meta = parseTrackName(file.name);
      const displayName = uniqueDisplayName(usedNames, file.name);
      const blobId = createId();
      const trackId = createId();
      const timestamp = Date.now();

      const track: Track = {
        id: trackId,
        projectId,
        blobId,
        originalName: file.name,
        displayName,
        part: meta.part,
        number: meta.number,
        kind: meta.kind,
        order: nextOrder,
        duration,
        trimStart: 0,
        trimEnd: duration,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await db.transaction('rw', db.blobs, db.tracks, async () => {
        await db.blobs.add({
          id: blobId,
          blob: audioBlob,
          mimeType: guessMimeType(file.name),
          size: audioBlob.size,
        });
        await db.tracks.add(track);
      });

      usedNames.add(displayName);
      nextOrder += 1;
      imported.push(track);
    } catch (error) {
      errors.push({
        fileName: file.name,
        message: error instanceof Error ? error.message : 'Gagal mengimpor file.',
      });
    } finally {
      done += 1;
      onProgress?.({ done, total: files.length, currentName: file.name });
    }
  }

  if (imported.length > 0) await touchProject(projectId);
  return { imported, errors };
}

export async function updateTrackMeta(id: string, patch: TrackMetaPatch): Promise<Track | undefined> {
  const track = await db.tracks.get(id);
  if (!track) return undefined;

  const next: Track = { ...track, updatedAt: Date.now() };

  if (patch.displayName !== undefined) {
    const name = patch.displayName.trim();
    if (!name) throw new Error('Nama audio tidak boleh kosong.');
    next.displayName = name.slice(0, 160);
  }

  if (patch.part !== undefined) next.part = patch.part;
  if (patch.number !== undefined) {
    next.number =
      patch.number === null || !Number.isFinite(patch.number)
        ? null
        : Math.max(1, Math.trunc(patch.number));
  }

  if (next.part === 'FULL') next.number = null;
  next.kind = deriveKind(next.part, next.number);

  await db.tracks.put(next);
  await touchProject(track.projectId);
  return next;
}

export async function saveTrackCrop(
  id: string,
  trimStart: number,
  trimEnd: number,
): Promise<Track | undefined> {
  const track = await db.tracks.get(id);
  if (!track) return undefined;

  const start = Math.max(0, Math.min(trimStart, track.duration));
  const end = Math.max(0, Math.min(trimEnd, track.duration));

  if (end - start < 0.1) {
    throw new Error('Potongan minimal 0,1 detik.');
  }

  const next: Track = {
    ...track,
    trimStart: Math.round(start * 1000) / 1000,
    trimEnd: Math.round(end * 1000) / 1000,
    updatedAt: Date.now(),
  };

  await db.tracks.put(next);
  await touchProject(track.projectId);
  return next;
}

export async function duplicateTrackCrop(
  id: string,
  trimStart: number,
  trimEnd: number,
): Promise<Track | undefined> {
  const track = await db.tracks.get(id);
  if (!track || track.deletedAt) return undefined;

  const start = Math.max(0, Math.min(trimStart, track.duration));
  const end = Math.max(0, Math.min(trimEnd, track.duration));

  if (end - start < 0.1) {
    throw new Error('Potongan minimal 0,1 detik.');
  }

  const siblings = await db.tracks.where('projectId').equals(track.projectId).toArray();
  const usedNames = new Set(
    siblings.filter((item) => !item.deletedAt).map((item) => item.displayName),
  );
  const timestamp = Date.now();
  const copy: Track = {
    id: createId(),
    projectId: track.projectId,
    blobId: track.blobId,
    originalName: track.originalName,
    displayName: uniqueTrackName(usedNames, `${track.displayName} (potongan)`),
    part: track.part,
    number: track.number,
    kind: track.kind,
    order: track.order + 1,
    duration: track.duration,
    trimStart: Math.round(start * 1000) / 1000,
    trimEnd: Math.round(end * 1000) / 1000,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.transaction('rw', db.tracks, async () => {
    for (const sibling of siblings) {
      if (sibling.order >= copy.order) {
        await db.tracks.update(sibling.id, { order: sibling.order + 1 });
      }
    }
    await db.tracks.add(copy);
  });

  await touchProject(track.projectId);
  return copy;
}

export async function resetTrackCrop(id: string): Promise<Track | undefined> {
  const track = await db.tracks.get(id);
  if (!track) return undefined;
  return saveTrackCrop(id, 0, track.duration);
}

export async function applyTrackOrder(projectId: string, orderedIds: string[]): Promise<void> {
  const timestamp = Date.now();

  await db.transaction('rw', db.tracks, db.projects, async () => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      await db.tracks.update(orderedIds[index], {
        order: index + 1,
        updatedAt: timestamp,
      });
    }
    await db.projects.update(projectId, { updatedAt: timestamp });
  });
}

export async function restoreTrackOrders(projectId: string, orders: OrderPatch[]): Promise<void> {
  await db.transaction('rw', db.tracks, db.projects, async () => {
    for (const item of orders) {
      await db.tracks.update(item.id, { order: item.order, updatedAt: Date.now() });
    }
    await db.projects.update(projectId, { updatedAt: Date.now() });
  });
}

export async function softDeleteTrack(id: string): Promise<void> {
  const track = await db.tracks.get(id);
  if (!track || track.deletedAt) return;

  await db.tracks.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
  await touchProject(track.projectId);
  scheduleHardDelete(id);
}

function scheduleHardDelete(id: string): void {
  const existing = deleteTimers.get(id);
  if (existing !== undefined) window.clearTimeout(existing);

  const timer = window.setTimeout(() => {
    deleteTimers.delete(id);
    void hardDeleteTrack(id);
  }, 12_000);

  deleteTimers.set(id, timer);
}

export async function restoreTrack(id: string): Promise<Track | undefined> {
  const timer = deleteTimers.get(id);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    deleteTimers.delete(id);
  }

  await db.tracks
    .where('id')
    .equals(id)
    .modify((track) => {
      delete track.deletedAt;
      track.updatedAt = Date.now();
    });

  const track = await db.tracks.get(id);
  if (track) await touchProject(track.projectId);
  return track;
}

export async function hardDeleteTrack(id: string): Promise<void> {
  await db.transaction('rw', db.tracks, db.blobs, async () => {
    const track = await db.tracks.get(id);
    if (!track || !track.deletedAt) return;
    await db.tracks.delete(id);

    // Cropped copies share the original blob, so only remove it when no
    // remaining track (including soft-deleted ones) references it.
    const references = await db.tracks
      .filter((item) => item.blobId === track.blobId)
      .count();
    if (references === 0) await db.blobs.delete(track.blobId);
  });
}
