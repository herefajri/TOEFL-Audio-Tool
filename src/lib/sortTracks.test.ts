import { describe, expect, it } from 'vitest';
import type { Part, Track, TrackKind } from '@/db/types';
import { buildAutoSortPlan, sortTracks } from './sortTracks';

function makeTrack(
  id: string,
  part: Part,
  number: number | null,
  overrides: Partial<Pick<Track, 'displayName' | 'kind' | 'order' | 'createdAt'>> = {},
): Track {
  const kind: TrackKind =
    overrides.kind ?? (number !== null ? 'question' : part === 'FULL' ? 'full' : part === 'A' || part === 'B' || part === 'C' ? 'part' : 'other');

  return {
    id,
    projectId: 'project-1',
    blobId: `blob-${id}`,
    originalName: `${id}.mp3`,
    displayName: overrides.displayName ?? id,
    part,
    number,
    kind,
    order: overrides.order ?? 0,
    duration: 60,
    trimStart: 0,
    trimEnd: 60,
    createdAt: overrides.createdAt ?? 0,
    updatedAt: overrides.createdAt ?? 0,
  };
}

describe('sortTracks', () => {
  it('orders parts A, B, C, FULL, then OTHER', () => {
    const tracks = [
      makeTrack('other', 'OTHER', null),
      makeTrack('full', 'FULL', null),
      makeTrack('c', 'C', 1),
      makeTrack('a', 'A', 1),
      makeTrack('b', 'B', 1),
    ];

    expect(sortTracks(tracks).map((track) => track.id)).toEqual([
      'a',
      'b',
      'c',
      'full',
      'other',
    ]);
  });

  it('sorts by number and puts unnumbered files last', () => {
    const tracks = [
      makeTrack('a-null', 'A', null),
      makeTrack('a-10', 'A', 10),
      makeTrack('a-2', 'A', 2),
      makeTrack('a-1', 'A', 1),
    ];

    expect(sortTracks(tracks).map((track) => track.id)).toEqual([
      'a-1',
      'a-2',
      'a-10',
      'a-null',
    ]);
  });

  it('uses natural name ordering when part and number are equal', () => {
    const tracks = [
      makeTrack('ten', 'A', 1, { displayName: 'Part A 01 (10)' }),
      makeTrack('two', 'A', 1, { displayName: 'Part A 01 (2)' }),
    ];

    expect(sortTracks(tracks).map((track) => track.id)).toEqual(['two', 'ten']);
  });

  it('uses manual order and creation time as final tie-breakers', () => {
    const tracks = [
      makeTrack('later', 'A', 1, { order: 5, createdAt: 1 }),
      makeTrack('earlier', 'A', 1, { order: 1, createdAt: 2 }),
    ];

    expect(sortTracks(tracks).map((track) => track.id)).toEqual(['earlier', 'later']);
  });

  it('does not mutate the input array', () => {
    const tracks = [makeTrack('b', 'B', 1), makeTrack('a', 'A', 1)];
    const originalOrder = tracks.map((track) => track.id);

    sortTracks(tracks);

    expect(tracks.map((track) => track.id)).toEqual(originalOrder);
  });
});

describe('buildAutoSortPlan', () => {
  it('detects when the current order already matches', () => {
    const tracks = [
      makeTrack('a-1', 'A', 1, { order: 0 }),
      makeTrack('b-1', 'B', 1, { order: 1 }),
    ];

    const plan = buildAutoSortPlan(tracks);

    expect(plan.hasChanges).toBe(false);
    expect(plan.sorted.map((track) => track.id)).toEqual(['a-1', 'b-1']);
  });

  it('detects when the order needs to change', () => {
    const tracks = [
      makeTrack('b-1', 'B', 1, { order: 0 }),
      makeTrack('a-1', 'A', 1, { order: 1 }),
    ];

    const plan = buildAutoSortPlan(tracks);

    expect(plan.hasChanges).toBe(true);
    expect(plan.sorted.map((track) => track.id)).toEqual(['a-1', 'b-1']);
  });

  it('reports groups in part order and ignores empty groups', () => {
    const tracks = [
      makeTrack('a-1', 'A', 1),
      makeTrack('a-2', 'A', 2),
      makeTrack('full', 'FULL', null),
    ];

    const plan = buildAutoSortPlan(tracks);

    expect(plan.groups).toEqual([
      { part: 'A', label: 'Part A', count: 2 },
      { part: 'FULL', label: 'Full Set', count: 1 },
    ]);
  });

  it('warns about duplicate numbers within a part', () => {
    const tracks = [makeTrack('a-1', 'A', 1), makeTrack('a-1b', 'A', 1)];

    const plan = buildAutoSortPlan(tracks);

    expect(plan.warnings.some((warning) => warning.type === 'duplicate')).toBe(true);
  });

  it('warns when a part mixes whole-part and per-question files', () => {
    const tracks = [
      makeTrack('a-part', 'A', null, { kind: 'part' }),
      makeTrack('a-1', 'A', 1, { kind: 'question' }),
    ];

    const plan = buildAutoSortPlan(tracks);

    expect(plan.warnings.some((warning) => warning.type === 'mixed')).toBe(true);
  });

  it('warns about multiple full-set files', () => {
    const tracks = [makeTrack('full-1', 'FULL', null), makeTrack('full-2', 'FULL', null)];

    const plan = buildAutoSortPlan(tracks);

    expect(plan.warnings.some((warning) => warning.type === 'multiple-full')).toBe(true);
  });

  it('warns about unnumbered files mixed with numbered files', () => {
    const tracks = [makeTrack('a-1', 'A', 1), makeTrack('a-null', 'A', null)];

    const plan = buildAutoSortPlan(tracks);

    expect(plan.warnings.some((warning) => warning.type === 'unnumbered')).toBe(true);
  });

  it('warns about unnumbered OTHER files', () => {
    const plan = buildAutoSortPlan([makeTrack('welcome', 'OTHER', null)]);

    expect(plan.warnings.some((warning) => warning.type === 'other')).toBe(true);
  });

  it('warns when a full set is combined with other files', () => {
    const tracks = [makeTrack('full', 'FULL', null), makeTrack('a-1', 'A', 1)];

    const plan = buildAutoSortPlan(tracks);

    expect(plan.warnings.some((warning) => warning.type === 'full')).toBe(true);
  });
});
