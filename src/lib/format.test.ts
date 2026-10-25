import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration, formatGap, formatTimecode } from './format';

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(600)).toBe('10:00');
  });

  it('formats hours when needed', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('handles invalid input', () => {
    expect(formatDuration(-1)).toBe('0:00');
    expect(formatDuration(Number.NaN)).toBe('0:00');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});

describe('formatTimecode', () => {
  it('formats timecodes with centiseconds', () => {
    expect(formatTimecode(0)).toBe('0:00.00');
    expect(formatTimecode(5.25)).toBe('0:05.25');
    expect(formatTimecode(65.34)).toBe('1:05.34');
    expect(formatTimecode(125.5)).toBe('2:05.50');
  });

  it('carries rounded centiseconds into the next second', () => {
    expect(formatTimecode(59.999)).toBe('1:00.00');
  });

  it('handles invalid input', () => {
    expect(formatTimecode(-2)).toBe('0:00.00');
    expect(formatTimecode(Number.NaN)).toBe('0:00.00');
  });
});

describe('formatGap', () => {
  it('formats whole and fractional seconds', () => {
    expect(formatGap(0)).toBe('0 detik');
    expect(formatGap(2000)).toBe('2 detik');
    expect(formatGap(2500)).toBe('2.5 detik');
  });

  it('handles invalid input', () => {
    expect(formatGap(-100)).toBe('0 detik');
    expect(formatGap(Number.NaN)).toBe('0 detik');
  });
});

describe('formatBytes', () => {
  it('formats bytes with sensible precision', () => {
    expect(formatBytes(0)).toBe('0 MB');
    expect(formatBytes(null)).toBe('0 MB');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB');
    expect(formatBytes(15 * 1024 * 1024)).toBe('15.0 MB');
    expect(formatBytes(1024 ** 3)).toBe('1.00 GB');
  });
});
