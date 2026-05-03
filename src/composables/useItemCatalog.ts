import { ref, watch, type Ref } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { fetchItem, fetchItemsBySlot, type Item } from '@/data/dofusdb';
import type { SlotType } from '@/types/slots';

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

export function useItemSearch(slot: Ref<SlotType | null>, search: Ref<string>) {
  const results = ref<Item[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const run = useDebounceFn(async () => {
    if (slot.value === null) return;
    loading.value = true;
    error.value = null;
    try {
      const items = await fetchItemsBySlot(slot.value, { search: search.value, limit: 50 });
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

  watch([slot, search], run, { immediate: true });

  return { results, loading, error };
}

export function isOverLeveled(itemLevel: number, cardLevel: number | null): boolean {
  if (cardLevel === null) return false;
  return itemLevel > cardLevel;
}
