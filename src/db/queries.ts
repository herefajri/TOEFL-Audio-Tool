import { db } from './index';
import type { Project, ProjectSummary, Track } from './types';

export async function loadProjectSummaries(): Promise<ProjectSummary[]> {
  const [projects, tracks] = await Promise.all([db.projects.toArray(), db.tracks.toArray()]);
  const visible = tracks.filter((track) => !track.deletedAt);
  const byProject = new Map<string, Track[]>();

  for (const track of visible) {
    const list = byProject.get(track.projectId) ?? [];
    list.push(track);
    byProject.set(track.projectId, list);
  }

  return projects
    .map((project) => {
      const list = byProject.get(project.id) ?? [];
      return {
        ...project,
        trackCount: list.length,
        totalDuration: list.reduce(
          (sum, track) => sum + Math.max(0, track.trimEnd - track.trimStart),
          0,
        ),
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function loadTracks(projectId: string): Promise<Track[]> {
  const tracks = await db.tracks.where('projectId').equals(projectId).toArray();

  return tracks
    .filter((track) => !track.deletedAt)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export async function loadBlob(blobId: string): Promise<Blob | undefined> {
  const record = await db.blobs.get(blobId);
  return record?.blob;
}
