import type { Part, Project, Track } from '@/db/types';
import { MAX_GAP_MS } from '@/db/types';
import { fitTrimRange } from './audio';

export const PRESET_APP = 'toefl-audio-tools';
export const PRESET_VERSION = 1;
export const MAX_PRESET_BYTES = 2 * 1024 * 1024;

const PARTS: readonly Part[] = ['A', 'B', 'C', 'FULL', 'OTHER'];

export interface PresetTrack {
  originalName: string;
  displayName: string;
  part: Part;
  number: number | null;
  order: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
}

export interface SessionPreset {
  app: typeof PRESET_APP;
  version: typeof PRESET_VERSION;
  project: { name: string; gapMs: number };
  tracks: PresetTrack[];
}

export function buildPreset(project: Project, tracks: Track[]): SessionPreset {
  return {
    app: PRESET_APP,
    version: PRESET_VERSION,
    project: { name: project.name, gapMs: project.gapMs },
    tracks: tracks
      .filter((track) => !track.deletedAt)
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
      .map((track) => ({
        originalName: track.originalName,
        displayName: track.displayName,
        part: track.part,
        number: track.number,
        order: track.order,
        duration: track.duration,
        trimStart: track.trimStart,
        trimEnd: track.trimEnd,
      })),
  };
}

export function parsePreset(text: string): SessionPreset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('File preset bukan JSON yang valid.');
  }

  if (!isRecord(raw)) throw new Error('Format preset tidak dikenali.');
  if (raw.app !== PRESET_APP) throw new Error('File ini bukan preset TOEFL Audio Tools.');
  if (raw.version !== PRESET_VERSION) throw new Error('Versi preset tidak didukung.');

  const project = isRecord(raw.project) ? raw.project : {};
  const name =
    typeof project.name === 'string' ? project.name.trim().slice(0, 80) : '';
  if (!name) throw new Error('Nama sesi di preset tidak valid.');

  const gapMs = clampGap(project.gapMs);

  if (!Array.isArray(raw.tracks)) throw new Error('Daftar audio di preset tidak valid.');

  const tracks = raw.tracks.map((item, index) => parseTrack(item, index));
  tracks.sort((a, b) => a.order - b.order);
  tracks.forEach((track, index) => {
    track.order = index + 1;
  });

  return {
    app: PRESET_APP,
    version: PRESET_VERSION,
    project: { name, gapMs },
    tracks,
  };
}

export function presetFileName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return `preset-${slug || 'sesi'}.json`;
}

export function downloadPreset(preset: SessionPreset): void {
  const blob = new Blob([JSON.stringify(preset, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = presetFileName(preset.project.name);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseTrack(value: unknown, index: number): PresetTrack {
  if (!isRecord(value)) throw new Error(`Track ke-${index + 1} tidak valid.`);

  const originalName =
    typeof value.originalName === 'string'
      ? value.originalName.trim().slice(0, 300)
      : '';
  if (!originalName) {
    throw new Error(`Track ke-${index + 1} tidak memiliki nama file asli.`);
  }

  const part = value.part;
  if (typeof part !== 'string' || !PARTS.includes(part as Part)) {
    throw new Error(`Track ke-${index + 1} memiliki Part tidak valid.`);
  }

  const duration = Math.max(0, toFiniteNumber(value.duration, 0));
  const trim = fitTrimRange(
    toFiniteNumber(value.trimStart, 0),
    toFiniteNumber(value.trimEnd, duration),
    duration,
  );
  const number =
    part === 'FULL'
      ? null
      : typeof value.number === 'number' &&
          Number.isFinite(value.number) &&
          value.number > 0
        ? Math.trunc(value.number)
        : null;
  const displayName =
    typeof value.displayName === 'string' && value.displayName.trim()
      ? value.displayName.trim().slice(0, 160)
      : originalName;

  return {
    originalName,
    displayName,
    part: part as Part,
    number,
    order: toFiniteNumber(value.order, index + 1),
    duration,
    trimStart: trim.trimStart,
    trimEnd: trim.trimEnd,
  };
}

function clampGap(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_GAP_MS, Math.round(value)));
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
