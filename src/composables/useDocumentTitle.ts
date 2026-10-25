import { toValue, watchEffect, type MaybeRefOrGetter } from 'vue';

export function useDocumentTitle(title: MaybeRefOrGetter<string>): void {
  watchEffect(() => {
    const value = toValue(title).trim();
    document.title = value ? `${value} · TOEFL Audio Tools` : 'TOEFL Audio Tools';
  });
}
