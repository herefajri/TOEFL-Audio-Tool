import { describe, expect, it } from 'vitest';
import {
  MAX_AUDIO_BYTES,
  fileExtension,
  guessMimeType,
  isSupportedAudioFile,
  normalizeAudioBlob,
} from './audio';

function makeFile(name: string, type = ''): File {
  return new File(['audio'], name, { type });
}

describe('fileExtension', () => {
  it('returns a lowercase extension', () => {
    expect(fileExtension('Part A 01.MP3')).toBe('mp3');
    expect(fileExtension('audio.wav')).toBe('wav');
  });

  it('returns an empty string when there is no real extension', () => {
    expect(fileExtension('mp3')).toBe('');
    expect(fileExtension('audio')).toBe('');
    expect(fileExtension('.mp3')).toBe('');
    expect(fileExtension('audio.')).toBe('');
  });
});

describe('isSupportedAudioFile', () => {
  it('accepts .mp3, .wav, .mpeg, and .mpg files', () => {
    expect(isSupportedAudioFile(makeFile('Part A 01.mp3', 'audio/mpeg'))).toBe(true);
    expect(isSupportedAudioFile(makeFile('Part B 01.wav', 'audio/wav'))).toBe(true);
    expect(isSupportedAudioFile(makeFile('WhatsApp Audio.mpeg', 'audio/mpeg'))).toBe(true);
    expect(isSupportedAudioFile(makeFile('WhatsApp Audio.mpg', 'video/mpeg'))).toBe(true);
  });

  it('accepts a valid extension when the browser provides no MIME type', () => {
    expect(isSupportedAudioFile(makeFile('track.wav'))).toBe(true);
    expect(isSupportedAudioFile(makeFile('track.mpeg'))).toBe(true);
  });

  it('accepts generic MIME types for .mpeg audio', () => {
    expect(
      isSupportedAudioFile(makeFile('track.mpeg', 'application/octet-stream')),
    ).toBe(true);
  });

  it('is case-insensitive for the extension and MIME type', () => {
    expect(isSupportedAudioFile(makeFile('TRACK.MP3', 'AUDIO/MPEG'))).toBe(true);
  });

  it('rejects unsupported formats and mismatched MIME types', () => {
    expect(isSupportedAudioFile(makeFile('track.ogg', 'audio/ogg'))).toBe(false);
    expect(isSupportedAudioFile(makeFile('track.mp3', 'text/plain'))).toBe(false);
    expect(isSupportedAudioFile(makeFile('track.mpeg', 'text/plain'))).toBe(false);
    expect(isSupportedAudioFile(makeFile('mp3'))).toBe(false);
    expect(isSupportedAudioFile(makeFile('track.wav', 'audio/ogg'))).toBe(false);
  });
});

describe('guessMimeType', () => {
  it('returns the correct MIME type for supported extensions', () => {
    expect(guessMimeType('track.wav')).toBe('audio/wav');
    expect(guessMimeType('TRACK.WAV')).toBe('audio/wav');
    expect(guessMimeType('track.mp3')).toBe('audio/mpeg');
    expect(guessMimeType('WhatsApp Audio.mpeg')).toBe('audio/mpeg');
  });
});

describe('normalizeAudioBlob', () => {
  it('normalizes .mpeg files to audio/mpeg', () => {
    const file = makeFile('WhatsApp Audio.mpeg', 'video/mpeg');
    const blob = normalizeAudioBlob(file);

    expect(blob.type).toBe('audio/mpeg');
    expect(blob.size).toBe(file.size);
  });

  it('keeps the existing MIME type when it is already correct', () => {
    const file = makeFile('track.mp3', 'audio/mpeg');
    expect(normalizeAudioBlob(file)).toBe(file);
  });
});

describe('MAX_AUDIO_BYTES', () => {
  it('is 300 MB', () => {
    expect(MAX_AUDIO_BYTES).toBe(300 * 1024 * 1024);
  });
});
