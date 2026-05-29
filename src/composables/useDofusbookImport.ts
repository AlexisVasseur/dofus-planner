import { searchItemsByName, normalizeSearch, type Item } from '@/data/dofusdb';
import { ensureItems } from '@/composables/useItemCatalog';
import { SLOT_ORDER, DOFUS_COUNT, type SlotType } from '@/types/slots';
import type { ItemRef } from '@/types/build';
import { TYPE_ID_TO_SLOT, RING_TYPE_ID, DOFUS_TYPE_ID, TROPHEE_TYPE_ID } from '@/utils/typeIdSlots';

export interface ResolvedBuild {
  slots: Record<SlotType, ItemRef | null>;
  dofus: (ItemRef | null)[];
  unresolved: string[];
  resolvedCount: number;
}

// Generous page size so the exact match surfaces even when a name collides with
// higher-level gear that ranks first by level (e.g. "Voyageur" the prysmaradite
// vs "Ceinture des Voyageurs" lvl 197).
const SEARCH_LIMIT = 24;

/** Pick the result whose name matches EXACTLY (after normalization). We do NOT fall
 *  back to a fuzzy "first equippable" result: that would mis-resolve names like
 *  "Voyageur" to "Ceinture des Voyageurs". No exact match → the name is left
 *  unresolved and reported, never wrongly equipped. */
function pickMatch(name: string, results: Item[]): Item | null {
  if (results.length === 0) return null;
  const norm = normalizeSearch(name);
  return results.find((it) => normalizeSearch(it.name) === norm) ?? null;
}

export async function resolveDofusbookItems(itemNames: string[]): Promise<ResolvedBuild> {
  const slots = {} as Record<SlotType, ItemRef | null>;
  for (const s of SLOT_ORDER) slots[s] = null;
  const dofus: (ItemRef | null)[] = Array.from({ length: DOFUS_COUNT }, () => null);
  const unresolved: string[] = [];

  // Resolve all names in parallel (order preserved); a per-name failure → null.
  const matches = await Promise.all(
    itemNames.map(async (name) => {
      try {
        return pickMatch(name, await searchItemsByName(name, SEARCH_LIMIT));
      } catch {
        return null;
      }
    }),
  );

  // Assign in itemNames order so ring / dofus placement is deterministic.
  const resolvedIds: number[] = [];
  itemNames.forEach((name, i) => {
    const match = matches[i];
    if (!match) { unresolved.push(name); return; }
    if (match.typeId === RING_TYPE_ID) {
      if (slots.anneau1 === null) slots.anneau1 = { itemId: match.id };
      else if (slots.anneau2 === null) slots.anneau2 = { itemId: match.id };
      else { unresolved.push(name); return; }
    } else if (match.typeId === DOFUS_TYPE_ID || match.typeId === TROPHEE_TYPE_ID) {
      const free = dofus.findIndex((d) => d === null);
      if (free === -1) { unresolved.push(name); return; }
      dofus[free] = { itemId: match.id };
    } else {
      const slot = TYPE_ID_TO_SLOT[match.typeId];
      if (!slot) { unresolved.push(name); return; }
      if (slots[slot] !== null) { unresolved.push(name); return; } // keep first
      slots[slot] = { itemId: match.id };
    }
    resolvedIds.push(match.id);
  });

  if (resolvedIds.length > 0) await ensureItems(resolvedIds);
  return { slots, dofus, unresolved, resolvedCount: resolvedIds.length };
}
