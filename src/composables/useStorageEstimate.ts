import { onMounted, ref } from 'vue';
import { getStorageEstimate } from '@/lib/storage';

export function useStorageEstimate() {
  const usage = ref<number | null>(null);
  const quota = ref<number | null>(null);
  const loading = ref(false);

  async function refresh(): Promise<void> {
    loading.value = true;
    try {
      const estimate = await getStorageEstimate();
      usage.value = estimate.usage;
      quota.value = estimate.quota;
    } finally {
      loading.value = false;
    }
  }

  onMounted(refresh);

  return { usage, quota, loading, refresh };
}
