import { liveQuery } from 'dexie';
import { onScopeDispose, ref, watch, type Ref, type WatchSource } from 'vue';

interface SubscriptionLike {
  unsubscribe: () => void;
}

/**
 * Small Vue wrapper around Dexie's liveQuery.
 * Pass a source when the querier depends on a reactive value
 * (for example a route param) so the subscription can restart.
 */
export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  initialValue: T,
  source?: WatchSource<unknown>,
): Ref<T> {
  const result = ref(initialValue) as Ref<T>;
  let subscription: SubscriptionLike | undefined;

  const start = (): void => {
    subscription?.unsubscribe();
    subscription = liveQuery(querier).subscribe({
      next: (value) => {
        result.value = value;
      },
      error: (error) => {
        console.error('[liveQuery]', error);
      },
    });
  };

  if (source) {
    const stop = watch(source, start, { immediate: true });
    onScopeDispose(() => {
      stop();
      subscription?.unsubscribe();
    });
  } else {
    start();
    onScopeDispose(() => subscription?.unsubscribe());
  }

  return result;
}
