import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const STORAGE_KEY = 'dofus-planner.shopping.checked.v1';

/** Check key for a resolved item (checked everywhere that itemId appears). */
export function itemCheckKey(id: number): string { return `id:${id}`; }
/** Check key for an "Inconnu" entry (no item id — keyed by its displayed name). */
export function nameCheckKey(name: string): string { return `nom:${name}`; }

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((k): k is string => typeof k === 'string'));
  } catch {
    return new Set();
  }
}

/** "Acquired" state for shopping rows — a persistent set of check keys. Clicking a
 *  row toggles its key; the row gets a green outline while checked. Survives reloads. */
export const useShoppingCheckedStore = defineStore('shoppingChecked', () => {
  const checked = ref<Set<string>>(load());

  watch(checked, (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...v]));
    } catch {
      // best-effort: ignore unavailable / quota-exceeded localStorage
    }
  });

  function toggle(key: string): void {
    const next = new Set(checked.value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    checked.value = next; // replace → triggers reactivity + the persistence watch
  }

  function isChecked(key: string): boolean {
    return checked.value.has(key);
  }

  function clear(): void { checked.value = new Set(); }

  return { checked, toggle, isChecked, clear };
});
