import { ref, watch, type Ref } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { fetchItemSets, type ItemSetSummary } from '@/data/dofusdb';

const PAGE_SIZE = 50;

/** Search DofusDB item-sets (panoplies). Same return shape as useItemSearch so the
 *  picker can swap between them. `enabled` gates the network calls — the picker only
 *  flips it on in set mode, so slot/dofus mode never fires a set query. */
export function useItemSetSearch(search: Ref<string>, enabled: Ref<boolean>) {
  const results = ref<ItemSetSummary[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref<string | null>(null);
  const hasMore = ref(false);

  async function fetchPage(skip: number): Promise<ItemSetSummary[]> {
    return fetchItemSets({ search: search.value, limit: PAGE_SIZE, skip });
  }

  const run = useDebounceFn(async () => {
    if (!enabled.value) return;
    loading.value = true;
    error.value = null;
    try {
      const sets = await fetchPage(0);
      results.value = sets;
      hasMore.value = sets.length === PAGE_SIZE;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      results.value = [];
      hasMore.value = false;
    } finally {
      loading.value = false;
    }
  }, 200);

  async function loadMore(): Promise<void> {
    if (!enabled.value || loading.value || loadingMore.value || !hasMore.value) return;
    loadingMore.value = true;
    try {
      const sets = await fetchPage(results.value.length);
      const seen = new Set(results.value.map((s) => s.id));
      const fresh = sets.filter((s) => !seen.has(s.id));
      results.value = [...results.value, ...fresh];
      hasMore.value = sets.length === PAGE_SIZE;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      hasMore.value = false;
    } finally {
      loadingMore.value = false;
    }
  }

  watch([search, enabled], () => {
    if (!enabled.value) {
      results.value = [];
      hasMore.value = false;
      error.value = null;
      return;
    }
    void run();
  }, { immediate: true });

  return { results, loading, loadingMore, error, hasMore, loadMore };
}
