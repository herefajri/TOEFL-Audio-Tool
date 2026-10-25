<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { X } from 'lucide-vue-next';
import IconButton from './IconButton.vue';
import { cn } from '@/lib/cn';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    description?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
    closeOnBackdrop?: boolean;
  }>(),
  {
    size: 'md',
    closeOnBackdrop: true,
  },
);

const emit = defineEmits<{ close: [] }>();
const dialogRef = ref<HTMLDialogElement | null>(null);
const titleId = useId();
const descriptionId = useId();
let previousOverflow = '';

const sizeClass = computed(
  () =>
    ({
      sm: 'max-w-md',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
      xl: 'max-w-3xl',
      '2xl': 'max-w-4xl',
      '3xl': 'max-w-5xl',
    })[props.size],
);

function openDialog(): void {
  const dialog = dialogRef.value;
  if (!dialog || dialog.open) return;

  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  dialog.showModal();

  requestAnimationFrame(() => {
    const target = dialog.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
    target?.focus();
  });
}

function closeDialog(): void {
  const dialog = dialogRef.value;
  if (dialog?.open) dialog.close();
  document.body.style.overflow = previousOverflow;
}

function requestClose(): void {
  emit('close');
}

function onDialogClick(event: MouseEvent): void {
  if (!props.closeOnBackdrop) return;
  if (event.target === dialogRef.value) requestClose();
}

function onNativeClose(): void {
  document.body.style.overflow = previousOverflow;
}

watch(
  () => props.open,
  (open) => {
    if (open) openDialog();
    else closeDialog();
  },
);

onMounted(() => {
  if (props.open) openDialog();
});

onBeforeUnmount(() => {
  if (dialogRef.value?.open) dialogRef.value.close();
  document.body.style.overflow = previousOverflow;
});
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogRef"
      class="fixed inset-0 z-50"
      :aria-labelledby="title ? titleId : undefined"
      :aria-describedby="description ? descriptionId : undefined"
      :aria-label="title ? undefined : 'Dialog'"
      @cancel.prevent="requestClose"
      @click="onDialogClick"
      @close="onNativeClose"
    >
      <div
        :class="
          cn(
            'flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl animate-fade-up',
            sizeClass,
          )
        "
      >
        <header class="flex items-start gap-4 border-b border-line px-5 py-4">
          <div class="min-w-0 flex-1">
            <h2 v-if="title" :id="titleId" class="text-base font-semibold text-ink">
              {{ title }}
            </h2>
            <p v-if="description" :id="descriptionId" class="mt-1 text-sm leading-6 text-muted">
              {{ description }}
            </p>
            <slot name="header" />
          </div>
          <IconButton label="Tutup" @click="requestClose">
            <X class="size-4" />
          </IconButton>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <slot />
        </div>

        <footer
          v-if="$slots.footer"
          class="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4"
        >
          <slot name="footer" />
        </footer>
      </div>
    </dialog>
  </Teleport>
</template>
