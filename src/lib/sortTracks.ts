import type { Part, Track, TrackKind } from '@/db/types';
import { naturalCompare } from './naturalCompare';

export const PART_ORDER: Record<Part, number> = {
  A: 0,
  B: 1,
  C: 2,
  FULL: 3,
  OTHER: 4,
};

export const PART_LABEL: Record<Part, string> = {
  A: 'Part A',
  B: 'Part B',
  C: 'Part C',
  FULL: 'Full Set',
  OTHER: 'Lainnya',
};

export const PART_OPTIONS: Array<{ value: Part; label: string }> = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'FULL', label: 'Full' },
  { value: 'OTHER', label: 'Lain' },
];

export interface AutoSortWarning {
  type: 'duplicate' | 'mixed' | 'unnumbered' | 'other' | 'full' | 'multiple-full';
  message: string;
}

export interface AutoSortGroup {
  part: Part;
  label: string;
  count: number;
}

export interface AutoSortPlan {
  sorted: Track[];
  groups: AutoSortGroup[];
  warnings: AutoSortWarning[];
  hasChanges: boolean;
}

export function compareTracks(a: Track, b: Track): number {
  const partDiff = PART_ORDER[a.part] - PART_ORDER[b.part];
  if (partDiff !== 0) return partDiff;

  const aNumber = a.number ?? Number.POSITIVE_INFINITY;
  const bNumber = b.number ?? Number.POSITIVE_INFINITY;
  if (aNumber !== bNumber) return aNumber - bNumber;

  const nameDiff = naturalCompare(a.displayName, b.displayName);
  if (nameDiff !== 0) return nameDiff;

  if (a.order !== b.order) return a.order - b.order;
  return a.createdAt - b.createdAt;
}

export function sortTracks(tracks: Track[]): Track[] {
  return [...tracks].sort(compareTracks);
}

export function buildAutoSortPlan(tracks: Track[]): AutoSortPlan {
  const sorted = sortTracks(tracks);
  const warnings: AutoSortWarning[] = [];
  const byPart = new Map<Part, Track[]>();

  for (const track of sorted) {
    const list = byPart.get(track.part) ?? [];
    list.push(track);
    byPart.set(track.part, list);
  }

  const groups: AutoSortGroup[] = (['A', 'B', 'C', 'FULL', 'OTHER'] as Part[])
    .map((part) => ({
      part,
      label: PART_LABEL[part],
      count: byPart.get(part)?.length ?? 0,
    }))
    .filter((group) => group.count > 0);

  for (const [part, list] of byPart) {
    const kinds = new Set<TrackKind>(list.map((track) => track.kind));
    const numbered = list.filter((track) => track.number !== null);
    const unnumbered = list.filter((track) => track.number === null);

    if (kinds.has('part') && kinds.has('question')) {
      warnings.push({
        type: 'mixed',
        message: `${PART_LABEL[part]} berisi file part utuh dan file per soal. Pastikan tidak dobel.`,
      });
    }

    if (part === 'FULL' && list.length > 1) {
      warnings.push({
        type: 'multiple-full',
        message: `Ada ${list.length} file Full Set. Biasanya cukup satu file untuk satu sesi.`,
      });
    }

    if (unnumbered.length > 0 && numbered.length > 0) {
      warnings.push({
        type: 'unnumbered',
        message: `${PART_LABEL[part]} punya ${unnumbered.length} file tanpa nomor. File tanpa nomor diletakkan setelah file bernomor.`,
      });
    }

    if (part === 'OTHER' && unnumbered.length > 0) {
      warnings.push({
        type: 'other',
        message: `${unnumbered.length} file tidak punya Part/No dan akan diletakkan di akhir. Atur manual jika perlu.`,
      });
    }

    const byNumber = new Map<number, Track[]>();
    for (const track of numbered) {
      if (track.number === null) continue;
      const listByNumber = byNumber.get(track.number) ?? [];
      listByNumber.push(track);
      byNumber.set(track.number, listByNumber);
    }

    for (const [number, duplicates] of byNumber) {
      if (duplicates.length > 1) {
        warnings.push({
          type: 'duplicate',
          message: `${PART_LABEL[part]} punya ${duplicates.length} file dengan nomor ${number}.`,
        });
      }
    }
  }

  if (sorted.some((track) => track.part === 'FULL') && sorted.some((track) => track.part !== 'FULL')) {
    warnings.push({
      type: 'full',
      message: 'Ada file Full Set bersama file lain. Pastikan tidak dobel.',
    });
  }

  const currentOrder = [...tracks]
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
    .map((track) => track.id);
  const hasChanges = sorted.some((track, index) => track.id !== currentOrder[index]);

  return { sorted, groups, warnings, hasChanges };
}
