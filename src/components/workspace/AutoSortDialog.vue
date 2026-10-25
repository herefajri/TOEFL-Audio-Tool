<script setup lang="ts">
import { computed, ref } from 'vue';
import { toast } from 'vue-sonner';
import { AlertTriangle, ArrowDownUp, CheckCircle2 } from 'lucide-vue-next';
import type { Track } from '@/db/types';
import { applyTrackOrder, restoreTrackOrders, type OrderPatch } from '@/db/tracks';
import { buildAutoSortPlan } from '@/lib/sortTracks';
import AppButton from '@/components/ui/AppButton.vue';
import AppModal from '@/components/ui/AppModal.vue';
import PartBadge from '@/components/ui/PartBadge.vue';

const props = defineProps<{
  open: boolean;
  tracks: Track[];
  projectId: string;
}>();

const emit = defineEmits<{
  close: [];
  applied: [tracks: Track[]];
  restored: [tracks: Track[]];
}>();

const applying = ref(false);
const plan = computed(() => buildAutoSortPlan(props.tracks));

async function apply(): Promise<void> {
  if (applying.value || plan.value.sorted.length === 0) return;

  const snapshot = [...props.tracks];
  const previousOrders: OrderPatch[] = snapshot.map((track) => ({
    id: track.id,
    order: track.order,
  }));

  applying.value = true;
  try {
    await applyTrackOrder(
      props.projectId,
      plan.value.sorted.map((track) => track.id),
    );

    emit('applied', plan.value.sorted);

    toast.success('Urutan otomatis diterapkan', {
      duration: 9000,
      action: {
        label: 'Batalkan',
        onClick: () => {
          void undo(snapshot, previousOrders);
        },
      },
    });

    emit('close');
  } catch (errorValue) {
    toast.error(
      errorValue instanceof Error ? errorValue.message : 'Gagal menerapkan urutan.',
    );
  } finally {
    applying.value = false;
  }
}

async function undo(snapshot: Track[], previousOrders: OrderPatch[]): Promise<void> {
  try {
    await restoreTrackOrders(props.projectId, previousOrders);
    const orderMap = new Map(previousOrders.map((item) => [item.id, item.order]));
    const restored = [...snapshot].sort(
      (a, b) => (orderMap.get(a.id) ?? a.order) - (orderMap.get(b.id) ?? b.order),
    );
    emit('restored', restored);
    toast.success('Urutan dikembalikan');
  } catch (errorValue) {
    toast.error(
      errorValue instanceof Error ? errorValue.message : 'Gagal mengembalikan urutan.',
    );
  }
}
</script>

<template>
  <AppModal
    :open="open"
    title="Urutkan otomatis"
    description="Urutan disusun dari Part (A, B, C), lalu nomor audio. Tinjau hasilnya sebelum diterapkan."
    size="xl"
    @close="emit('close')"
  >
    <div v-if="tracks.length === 0" class="rounded-md border border-line bg-canvas px-4 py-8 text-center text-sm text-muted">
      Belum ada audio untuk diurutkan.
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <PartBadge v-for="group in plan.groups" :key="group.part" :part="group.part" />
        <span class="text-xs text-muted">{{ plan.sorted.length }} audio</span>
      </div>

      <div
        v-if="plan.warnings.length > 0"
        class="mt-4 rounded-md border border-warn/25 bg-warn-soft p-3"
      >
        <div class="flex items-start gap-2">
          <AlertTriangle class="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
          <div>
            <p class="text-sm font-medium text-warn">Periksa sebelum menerapkan</p>
            <ul class="mt-1.5 space-y-1 text-xs leading-5 text-warn">
              <li v-for="warning in plan.warnings" :key="warning.message">
                {{ warning.message }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="mt-4 flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-ink">Pratinjau urutan</h3>
        <span
          v-if="plan.hasChanges"
          class="inline-flex items-center gap-1 text-xs text-muted"
        >
          <ArrowDownUp class="size-3.5" aria-hidden="true" />
          Urutan akan berubah
        </span>
        <span
          v-else
          class="inline-flex items-center gap-1 text-xs text-brand"
        >
          <CheckCircle2 class="size-3.5" aria-hidden="true" />
          Urutan sudah sesuai
        </span>
      </div>

      <div class="mt-2 max-h-80 overflow-y-auto rounded-md border border-line">
        <ol class="divide-y divide-line">
          <li
            v-for="(track, index) in plan.sorted"
            :key="track.id"
            class="flex items-center gap-3 bg-surface px-3 py-2.5"
          >
            <span class="w-6 shrink-0 text-right font-mono text-xs text-muted">
              {{ index + 1 }}
            </span>
            <div class="flex min-w-0 flex-1 items-center gap-2">
              <PartBadge :part="track.part" compact />
              <span class="truncate text-sm text-ink">{{ track.displayName }}</span>
            </div>
            <span class="shrink-0 font-mono text-xs text-muted">
              {{ track.number !== null ? `No. ${track.number}` : 'tanpa nomor' }}
            </span>
          </li>
        </ol>
      </div>
    </template>

    <template #footer>
      <AppButton variant="secondary" @click="emit('close')">Batal</AppButton>
      <AppButton
        variant="primary"
        :loading="applying"
        :disabled="tracks.length === 0 || !plan.hasChanges"
        @click="apply"
      >
        <ArrowDownUp v-if="!applying" class="size-4" aria-hidden="true" />
        Terapkan urutan
      </AppButton>
    </template>
  </AppModal>
</template>
