import Dexie, { type Table } from 'dexie';
import type { AudioBlobRecord, Project, Track } from './types';

class ToeflAudioDB extends Dexie {
  projects!: Table<Project, string>;
  tracks!: Table<Track, string>;
  blobs!: Table<AudioBlobRecord, string>;

  constructor() {
    super('toefl-audio-tools');
    this.version(1).stores({
      projects: 'id, updatedAt, name',
      tracks: 'id, projectId, order, [projectId+order], deletedAt',
      blobs: 'id',
    });
  }
}

export const db = new ToeflAudioDB();

/**
 * Removes soft-deleted tracks left behind by a closed tab,
 * plus any blob that is no longer referenced by a track.
 */
export async function cleanupStaleData(): Promise<void> {
  try {
    const stale = await db.tracks
      .filter((track) => !!track.deletedAt && Date.now() - (track.deletedAt ?? 0) > 60_000)
      .toArray();

    if (stale.length > 0) {
      await db.transaction('rw', db.tracks, async () => {
        for (const track of stale) {
          await db.tracks.delete(track.id);
        }
      });
    }

    // Delete only blobs that are no longer referenced. Cropped copies share
    // their original blob, so removing one track must not remove the audio.
    const tracks = await db.tracks.toArray();
    const referenced = new Set(tracks.map((track) => track.blobId));
    const orphanBlobs = (await db.blobs.toArray()).filter((blob) => !referenced.has(blob.id));

    if (orphanBlobs.length > 0) {
      await db.blobs.bulkDelete(orphanBlobs.map((blob) => blob.id));
    }
  } catch (error) {
    console.error('Gagal membersihkan data lama:', error);
  }
}
