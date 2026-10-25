<script setup lang="ts">
import AppButton from './AppButton.vue';
import AppModal from './AppModal.vue';

withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    loading?: boolean;
  }>(),
  {
    confirmLabel: 'Hapus',
    cancelLabel: 'Batal',
    danger: true,
    loading: false,
  },
);

const emit = defineEmits<{ confirm: []; close: [] }>();
</script>

<template>
  <AppModal
    :open="open"
    :title="title"
    :description="description"
    size="sm"
    @close="emit('close')"
  >
    <slot />
    <template #footer>
      <AppButton variant="secondary" @click="emit('close')">{{ cancelLabel }}</AppButton>
      <AppButton
        :variant="danger ? 'danger' : 'primary'"
        :loading="loading"
        @click="emit('confirm')"
      >
        {{ confirmLabel }}
      </AppButton>
    </template>
  </AppModal>
</template>
