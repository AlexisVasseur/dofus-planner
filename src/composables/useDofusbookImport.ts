import { fetchItemsByNames, normalizeSearch, type Item } from '@/data/dofusdb';
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

function isUsable(typeId: number): boolean {
  return typeId === RING_TYPE_ID
    || typeId === DOFUS_TYPE_ID
    || typeId === TROPHEE_TYPE_ID
    || TYPE_ID_TO_SLOT[typeId] !== undefined;
}

/** Among the pooled items sharing a name, pick an equippable one (a name can map to
 *  several items, e.g. a mount under two legacy typeIds), else the first, else null. */
function pickMatch(candidates: Item[]): Item | null {
  if (candidates.length === 0) return null;
  return candidates.find((it) => isUsable(it.typeId)) ?? candidates[0];
}

export async function resolveDofusbookItems(itemNames: string[]): Promise<ResolvedBuild> {
  const slots = {} as Record<SlotType, ItemRef | null>;
  for (const s of SLOT_ORDER) slots[s] = null;
  const dofus: (ItemRef | null)[] = Array.from({ length: DOFUS_COUNT }, () => null);
  const unresolved: string[] = [];

  // One batched request: every item whose slug exactly matches one of the names.
  // Group the pool by normalized name so each name picks from its own exact matches.
  let pool: Item[] = [];
  try {
    pool = await fetchItemsByNames(itemNames);
  } catch {
    pool = [];
  }
  const byName = new Map<string, Item[]>();
  for (const it of pool) {
    const key = normalizeSearch(it.name);
    const bucket = byName.get(key);
    if (bucket) bucket.push(it);
    else byName.set(key, [it]);
  }
  const matches = itemNames.map((name) => pickMatch(byName.get(normalizeSearch(name)) ?? []));

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
