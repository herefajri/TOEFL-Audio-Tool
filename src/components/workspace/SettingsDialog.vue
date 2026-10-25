<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { toast } from 'vue-sonner';
import { AlertTriangle, Download, Timer } from 'lucide-vue-next';
import type { Project, Track } from '@/db/types';
import { MAX_GAP_MS } from '@/db/types';
import { deleteProject, updateProject } from '@/db/projects';
import { buildPreset, downloadPreset } from '@/lib/preset';
import { formatDuration, formatGap } from '@/lib/format';
import AppButton from '@/components/ui/AppButton.vue';
import AppModal from '@/components/ui/AppModal.vue';

const props = defineProps<{
  open: boolean;
  project: Project | null;
  tracks: Track[];
  trackCount: number;
  totalDuration: number;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
  deleted: [];
}>();

const name = ref('');
const gapInput = ref('0');
const error = ref('');
const saving = ref(false);
const deleting = ref(false);
const deleteArmed = ref(false);

const currentGapLabel = computed(() => {
  const value = Number(gapInput.value.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return 'Tanpa jeda tambahan';
  return `Jeda ${formatGap(Math.round(value * 1000))}`;
});

watch(
  [() => props.open, () => props.project?.id],
  ([open]) => {
    if (!open || !props.project) return;
    name.value = props.project.name;
    gapInput.value = String(props.project.gapMs / 1000);
    error.value = '';
    saving.value = false;
    deleting.value = false;
    deleteArmed.value = false;
  },
  { immediate: true },
);

function setGapPreset(seconds: number): void {
  gapInput.value = String(seconds);
}

function downloadBackup(): void {
  if (!props.project) return;
  downloadPreset(buildPreset(props.project, props.tracks));
  toast.success('Preset diunduh', {
    description: 'File audio tidak termasuk; salin file audio secara terpisah.',
  });
}

async function save(): Promise<void> {
  if (!props.project) return;

  const trimmed = name.value.trim();
  if (!trimmed) {
    error.value = 'Nama sesi wajib diisi.';
    return;
  }

  let gapSeconds = 0;
  const rawGap = gapInput.value.trim().replace(',', '.');

  if (rawGap !== '') {
    gapSeconds = Number(rawGap);
    if (!Number.isFinite(gapSeconds) || gapSeconds < 0) {
      error.value = 'Jeda harus berupa angka 0 atau lebih.';
      return;
    }
    if (gapSeconds * 1000 > MAX_GAP_MS) {
      error.value = 'Jeda maksimal 30 detik.';
      return;
    }
  }

  saving.value = true;
  error.value = '';

  try {
    await updateProject(props.project.id, {
      name: trimmed,
      gapMs: Math.round(gapSeconds * 1000),
    });
    toast.success('Pengaturan sesi disimpan');
    emit('saved');
    emit('close');
  } catch (errorValue) {
    error.value =
      errorValue instanceof Error ? errorValue.message : 'Gagal menyimpan pengaturan.';
  } finally {
    saving.value = false;
  }
}

async function removeProject(): Promise<void> {
  if (!props.project) return;

  if (!deleteArmed.value) {
    deleteArmed.value = true;
    return;
  }

  deleting.value = true;
  try {
    const projectName = props.project.name;
    await deleteProject(props.project.id);
    toast.success(`Sesi "${projectName}" dihapus`);
    emit('deleted');
    emit('close');
  } catch (errorValue) {
    toast.error(
      errorValue instanceof Error ? errorValue.message : 'Gagal menghapus sesi.',
    );
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <AppModal
    :open="open"
    title="Pengaturan sesi"
    description="Atur nama sesi dan jeda tambahan antar audio. Semua perubahan langsung tersimpan di browser."
    size="md"
    @close="emit('close')"
  >
    <form v-if="project" class="space-y-5" @submit.prevent="save">
      <div class="rounded-md border border-line bg-surface-raised px-3 py-2 text-xs text-muted">
        {{ trackCount }} audio
        <span aria-hidden="true">·</span>
        total {{ formatDuration(totalDuration) }}
        <span aria-hidden="true">·</span>
        {{ formatGap(project.gapMs) }} jeda
      </div>

      <div>
        <label for="settings-name" class="text-sm font-medium text-ink">Nama sesi</label>
        <input
          id="settings-name"
          v-model="name"
          data-autofocus
          type="text"
          maxlength="80"
          autocomplete="off"
          class="mt-2 h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none"
          @input="error = ''"
        />
        <p v-if="error" class="mt-2 text-sm text-danger" role="alert">{{ error }}</p>
      </div>

      <div>
        <div class="flex items-center gap-2">
          <Timer class="size-4 text-brand" aria-hidden="true" />
          <label for="settings-gap" class="text-sm font-medium text-ink">Jeda antar audio</label>
        </div>
        <p class="mt-1 text-xs leading-5 text-muted">
          Jeda ditambahkan setelah audio selesai, sebelum audio berikutnya. Isi 0 jika file
          sudah memiliki jeda sendiri. Maksimal 30 detik.
        </p>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <AppButton
            v-for="preset in [0, 2, 5]"
            :key="preset"
            size="sm"
            :variant="Number(gapInput.replace(',', '.')) === preset ? 'primary' : 'secondary'"
            @click="setGapPreset(preset)"
          >
            {{ preset === 0 ? 'Tanpa jeda' : `${preset} detik` }}
          </AppButton>
          <div class="flex items-center gap-2">
            <input
              id="settings-gap"
              v-model="gapInput"
              type="text"
              inputmode="decimal"
              class="h-8 w-16 rounded-md border border-line-strong bg-surface px-2 text-center font-mono text-xs text-ink focus:border-brand focus:outline-none"
              aria-label="Jeda khusus dalam detik"
              @input="error = ''"
            />
            <span class="text-xs text-muted">detik</span>
          </div>
        </div>
        <p class="mt-2 text-xs text-brand-ink">{{ currentGapLabel }}</p>
      </div>

      <div class="rounded-md border border-line bg-surface-raised p-3">
        <div class="flex items-start gap-2">
          <Download class="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-ink">Backup preset</p>
            <p class="mt-1 text-xs leading-5 text-muted">
              Simpan nama sesi, jeda, dan metadata {{ tracks.length }} audio ke file JSON.
              File audio tidak ikut; salin audio secara terpisah ke perangkat lain.
            </p>
            <AppButton class="mt-2" size="sm" variant="secondary" @click="downloadBackup">
              <Download class="size-4" aria-hidden="true" />
              Unduh preset
            </AppButton>
          </div>
        </div>
      </div>

      <div class="rounded-md border border-danger/20 bg-danger-soft p-3">
        <div class="flex items-start gap-2">
          <AlertTriangle class="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-danger">Hapus sesi</p>
            <p class="mt-1 text-xs leading-5 text-danger/80">
              Semua audio dan pengaturan di sesi ini akan dihapus permanen dari browser.
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              <AppButton
                v-if="!deleteArmed"
                size="sm"
                variant="secondary"
                @click="deleteArmed = true"
              >
                Hapus sesi…
              </AppButton>
              <template v-else>
                <AppButton
                  size="sm"
                  variant="danger"
                  :loading="deleting"
                  @click="removeProject"
                >
                  Ya, hapus permanen
                </AppButton>
                <AppButton size="sm" variant="quiet" @click="deleteArmed = false">
                  Batal
                </AppButton>
              </template>
            </div>
          </div>
        </div>
      </div>
    </form>

    <template #footer>
      <AppButton variant="secondary" @click="emit('close')">Batal</AppButton>
      <AppButton variant="primary" :loading="saving" @click="save">Simpan</AppButton>
    </template>
  </AppModal>
</template>
