import type { Part, TrackKind } from '@/db/types';

export interface ParsedTrackName {
  part: Part;
  number: number | null;
  kind: TrackKind;
}

const FULL_PATTERNS = [
  /\bfull\s*(test|listening|audio|set)\b/i,
  /\bcomplete\s*(test|listening|set)\b/i,
  /\bsatu\s*set\b/i,
  /\bkeseluruhan\b/i,
  /\ball\s*parts?\b/i,
  /\b(listening|toefl)\s*full\b/i,
  /^\s*full\s*$/i,
];

function baseName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripDatesAndTimes(value: string): string {
  return value
    .replace(/\b\d{4}[-_.]\d{1,2}[-_.]\d{1,2}\b/g, ' ')
    .replace(/\b\d{1,2}[-_.]\d{1,2}[-_.]\d{4}\b/g, ' ')
    .replace(/\b\d{1,2}[.:]\d{2}(?:[.:]\d{2})?\s*(?:am|pm)?\b/gi, ' ');
}

/**
 * Best-effort parser for common TOEFL audio filenames.
 * Users can always correct Part/No manually in the track table.
 */
export function parseTrackName(fileName: string): ParsedTrackName {
  const name = baseName(fileName);
  const lower = name.toLowerCase();

  const containsPart =
    /\bpart\s*[abc]\b/i.test(lower) || /^[abc](?=[\s._-]|\d)/i.test(lower);

  if (!containsPart && FULL_PATTERNS.some((pattern) => pattern.test(lower))) {
    return { part: 'FULL', number: null, kind: 'full' };
  }

  let part: Part = 'OTHER';
  const partMatch =
    lower.match(/\bpart\s*([abc])\b/) ??
    lower.match(/^([abc])(?=[\s._-]|\d)/) ??
    lower.match(/\b([abc])\s*(?:\d{1,3})\b/);

  if (partMatch) {
    part = partMatch[1].toUpperCase() as Part;
  }

  let number: number | null = null;
  const numberSource = stripDatesAndTimes(lower);
  const numberPatterns = [
    /\bpart\s*[abc]\s*[-_.:]?\s*(\d{1,3})\b/i,
    /^[abc]\s*[-_.:]?\s*(\d{1,3})\b/i,
    /\b(?:question|soal|track|audio|item|conversation|lecture|dialog)\s*[-_.:]?\s*(\d{1,3})\b/i,
    /\b(\d{1,3})\b/,
  ];

  for (const pattern of numberPatterns) {
    const match = numberSource.match(pattern);
    if (match) {
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value)) {
        number = value;
        break;
      }
    }
  }

  if (part === 'OTHER' && number === null) {
    return { part: 'OTHER', number: null, kind: 'other' };
  }

  if (number !== null) {
    return { part, number, kind: 'question' };
  }

  return {
    part,
    number: null,
    kind: part === 'OTHER' ? 'other' : 'part',
  };
}
