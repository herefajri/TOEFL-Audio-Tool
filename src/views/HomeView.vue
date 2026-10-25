<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { toast } from 'vue-sonner';
import {
  AudioLines,
  FolderPlus,
  HardDrive,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-vue-next';
import type { ProjectSummary } from '@/db/types';
import { loadProjectSummaries } from '@/db/queries';
import { deleteProject } from '@/db/projects';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { useStorageEstimate } from '@/composables/useStorageEstimate';
import { useDocumentTitle } from '@/composables/useDocumentTitle';
import { usePlayerStore } from '@/stores/player';
import { formatBytes, formatDuration } from '@/lib/format';
import AppButton from '@/components/ui/AppButton.vue';
import BrandMark from '@/components/ui/BrandMark.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import LocalFirstBadge from '@/components/ui/LocalFirstBadge.vue';
import ProjectFormDialog from '@/components/home/ProjectFormDialog.vue';
import ProjectRow from '@/components/home/ProjectRow.vue';

useDocumentTitle('Sesi audio');

const player = usePlayerStore();
const projects = useLiveQuery<ProjectSummary[] | null>(
  () => loadProjectSummaries(),
  null,
);
const { usage, quota, loading: storageLoading, refresh } = useStorageEstimate();

const showForm = ref(false);
const editingProject = ref<ProjectSummary | null>(null);
const deletingProject = ref<ProjectSummary | null>(null);
const deleting = ref(false);

const projectList = computed(() => projects.value ?? []);
const totalAudio = computed(() =>
  projectList.value.reduce((sum, project) => sum + project.trackCount, 0),
);
const totalDuration = computed(() =>
  projectList.value.reduce((sum, project) => sum + project.totalDuration, 0),
);
const storagePercent = computed(() => {
  if (!usage.value || !quota.value) return 0;
  return Math.min(100, Math.max(0.5, (usage.value / quota.value) * 100));
});
const deleteDescription = computed(() =>
  deletingProject.value
    ? `"${deletingProject.value.name}" beserta ${deletingProject.value.trackCount} audio di dalamnya akan dihapus permanen.`
    : '',
);

function openCreate(): void {
  editingProject.value = null;
  showForm.value = true;
}

function openEdit(project: ProjectSummary): void {
  editingProject.value = project;
  showForm.value = true;
}

function askDelete(project: ProjectSummary): void {
  deletingProject.value = project;
}

async function confirmDelete(): Promise<void> {
  const project = deletingProject.value;
  if (!project) return;

  deleting.value = true;
  try {
    player.clearProjectQueue(project.id);
    await deleteProject(project.id);
    toast.success(`Sesi "${project.name}" dihapus`);
    deletingProject.value = null;
    await refresh();
  } catch (errorValue) {
    toast.error(errorValue instanceof Error ? errorValue.message : 'Gagal menghapus sesi.');
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  player.clearQueue();
});
</script>

<template>
  <div class="min-h-screen">
    <header class="border-b border-line bg-surface/90 backdrop-blur">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
        <RouterLink to="/" class="rounded-md" aria-label="Kembali ke halaman sesi">
          <BrandMark />
        </RouterLink>
        <LocalFirstBadge class="ml-1 hidden sm:inline-flex" />

        <div class="ml-auto flex items-center gap-2">
          <div
            class="hidden items-center gap-2 rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-xs text-muted md:flex"
            :title="
              quota
                ? `${formatBytes(usage)} terpakai dari sekitar ${formatBytes(quota)}`
                : 'Penyimpanan browser'
            "
          >
            <HardDrive class="size-3.5" aria-hidden="true" />
            <span v-if="storageLoading">Menghitung…</span>
            <span v-else-if="usage !== null">{{ formatBytes(usage) }} terpakai</span>
            <span v-else>Penyimpanan browser</span>
          </div>
          <AppButton variant="primary" size="sm" @click="openCreate">
            <Plus class="size-4" aria-hidden="true" />
            Sesi baru
          </AppButton>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">
      <section class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            Workspace audio
          </p>
          <h1 class="mt-2 text-3xl font-semibold tracking-tight text-ink">Sesi listening</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Susun audio listening TOEFL, potong bagian yang tidak perlu, lalu putar berurutan
            langsung dari browser.
          </p>
        </div>
        <div class="flex items-center gap-4 text-right">
          <div>
            <p class="font-mono text-lg font-semibold text-ink">{{ totalAudio }}</p>
            <p class="text-xs text-muted">audio</p>
          </div>
          <div class="h-8 w-px bg-line" aria-hidden="true"></div>
          <div>
            <p class="font-mono text-lg font-semibold text-ink">
              {{ formatDuration(totalDuration) }}
            </p>
            <p class="text-xs text-muted">total durasi</p>
          </div>
        </div>
      </section>

      <div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="session-list-title" class="min-w-0">
          <div class="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 id="session-list-title" class="text-sm font-semibold text-ink">Daftar sesi</h2>
              <p class="mt-0.5 text-xs text-muted">
                {{ projectList.length }} sesi tersimpan di perangkat ini
              </p>
            </div>
            <button
              v-if="projectList.length > 0"
              type="button"
              class="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-hover"
              @click="openCreate"
            >
              <Plus class="size-3.5" aria-hidden="true" />
              Tambah
            </button>
          </div>

          <div v-if="projects === null" class="overflow-hidden rounded-lg border border-line bg-surface">
            <div
              v-for="index in 3"
              :key="index"
              class="flex items-center gap-4 border-b border-line px-4 py-4 last:border-b-0"
            >
              <div class="size-10 animate-pulse rounded-md bg-canvas"></div>
              <div class="flex-1 space-y-2">
                <div class="h-3 w-1/3 animate-pulse rounded bg-canvas"></div>
                <div class="h-2.5 w-1/2 animate-pulse rounded bg-canvas"></div>
              </div>
            </div>
          </div>

          <EmptyState
            v-else-if="projectList.length === 0"
            title="Belum ada sesi"
            description="Buat sesi pertama, lalu tambahkan file MP3, WAV, atau MPEG audio. Anda bisa mengimpor banyak file sekaligus."
          >
            <template #icon>
              <FolderPlus class="size-6" aria-hidden="true" />
            </template>
            <template #action>
              <AppButton variant="primary" @click="openCreate">
                <Plus class="size-4" aria-hidden="true" />
                Buat sesi pertama
              </AppButton>
            </template>
          </EmptyState>

          <div v-else class="overflow-hidden rounded-lg border border-line bg-surface">
            <ProjectRow
              v-for="project in projectList"
              :key="project.id"
              :project="project"
              @rename="openEdit(project)"
              @delete="askDelete(project)"
            />
          </div>

          <p class="mt-3 text-xs leading-5 text-muted">
            Data tersimpan di IndexedDB browser ini. Jangan gunakan mode incognito untuk sesi
            yang penting.
          </p>
        </section>

        <aside class="space-y-4">
          <section class="rounded-lg border border-line bg-surface p-4">
            <div class="flex items-center gap-2">
              <SlidersHorizontal class="size-4 text-brand" aria-hidden="true" />
              <h2 class="text-sm font-semibold text-ink">Alur kerja</h2>
            </div>
            <ol class="mt-4 space-y-4">
              <li class="flex gap-3">
                <span
                  class="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-xs font-semibold text-brand-ink"
                  >1</span
                >
                <div>
                  <p class="text-sm font-medium text-ink">Import audio</p>
                  <p class="mt-0.5 text-xs leading-5 text-muted">
                    Tarik file MP3/WAV/MPEG ke sesi, bisa banyak sekaligus.
                  </p>
                </div>
              </li>
              <li class="flex gap-3">
                <span
                  class="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-xs font-semibold text-brand-ink"
                  >2</span
                >
                <div>
                  <p class="text-sm font-medium text-ink">Rapikan & potong</p>
                  <p class="mt-0.5 text-xs leading-5 text-muted">
                    Rename, lalu potong bagian awal atau akhir yang tidak perlu.
                  </p>
                </div>
              </li>
              <li class="flex gap-3">
                <span
                  class="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-xs font-semibold text-brand-ink"
                  >3</span
                >
                <div>
                  <p class="text-sm font-medium text-ink">Susun urutan</p>
                  <p class="mt-0.5 text-xs leading-5 text-muted">
                    Drag manual, atau urutkan otomatis dari Part dan nomor.
                  </p>
                </div>
              </li>
              <li class="flex gap-3">
                <span
                  class="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-xs font-semibold text-brand-ink"
                  >4</span
                >
                <div>
                  <p class="text-sm font-medium text-ink">Putar</p>
                  <p class="mt-0.5 text-xs leading-5 text-muted">
                    Play all atau masuk Mode Ujian untuk tampilan fokus.
                  </p>
                </div>
              </li>
            </ol>
            <div class="mt-4 flex items-center gap-2 border-t border-line pt-3 text-xs text-muted">
              <AudioLines class="size-3.5" aria-hidden="true" />
              MP3 / WAV / MPEG · maks. 300 MB per file
            </div>
          </section>

          <section class="rounded-lg border border-line bg-surface p-4">
            <div class="flex items-center gap-2">
              <ShieldCheck class="size-4 text-brand" aria-hidden="true" />
              <h2 class="text-sm font-semibold text-ink">Data tetap lokal</h2>
            </div>
            <p class="mt-2 text-xs leading-5 text-muted">
              File audio tidak diunggah ke server. Semua proses potong dan pemutaran terjadi di
              perangkat ini.
            </p>
            <div v-if="usage !== null" class="mt-4">
              <div class="flex items-center justify-between text-xs">
                <span class="text-muted">Penyimpanan</span>
                <span class="font-mono text-ink-soft">{{ formatBytes(usage) }}</span>
              </div>
              <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas">
                <div
                  class="h-full rounded-full bg-brand transition-[width] duration-300"
                  :style="{ width: `${storagePercent}%` }"
                ></div>
              </div>
              <p v-if="quota" class="mt-2 text-[11px] text-muted">
                Kuota browser sekitar {{ formatBytes(quota) }}.
              </p>
            </div>
            <div v-else class="mt-4 flex items-center gap-2 text-xs text-muted">
              <HardDrive class="size-3.5" aria-hidden="true" />
              <span>{{ storageLoading ? 'Menghitung penyimpanan…' : 'Info penyimpanan tidak tersedia' }}</span>
            </div>
          </section>
        </aside>
      </div>
    </main>

    <ProjectFormDialog
      :open="showForm"
      :project="editingProject"
      @close="showForm = false"
    />

    <ConfirmDialog
      :open="Boolean(deletingProject)"
      title="Hapus sesi?"
      :description="deleteDescription"
      confirm-label="Hapus sesi"
      :loading="deleting"
      @confirm="confirmDelete"
      @close="deletingProject = null"
    />
  </div>
</template>
