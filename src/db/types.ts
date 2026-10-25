export type Part = 'A' | 'B' | 'C' | 'FULL' | 'OTHER';

export type TrackKind = 'question' | 'part' | 'full' | 'other';

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Additional silence between tracks, in milliseconds. Defaults to 0. */
  gapMs: number;
}

export interface Track {
  id: string;
  projectId: string;
  blobId: string;
  originalName: string;
  displayName: string;
  part: Part;
  number: number | null;
  kind: TrackKind;
  order: number;
  /** Original duration in seconds. */
  duration: number;
  /** Trim start in seconds (non-destructive). */
  trimStart: number;
  /** Trim end in seconds (non-destructive). */
  trimEnd: number;
  createdAt: number;
  updatedAt: number;
  /** Set while the delete is undoable; hidden from the UI. */
  deletedAt?: number;
}

export interface AudioBlobRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  size: number;
}

export interface ImportError {
  fileName: string;
  message: string;
}

export interface ImportResult {
  imported: Track[];
  errors: ImportError[];
}

export interface ProjectSummary extends Project {
  trackCount: number;
  totalDuration: number;
}

export interface StorageEstimate {
  usage: number | null;
  quota: number | null;
}
