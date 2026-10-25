import { db } from './index';
import type { Project } from './types';
import { MAX_GAP_MS } from './types';
import { createId } from '@/lib/id';
import { requestPersistentStorage } from '@/lib/storage';

export async function createProject(name: string): Promise<Project> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Nama sesi tidak boleh kosong.');

  const timestamp = Date.now();
  const project: Project = {
    id: createId(),
    name: trimmed.slice(0, 80),
    createdAt: timestamp,
    updatedAt: timestamp,
    gapMs: 0,
  };

  await db.projects.add(project);
  void requestPersistentStorage();
  return project;
}

export async function updateProject(
  id: string,
  changes: Partial<Pick<Project, 'name' | 'gapMs'>>,
): Promise<void> {
  const patch: Partial<Project> = { updatedAt: Date.now() };

  if (changes.name !== undefined) {
    const name = changes.name.trim();
    if (!name) throw new Error('Nama sesi tidak boleh kosong.');
    patch.name = name.slice(0, 80);
  }

  if (changes.gapMs !== undefined) {
    patch.gapMs = Math.max(0, Math.min(MAX_GAP_MS, Math.round(changes.gapMs)));
  }

  await db.projects.update(id, patch);
}

export async function touchProject(id: string): Promise<void> {
  await db.projects.update(id, { updatedAt: Date.now() });
}

export async function deleteProject(id: string): Promise<void> {
  const tracks = await db.tracks.where('projectId').equals(id).toArray();
  const blobIds = tracks.map((track) => track.blobId);

  await db.transaction('rw', db.projects, db.tracks, db.blobs, async () => {
    if (blobIds.length > 0) await db.blobs.bulkDelete(blobIds);
    if (tracks.length > 0) await db.tracks.bulkDelete(tracks.map((track) => track.id));
    await db.projects.delete(id);
  });
}
