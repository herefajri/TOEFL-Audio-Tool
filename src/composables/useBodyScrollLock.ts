import { onBeforeUnmount, watch, type WatchSource } from 'vue';

export function useBodyScrollLock(active: WatchSource<boolean>): void {
  let previous = '';

  watch(
    active,
    (locked) => {
      if (locked) {
        previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = previous;
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    document.body.style.overflow = previous;
  });
}
