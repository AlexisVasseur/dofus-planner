import { ref, watch, type Ref } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { fetchDofusOrTrophees, fetchItem, fetchItemsBySlot, fetchEffectTemplates, type Item, type EffectTemplate } from '@/data/dofusdb';
import { renderEffectMax } from '@/utils/stats';
import type { SlotType } from '@/types/slots';

export type SearchTarget = SlotType | 'dofus' | null;

// v2 bump (2026-05): adds setId / set fields to cached items so panoplie bonuses can be
// computed. v1 entries lack these fields → invalidated to force a re-fetch from DofusDB.
const ITEM_CACHE_KEY = 'dofus-planner.cache.items.v2';
const EFFECT_CACHE_KEY = 'dofus-planner.cache.effects.v1';

interface ItemCacheEntry { item: Item; fetchedAt: number; }
type ItemCache = Record<string, ItemCacheEntry>;
type EffectCache = Record<string, EffectTemplate>;

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

function loadEffectCache(): EffectCache {
  try {
    const raw = localStorage.getItem(EFFECT_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as EffectCache;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveEffectCache(c: EffectCache): void {
  localStorage.setItem(EFFECT_CACHE_KEY, JSON.stringify(c));
}

const cache: Ref<ItemCache> = ref(loadCache());
const effectCache: Ref<EffectCache> = ref(loadEffectCache());

// One-time backfill: items cached under the old format have no `effects` array. Re-fetch
// them in the background so stat tooltips can populate without forcing the user to clear
// their cache. Runs once per app load.
{
  const stale = Object.values(cache.value)
    .map((e) => e.item)
    .filter((it) => !Array.isArray(it.effects))
    .map((it) => it.id);
  if (stale.length > 0) {
    void (async () => {
      const fetched = await Promise.allSettled(stale.map((id) => fetchItem(id)));
      const now = Date.now();
      let touched = false;
      const items: Item[] = [];
      for (const r of fetched) {
        if (r.status === 'fulfilled') {
          cache.value[String(r.value.id)] = { item: r.value, fetchedAt: now };
          items.push(r.value);
          touched = true;
        }
      }
      if (touched) saveCache(cache.value);
      if (items.length > 0) await ensureEffectTemplates(collectEffectIds(items));
    })();
  }
}

export function getCachedEffect(id: number): EffectTemplate | null {
  return effectCache.value[String(id)] ?? null;
}

/** Render an item's effects into "max-only" stat lines using the cached templates.
 * Returns [] for items with no effects yet, or whose effect templates haven't been
 * fetched yet (a re-render will pick them up once they arrive). */
export function renderItemStatsMax(item: Item | null): string[] {
  if (!item) return [];
  const out: string[] = [];
  for (const eff of item.effects ?? []) {
    const tpl = effectCache.value[String(eff.effectId)] ?? null;
    const line = renderEffectMax(eff, tpl);
    if (line.length > 0) out.push(line);
  }
  return out;
}

function collectEffectIds(items: Item[]): number[] {
  const out = new Set<number>();
  for (const it of items) {
    for (const e of it.effects ?? []) out.add(e.effectId);
  }
  return Array.from(out);
}

/** Fetch and cache effect templates for the given ids that aren't already cached. */
export async function ensureEffectTemplates(ids: number[]): Promise<void> {
  const missing = Array.from(new Set(ids.filter((id) => !effectCache.value[String(id)])));
  if (missing.length === 0) return;
  try {
    const templates = await fetchEffectTemplates(missing);
    for (const t of templates) {
      effectCache.value[String(t.id)] = t;
    }
    saveEffectCache(effectCache.value);
  } catch {
    // Silent: stats just won't render until next attempt; never blocks the UI.
  }
}

export function getCachedItem(id: number): Item | null {
  return cache.value[String(id)]?.item ?? null;
}

export async function ensureItem(id: number): Promise<Item> {
  const hit = getCachedItem(id);
  if (hit) {
    // Backfill effect templates for legacy cache entries that didn't fetch them.
    void ensureEffectTemplates(collectEffectIds([hit]));
    return hit;
  }
  const item = await fetchItem(id);
  cache.value[String(id)] = { item, fetchedAt: Date.now() };
  saveCache(cache.value);
  await ensureEffectTemplates(collectEffectIds([item]));
  return item;
}

/** Bulk-populate the cache with imported items (used by build import). */
export function populateCache(items: Item[]): void {
  const now = Date.now();
  for (const item of items) {
    cache.value[String(item.id)] = { item, fetchedAt: now };
  }
  saveCache(cache.value);
  void ensureEffectTemplates(collectEffectIds(items));
}

/** Fetch and cache any items referenced by ids that aren't already in the cache. */
export async function ensureItems(ids: number[]): Promise<void> {
  const missing = ids.filter((id) => getCachedItem(id) === null);
  if (missing.length === 0) {
    // Already-cached items may still be missing their effect templates.
    const cached = ids.map((id) => getCachedItem(id)).filter((it): it is Item => it !== null);
    void ensureEffectTemplates(collectEffectIds(cached));
    return;
  }
  const fetched = await Promise.allSettled(missing.map((id) => fetchItem(id)));
  const now = Date.now();
  let touched = false;
  const fetchedItems: Item[] = [];
  for (const result of fetched) {
    if (result.status === 'fulfilled') {
      cache.value[String(result.value.id)] = { item: result.value, fetchedAt: now };
      fetchedItems.push(result.value);
      touched = true;
    }
  }
  if (touched) saveCache(cache.value);
  await ensureEffectTemplates(collectEffectIds(fetchedItems));
}

const PAGE_SIZE = 50;

export function useItemSearch(
  target: Ref<SearchTarget>,
  search: Ref<string>,
  maxLevel: Ref<number | null> = ref(null),
) {
  const results = ref<Item[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref<string | null>(null);
  const hasMore = ref(false);

  async function fetchPage(skip: number): Promise<Item[]> {
    if (target.value === null) return [];
    const opts = {
      search: search.value,
      limit: PAGE_SIZE,
      skip,
      maxLevel: maxLevel.value ?? undefined,
    };
    return target.value === 'dofus'
      ? await fetchDofusOrTrophees(opts)
      : await fetchItemsBySlot(target.value, opts);
  }

  function cacheAndIndex(items: Item[]): void {
    const now = Date.now();
    for (const item of items) {
      cache.value[String(item.id)] = { item, fetchedAt: now };
    }
    saveCache(cache.value);
    void ensureEffectTemplates(collectEffectIds(items));
  }

  const run = useDebounceFn(async () => {
    if (target.value === null) return;
    loading.value = true;
    error.value = null;
    try {
      const items = await fetchPage(0);
      cacheAndIndex(items);
      results.value = items;
      hasMore.value = items.length === PAGE_SIZE;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      results.value = [];
      hasMore.value = false;
    } finally {
      loading.value = false;
    }
  }, 200);

  async function loadMore(): Promise<void> {
    if (loading.value || loadingMore.value || !hasMore.value || target.value === null) return;
    loadingMore.value = true;
    try {
      const items = await fetchPage(results.value.length);
      cacheAndIndex(items);
      // Dedup by id in case the API returns overlap between pages.
      const seen = new Set(results.value.map((i) => i.id));
      const fresh = items.filter((i) => !seen.has(i.id));
      results.value = [...results.value, ...fresh];
      hasMore.value = items.length === PAGE_SIZE;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      hasMore.value = false;
    } finally {
      loadingMore.value = false;
    }
  }

  watch([target, search, maxLevel], run, { immediate: true });

  return { results, loading, loadingMore, error, hasMore, loadMore };
}

export function isOverLeveled(itemLevel: number, cardLevel: number | null): boolean {
  if (cardLevel === null) return false;
  return itemLevel > cardLevel;
}
