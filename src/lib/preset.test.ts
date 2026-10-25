import { describe, expect, it } from 'vitest';
import type { Project, Track } from '@/db/types';
import {
  PRESET_APP,
  PRESET_VERSION,
  buildPreset,
  parsePreset,
  presetFileName,
} from './preset';

const project: Project = {
  id: 'project-1',
  name: 'Latihan 1',
  createdAt: 1,
  updatedAt: 2,
  gapMs: 5000,
};

function makeTrack(
  overrides: Partial<Track> & Pick<Track, 'id' | 'order' | 'originalName'>,
): Track {
  return {
    projectId: 'project-1',
    blobId: `blob-${overrides.id}`,
    displayName: overrides.originalName,
    part: 'A',
    number: 1,
    kind: 'question',
    duration: 120,
    trimStart: 0,
    trimEnd: 120,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('buildPreset', () => {
  it('stores project settings and track metadata sorted by order', () => {
    const preset = buildPreset(project, [
      makeTrack({
        id: 'b',
        originalName: 'b.mp3',
        order: 2,
        displayName: 'B',
        part: 'B',
        number: 2,
      }),
      makeTrack({ id: 'a', originalName: 'a.mp3', order: 1, trimStart: 3, trimEnd: 90 }),
      makeTrack({ id: 'deleted', originalName: 'x.mp3', order: 3, deletedAt: 1 }),
    ]);

    expect(preset.app).toBe(PRESET_APP);
    expect(preset.version).toBe(PRESET_VERSION);
    expect(preset.project).toEqual({ name: 'Latihan 1', gapMs: 5000 });
    expect(preset.tracks.map((track) => track.originalName)).toEqual(['a.mp3', 'b.mp3']);
    expect(preset.tracks[0]).toEqual({
      originalName: 'a.mp3',
      displayName: 'a.mp3',
      part: 'A',
      number: 1,
      order: 1,
      duration: 120,
      trimStart: 3,
      trimEnd: 90,
    });
    expect(preset.tracks[0]).not.toHaveProperty('blobId');
    expect(preset.tracks[0]).not.toHaveProperty('id');
  });

  it('round-trips through parsePreset', () => {
    const preset = buildPreset(project, [
      makeTrack({ id: 'a', originalName: 'Part A 01.mp3', order: 1 }),
    ]);

    expect(parsePreset(JSON.stringify(preset))).toEqual(preset);
  });
});

describe('parsePreset', () => {
  it('rejects invalid JSON', () => {
    expect(() => parsePreset('not json')).toThrow('File preset bukan JSON yang valid.');
  });

  it('rejects an unsupported app or version', () => {
    expect(() => parsePreset(JSON.stringify({ app: 'other', version: 1 }))).toThrow(
      'File ini bukan preset TOEFL Audio Tools.',
    );
    expect(() => parsePreset(JSON.stringify({ app: PRESET_APP, version: 99 }))).toThrow(
      'Versi preset tidak didukung.',
    );
  });

  it('rejects a preset without a session name', () => {
    expect(() =>
      parsePreset(
        JSON.stringify({
          app: PRESET_APP,
          version: PRESET_VERSION,
          project: { name: '  ' },
          tracks: [],
        }),
      ),
    ).toThrow('Nama sesi di preset tidak valid.');
  });

  it('rejects a track with an invalid part', () => {
    const raw = {
      app: PRESET_APP,
      version: PRESET_VERSION,
      project: { name: 'Sesi', gapMs: 0 },
      tracks: [{ originalName: 'a.mp3', part: 'Z' }],
    };

    expect(() => parsePreset(JSON.stringify(raw))).toThrow(
      'Track ke-1 memiliki Part tidak valid.',
    );
  });

  it('rejects a track without a file name', () => {
    const raw = {
      app: PRESET_APP,
      version: PRESET_VERSION,
      project: { name: 'Sesi', gapMs: 0 },
      tracks: [{ displayName: 'A', part: 'A' }],
    };

    expect(() => parsePreset(JSON.stringify(raw))).toThrow(
      'Track ke-1 tidak memiliki nama file asli.',
    );
  });

  it('normalizes order, gap, numbers, and trim ranges', () => {
    const raw = {
      app: PRESET_APP,
      version: PRESET_VERSION,
      project: { name: '  Latihan  ', gapMs: 99_000 },
      tracks: [
        {
          originalName: 'b.mp3',
          displayName: 'B',
          part: 'A',
          number: 2,
          order: 9,
          duration: 10,
          trimStart: 2,
          trimEnd: 99,
        },
        {
          originalName: 'a.mp3',
          displayName: '  ',
          part: 'FULL',
          number: 3,
          order: 1,
          duration: 10,
          trimStart: -1,
          trimEnd: 4,
        },
      ],
    };

    const preset = parsePreset(JSON.stringify(raw));

    expect(preset.project).toEqual({ name: 'Latihan', gapMs: 30_000 });
    expect(preset.tracks).toEqual([
      {
        originalName: 'a.mp3',
        displayName: 'a.mp3',
        part: 'FULL',
        number: null,
        order: 1,
        duration: 10,
        trimStart: 0,
        trimEnd: 4,
      },
      {
        originalName: 'b.mp3',
        displayName: 'B',
        part: 'A',
        number: 2,
        order: 2,
        duration: 10,
        trimStart: 2,
        trimEnd: 10,
      },
    ]);
  });
});

describe('presetFileName', () => {
  it('builds a safe file name from the session name', () => {
    expect(presetFileName('TOEFL Test #1')).toBe('preset-toefl-test-1.json');
    expect(presetFileName('  ')).toBe('preset-sesi.json');
  });
});
