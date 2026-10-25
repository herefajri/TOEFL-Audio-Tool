import type { StorageEstimate } from '@/db/types';

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // Storage API is optional; ignore failures.
  }
  return false;
}

export async function getStorageEstimate(): Promise<StorageEstimate> {
  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage ?? null,
        quota: estimate.quota ?? null,
      };
    }
  } catch {
    // Storage API is optional; ignore failures.
  }

  return { usage: null, quota: null };
}
