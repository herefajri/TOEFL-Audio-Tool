import { db } from './index';
import type { Project, Track } from './types';
import { createId } from '@/lib/id';
import type { SessionPreset } from '@/lib/preset';
import { requestPersistentStorage } from '@/lib/storage';
import { deriveTrackKind } from './tracks';

/**
 * Create a new session from a preset. Tracks start without an audio blob and
 * wait for their files to be imported again on this device.
 */
export async function importPreset(preset: SessionPreset): Promise<Project> {
  const timestamp = Date.now();
  const project: Project = {
    id: createId(),
    name: preset.project.name,
    createdAt: timestamp,
    updatedAt: timestamp,
    gapMs: preset.project.gapMs,
  };

  const tracks: Track[] = preset.tracks.map((item, index) => ({
    id: createId(),
    projectId: project.id,
    blobId: '',
    originalName: item.originalName,
    displayName: item.displayName,
    part: item.part,
    number: item.number,
    kind: deriveTrackKind(item.part, item.number),
    order: index + 1,
    duration: item.duration,
    trimStart: item.trimStart,
    trimEnd: item.trimEnd,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  await db.transaction('rw', db.projects, db.tracks, async () => {
    await db.projects.add(project);
    if (tracks.length > 0) await db.tracks.bulkAdd(tracks);
  });

  void requestPersistentStorage();
  return project;
}
