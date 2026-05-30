import { fetchItemsByNames, normalizeSearch } from '@/data/dofusdb';
import { ensureItems } from '@/composables/useItemCatalog';
import { routeItemByType } from '@/types/rooms';
import type { CustomEntry } from '@/stores/customShopping';

/** Extract item names from pasted text. Accepts a plain "one name per line" list
 *  AND a CSV "nom;type;niveau" — only the NAME (first ';' field) is kept, since
 *  resolution is name-based. Drops empties, the `nom` header line, and duplicates
 *  (by normalized name, first-seen order preserved). */
export function parseCustomLines(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const name = line.split(';')[0].trim();
    if (name.length === 0) continue;
    if (name.toLowerCase() === 'nom') continue; // CSV header (or a bare "nom")
    const key = normalizeSearch(name);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** Resolve parsed names against DofusDB in ONE batched request. An entry's itemId
 *  is set only when a match exists AND it routes to a shopping NPC (so "valid" means
 *  "will be placed"); otherwise null. Found ids are warmed in the catalog cache. */
export async function resolveCustomNames(names: string[]): Promise<CustomEntry[]> {
  if (names.length === 0) return [];
  const pool = await fetchItemsByNames(names);
  const byName = new Map<string, typeof pool>();
  for (const it of pool) {
    const key = normalizeSearch(it.name);
    const bucket = byName.get(key);
    if (bucket) bucket.push(it);
    else byName.set(key, [it]);
  }
  const entries: CustomEntry[] = names.map((name) => {
    const candidates = byName.get(normalizeSearch(name)) ?? [];
    const routable = candidates.find((it) => routeItemByType(it) !== null) ?? null;
    return { name, itemId: routable ? routable.id : null };
  });
  const foundIds = entries.map((e) => e.itemId).filter((id): id is number => id !== null);
  if (foundIds.length > 0) await ensureItems(foundIds);
  return entries;
}
