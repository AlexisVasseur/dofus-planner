import { ref, watch, type Ref } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { fetchDofusOrTrophees, fetchItem, fetchItemsBySlot, type Item } from '@/data/dofusdb';
import type { SlotType } from '@/types/slots';

export type SearchTarget = SlotType | 'dofus' | null;

const ITEM_CACHE_KEY = 'dofus-planner.cache.items.v1';

interface ItemCacheEntry { item: Item; fetchedAt: number; }
type ItemCache = Record<string, ItemCacheEntry>;

function loadCache(): ItemCache {
  try {
    const raw = localStorage.getItem(ITEM_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ItemCache;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveCache(cache: ItemCache): void {
  localStorage.setItem(ITEM_CACHE_KEY, JSON.stringify(cache));
}

const cache: Ref<ItemCache> = ref(loadCache());

export function getCachedItem(id: number): Item | null {
  return cache.value[String(id)]?.item ?? null;
}

export async function ensureItem(id: number): Promise<Item> {
  const hit = getCachedItem(id);
  if (hit) return hit;
  const item = await fetchItem(id);
  cache.value[String(id)] = { item, fetchedAt: Date.now() };
  saveCache(cache.value);
  return item;
}

/** Bulk-populate the cache with imported items (used by build import). */
export function populateCache(items: Item[]): void {
  const now = Date.now();
  for (const item of items) {
    cache.value[String(item.id)] = { item, fetchedAt: now };
  }
  saveCache(cache.value);
}

/** Fetch and cache any items referenced by ids that aren't already in the cache. */
export async function ensureItems(ids: number[]): Promise<void> {
  const missing = ids.filter((id) => getCachedItem(id) === null);
  if (missing.length === 0) return;
  const fetched = await Promise.allSettled(missing.map((id) => fetchItem(id)));
  const now = Date.now();
  let touched = false;
  for (const result of fetched) {
    if (result.status === 'fulfilled') {
      cache.value[String(result.value.id)] = { item: result.value, fetchedAt: now };
      touched = true;
    }
  }
  if (touched) saveCache(cache.value);
}

export function useItemSearch(target: Ref<SearchTarget>, search: Ref<string>) {
  const results = ref<Item[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const run = useDebounceFn(async () => {
    if (target.value === null) return;
    loading.value = true;
    error.value = null;
    try {
      const items = target.value === 'dofus'
        ? await fetchDofusOrTrophees({ search: search.value, limit: 50 })
        : await fetchItemsBySlot(target.value, { search: search.value, limit: 50 });
      for (const item of items) {
        cache.value[String(item.id)] = { item, fetchedAt: Date.now() };
      }
      saveCache(cache.value);
      results.value = items;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      results.value = [];
    } finally {
      loading.value = false;
    }
  }, 200);

  watch([target, search], run, { immediate: true });

  return { results, loading, error };
}

export function isOverLeveled(itemLevel: number, cardLevel: number | null): boolean {
  if (cardLevel === null) return false;
  return itemLevel > cardLevel;
}
