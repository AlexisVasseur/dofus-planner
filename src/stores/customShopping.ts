import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export interface CustomEntry {
  name: string;
  /** Resolved DofusDB item id, or null when the name wasn't found / isn't routable. */
  itemId: number | null;
}

const STORAGE_KEY = 'dofus-planner.shopping.custom.v1';

function loadEntries(): CustomEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is CustomEntry =>
      typeof e === 'object' && e !== null
      && typeof (e as CustomEntry).name === 'string'
      && ((e as CustomEntry).itemId === null || typeof (e as CustomEntry).itemId === 'number'));
  } catch {
    return [];
  }
}

/** The single, persistent custom shopping list — resolved once at import time and
 *  saved so it survives reloads. */
export const useCustomShoppingStore = defineStore('customShopping', () => {
  const entries = ref<CustomEntry[]>(loadEntries());
  watch(entries, (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    } catch {
      // best-effort: ignore unavailable / quota-exceeded localStorage
    }
  }, { deep: true });

  function setEntries(next: CustomEntry[]): void { entries.value = next; }
  function clear(): void { entries.value = []; }

  return { entries, setEntries, clear };
});
