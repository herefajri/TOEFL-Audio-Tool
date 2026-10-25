export const MAX_AUDIO_BYTES = 300 * 1024 * 1024;

const VALID_EXTENSIONS = new Set(['mp3', 'wav', 'mpeg', 'mpg']);
const MPEG_EXTENSIONS = new Set(['mpeg', 'mpg']);
const VALID_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/x-mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
]);
const MPEG_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/x-mpeg',
  'video/mpeg',
  'application/octet-stream',
]);

export function fileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === fileName.length - 1) return '';
  return fileName.slice(lastDot + 1).toLowerCase();
}

export function isSupportedAudioFile(file: File): boolean {
  const extension = fileExtension(file.name);
  if (!VALID_EXTENSIONS.has(extension)) return false;

  if (!file.type) return true;
  const mimeType = file.type.toLowerCase();
  if (MPEG_EXTENSIONS.has(extension)) {
    return MPEG_MIME_TYPES.has(mimeType);
  }
  return VALID_MIME_TYPES.has(mimeType);
}

export function guessMimeType(fileName: string): string {
  return fileExtension(fileName) === 'wav' ? 'audio/wav' : 'audio/mpeg';
}

/**
 * Normalize the MIME type before playback/storage. Some WhatsApp exports use
 * a `.mpeg` extension while the actual content is MP3 audio.
 */
export function normalizeAudioBlob(file: File): Blob {
  const mimeType = guessMimeType(file.name);
  if (file.type.toLowerCase() === mimeType) return file;
  return file.slice(0, file.size, mimeType);
}

export function getAudioDuration(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;

    const cleanup = (): void => {
      window.clearTimeout(timeout);
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
    };

    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const timeout = window.setTimeout(() => {
      finish(() => reject(new Error('Durasi audio tidak terbaca. Coba file lain.')));
    }, 20_000);

    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      if (Number.isFinite(duration) && duration > 0) {
        finish(() => resolve(duration));
      } else {
        finish(() => reject(new Error('Durasi audio tidak valid.')));
      }
    };
    audio.onerror = () => {
      finish(() => reject(new Error('Format audio tidak didukung browser.')));
    };
    audio.src = url;
  });
}
