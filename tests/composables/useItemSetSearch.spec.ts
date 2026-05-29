import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';

const fetchItemSets = vi.fn();
vi.mock('@/data/dofusdb', () => ({ fetchItemSets: (...a: unknown[]) => fetchItemSets(...a) }));

import { useItemSetSearch } from '@/composables/useItemSetSearch';

beforeEach(() => {
  vi.useFakeTimers();
  fetchItemSets.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

function makeSets(ids: number[]) {
  return ids.map((id) => ({ id, name: `Set ${id}`, level: id, itemIds: [id * 10] }));
}

describe('useItemSetSearch', () => {
  it('does not fetch while disabled', async () => {
    const search = ref('bouftou');
    const enabled = ref(false);
    useItemSetSearch(search, enabled);
    await vi.advanceTimersByTimeAsync(300);
    expect(fetchItemSets).not.toHaveBeenCalled();
  });

  it('fetches the first page when enabled and populates results', async () => {
    fetchItemSets.mockResolvedValue(makeSets([1, 2]));
    const search = ref('bouftou');
    const enabled = ref(true);
    const { results, loading, hasMore } = useItemSetSearch(search, enabled);
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();
    expect(fetchItemSets).toHaveBeenCalledTimes(1);
    expect(results.value.map((s) => s.id)).toEqual([1, 2]);
    expect(loading.value).toBe(false);
    expect(hasMore.value).toBe(false);
  });

  it('loadMore appends the next page and dedupes by id', async () => {
    const page1 = makeSets(Array.from({ length: 50 }, (_, i) => i + 1)); // full page
    fetchItemSets.mockResolvedValueOnce(page1);
    const search = ref('a');
    const enabled = ref(true);
    const { results, hasMore, loadMore } = useItemSetSearch(search, enabled);
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();
    expect(hasMore.value).toBe(true);

    fetchItemSets.mockResolvedValueOnce(makeSets([50, 51, 52])); // 50 overlaps
    await loadMore();
    await nextTick();
    const ids = results.value.map((s) => s.id);
    expect(ids).toContain(51);
    expect(ids).toContain(52);
    expect(ids.filter((x) => x === 50)).toHaveLength(1);
  });

  it('surfaces an error and clears results on fetch failure', async () => {
    fetchItemSets.mockRejectedValue(new Error('boom'));
    const search = ref('x');
    const enabled = ref(true);
    const { results, error } = useItemSetSearch(search, enabled);
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();
    expect(error.value).toBe('boom');
    expect(results.value).toEqual([]);
  });

  it('re-fetches when the search term changes while enabled', async () => {
    fetchItemSets.mockResolvedValue(makeSets([1]));
    const search = ref('a');
    const enabled = ref(true);
    useItemSetSearch(search, enabled);
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();
    expect(fetchItemSets).toHaveBeenCalledTimes(1);

    search.value = 'ab';
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();
    expect(fetchItemSets).toHaveBeenCalledTimes(2);
    expect(fetchItemSets).toHaveBeenLastCalledWith({ search: 'ab', limit: 50, skip: 0 });
  });

  it('clears results when enabled flips to false', async () => {
    fetchItemSets.mockResolvedValue(makeSets([1, 2]));
    const search = ref('a');
    const enabled = ref(true);
    const { results } = useItemSetSearch(search, enabled);
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();
    expect(results.value).toHaveLength(2);
    enabled.value = false;
    await nextTick();
    expect(results.value).toEqual([]);
  });
});
