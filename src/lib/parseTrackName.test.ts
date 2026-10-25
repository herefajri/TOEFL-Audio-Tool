import { describe, expect, it } from 'vitest';
import { parseTrackName } from './parseTrackName';

describe('parseTrackName', () => {
  it('parses "Part A 01.mp3"', () => {
    expect(parseTrackName('Part A 01.mp3')).toEqual({
      part: 'A',
      number: 1,
      kind: 'question',
    });
  });

  it('parses lowercase names with underscores', () => {
    expect(parseTrackName('part_c_03.mp3')).toEqual({
      part: 'C',
      number: 3,
      kind: 'question',
    });
  });

  it('parses a compact letter-number name', () => {
    expect(parseTrackName('A1.mp3')).toEqual({
      part: 'A',
      number: 1,
      kind: 'question',
    });
  });

  it('parses a letter followed by a space and a number', () => {
    expect(parseTrackName('C 07.wav')).toEqual({
      part: 'C',
      number: 7,
      kind: 'question',
    });
  });

  it('parses a part with extra description after the number', () => {
    expect(parseTrackName('Part A - 01 - Conversation.mp3')).toEqual({
      part: 'A',
      number: 1,
      kind: 'question',
    });
  });

  it('parses a part file without a number', () => {
    expect(parseTrackName('Part A.mp3')).toEqual({
      part: 'A',
      number: null,
      kind: 'part',
    });
  });

  it('recognises full-test files', () => {
    expect(parseTrackName('Full Test.mp3')).toEqual({
      part: 'FULL',
      number: null,
      kind: 'full',
    });
    expect(parseTrackName('TOEFL Full.mp3').part).toBe('FULL');
    expect(parseTrackName('full.mp3').kind).toBe('full');
  });

  it('keeps generic numbered audio as OTHER with a number', () => {
    expect(parseTrackName('Lecture 05.mp3')).toEqual({
      part: 'OTHER',
      number: 5,
      kind: 'question',
    });
    expect(parseTrackName('01.mp3').part).toBe('OTHER');
  });

  it('uses OTHER when the part letter is unfamiliar', () => {
    expect(parseTrackName('Part D 01.mp3')).toEqual({
      part: 'OTHER',
      number: 1,
      kind: 'question',
    });
  });

  it('falls back to OTHER without a number', () => {
    expect(parseTrackName('welcome.mp3')).toEqual({
      part: 'OTHER',
      number: null,
      kind: 'other',
    });
  });

  it('ignores dates and times in WhatsApp audio names', () => {
    expect(parseTrackName('WhatsApp Audio 2025-12-05 at 5.21.13 PM.mpeg')).toEqual({
      part: 'OTHER',
      number: null,
      kind: 'other',
    });
  });

  it('still reads the track number when a date is present', () => {
    expect(parseTrackName('Part A 01 2025-12-05.mp3')).toEqual({
      part: 'A',
      number: 1,
      kind: 'question',
    });
  });
});
