<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import type { Project } from '@/db/types';
import { createProject, updateProject } from '@/db/projects';
import AppButton from '@/components/ui/AppButton.vue';
import AppModal from '@/components/ui/AppModal.vue';

const props = defineProps<{
  open: boolean;
  project?: Project | null;
}>();

const emit = defineEmits<{ close: [] }>();
const router = useRouter();

const name = ref('');
const error = ref('');
const submitting = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

const isEdit = computed(() => Boolean(props.project));

watch(
  () => props.open,
  async (open) => {
    if (!open) return;

    name.value = props.project?.name ?? '';
    error.value = '';
    await nextTick();
    inputRef.value?.focus();
    inputRef.value?.select();
  },
);

async function submit(): Promise<void> {
  const trimmed = name.value.trim();
  if (!trimmed) {
    error.value = 'Nama sesi wajib diisi.';
    return;
  }

  submitting.value = true;
  error.value = '';

  try {
    if (props.project) {
      await updateProject(props.project.id, { name: trimmed });
      toast.success('Nama sesi diperbarui');
      emit('close');
      return;
    }

    const project = await createProject(trimmed);
    toast.success('Sesi baru dibuat');
    emit('close');
    await router.push({ name: 'workspace', params: { id: project.id } });
  } catch (errorValue) {
    error.value = errorValue instanceof Error ? errorValue.message : 'Gagal menyimpan sesi.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AppModal
    :open="open"
    :title="isEdit ? 'Ubah nama sesi' : 'Sesi baru'"
    :description="
      isEdit
        ? 'Nama sesi membantu Anda membedakan satu set audio dengan yang lain.'
        : 'Satu sesi biasanya berisi satu set listening TOEFL. Audio bisa ditambahkan setelah sesi dibuat.'
    "
    size="sm"
    @close="emit('close')"
  >
    <form @submit.prevent="submit">
      <label for="project-name" class="text-sm font-medium text-ink">Nama sesi</label>
      <input
        id="project-name"
        ref="inputRef"
        v-model="name"
        data-autofocus
        type="text"
        maxlength="80"
        autocomplete="off"
        placeholder="Contoh: TOEFL ITP Januari 2026"
        class="mt-2 h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none"
        @input="error = ''"
      />
      <p v-if="error" class="mt-2 text-sm text-danger" role="alert">{{ error }}</p>
      <p class="mt-2 text-xs leading-5 text-muted">
        Audio tersimpan di browser ini. Tidak ada file yang dikirim ke server.
      </p>
    </form>

    <template #footer>
      <AppButton variant="secondary" @click="emit('close')">Batal</AppButton>
      <AppButton variant="primary" :loading="submitting" @click="submit">
        {{ isEdit ? 'Simpan' : 'Buat sesi' }}
      </AppButton>
    </template>
  </AppModal>
</template>
