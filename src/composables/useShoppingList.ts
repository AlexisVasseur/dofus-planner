import { computed, type ComputedRef } from 'vue';
import { useBuildStore } from '@/stores/build';
import { ensureItem, getCachedItem } from '@/composables/useItemCatalog';
import {
  ROOM_ORDER, type RoomId,
  type NpcId,
  TYPE_ID_DOFUS, TYPE_ID_TROPHEE,
  MONTURE_TYPE_IDS,
  slotToNpc, levelToRoom,
} from '@/types/rooms';
import { SLOT_ORDER, DOFUS_COUNT } from '@/types/slots';
import type { Item } from '@/data/dofusdb';

export interface ShoppingList {
  rooms: Record<RoomId, Partial<Record<NpcId, Item[]>>>;
  // Required-quantity per itemId: the MAX number of times the item appears in any
  // single card (across slots + dofus[]). Silimelle worn as anneau1+anneau2 on the
  // same card → 2; worn as anneau1 on two different cards → 1 (re-used between
  // checkpoints). View renders an "×N" badge when count > 1.
  counts: Record<number, number>;
  totals: {
    items: number;
    activeRooms: number;
    perRoom: Record<RoomId, number>;
    /** Quantity-aware total: sums counts[itemId] (the ×N badge) instead of distinct
     *  list entries. "Number of copies to actually buy." */
    units: number;
    /** Per-room quantity total (same quantity semantics as `units`). */
    unitsPerRoom: Record<RoomId, number>;
  };
}

function emptyShoppingList(): ShoppingList {
  const rooms = {} as ShoppingList['rooms'];
  const perRoom = {} as ShoppingList['totals']['perRoom'];
  const unitsPerRoom = {} as ShoppingList['totals']['unitsPerRoom'];
  for (const r of ROOM_ORDER) {
    rooms[r] = {};
    perRoom[r] = 0;
    unitsPerRoom[r] = 0;
  }
  return { rooms, counts: {}, totals: { items: 0, activeRooms: 0, perRoom, units: 0, unitsPerRoom } };
}

export function useShoppingList(): ComputedRef<ShoppingList> {
  const build = useBuildStore();
  return computed(() => {
    const result = emptyShoppingList();
    const seen = new Set<number>(); // itemIds already bucketed (first-occurrence wins)

    // First pass: compute per-item max occurrences in a single card.
    for (const card of build.cards) {
      if (card.level === null) continue;
      const localCounts = new Map<number, number>();
      for (const slot of SLOT_ORDER) {
        const ref = card.slots[slot];
        if (ref) localCounts.set(ref.itemId, (localCounts.get(ref.itemId) ?? 0) + 1);
      }
      for (const ref of card.dofus) {
        if (ref) localCounts.set(ref.itemId, (localCounts.get(ref.itemId) ?? 0) + 1);
      }
      for (const [itemId, n] of localCounts) {
        const prev = result.counts[itemId] ?? 0;
        if (n > prev) result.counts[itemId] = n;
      }
    }

    for (const card of build.cards) {
      if (card.level === null) continue;

      // Equipment slots (10 slot types). Each item lands in the room matching ITS OWN
      // levelRequired — that's the NPC tier that sells it, regardless of which level
      // the character will reach when wearing it.
      // EXCEPTION: the familier slot holds Familier + Montilier + Dragodinde + Muldo +
      // Volkorne. They are all sold in the level-agnostic Hub, split into two columns:
      // 'familier' (typeIds 18 + 121) and 'monture' (typeIds 97 + 196 + 207).
      for (const slot of SLOT_ORDER) {
        const ref = card.slots[slot];
        if (!ref) continue;
        if (seen.has(ref.itemId)) continue;
        const item = getCachedItem(ref.itemId);
        if (!item) {
          // Trigger background fetch; item will appear on a later computed pass.
          void ensureItem(ref.itemId).catch(() => {});
          continue;
        }
        if (slot === 'familier') {
          const npc: NpcId = MONTURE_TYPE_IDS.includes(item.typeId) ? 'monture' : 'familier';
          bucket(result, 'hub', npc, item);
        } else {
          bucket(result, levelToRoom(item.levelRequired), slotToNpc(slot), item);
        }
        seen.add(ref.itemId);
      }

      // Dofus[] cells (6, mixed dofus/trophée).
      for (let i = 0; i < DOFUS_COUNT; i++) {
        const ref = card.dofus[i];
        if (!ref) continue;
        if (seen.has(ref.itemId)) continue;
        const item = getCachedItem(ref.itemId);
        if (!item) {
          void ensureItem(ref.itemId).catch(() => {});
          continue;
        }
        let npc: NpcId;
        let room: RoomId = levelToRoom(item.levelRequired);
        if (item.typeId === TYPE_ID_DOFUS) {
          npc = 'dofus';
          room = '200'; // forced — dofus are always sold at the 200-tier NPC
        } else if (item.typeId === TYPE_ID_TROPHEE) {
          npc = 'trophee';
          if (room === '1-49') room = '50-99'; // bumped (no trophée NPC in 1-49)
        } else {
          // Unknown typeId in the dofus[] array — skip silently.
          continue;
        }
        bucket(result, room, npc, item);
        seen.add(ref.itemId);
      }
    }

    // Sort each NPC list by levelRequired ascending.
    for (const room of ROOM_ORDER) {
      const npcs = result.rooms[room];
      for (const key of Object.keys(npcs) as NpcId[]) {
        npcs[key]!.sort((a, b) => a.levelRequired - b.levelRequired);
      }
    }

    // Compute totals. `n` counts distinct list entries; `units` sums counts[itemId]
    // (the ×N badge) so the quantity totals reflect copies to actually buy.
    let totalItems = 0;
    let totalUnits = 0;
    let activeRooms = 0;
    for (const room of ROOM_ORDER) {
      let n = 0;
      let units = 0;
      for (const npc of Object.keys(result.rooms[room]) as NpcId[]) {
        const items = result.rooms[room][npc]!;
        n += items.length;
        for (const item of items) units += result.counts[item.id] ?? 1;
      }
      result.totals.perRoom[room] = n;
      result.totals.unitsPerRoom[room] = units;
      totalItems += n;
      totalUnits += units;
      if (n > 0) activeRooms += 1;
    }
    result.totals.items = totalItems;
    result.totals.units = totalUnits;
    result.totals.activeRooms = activeRooms;
    return result;
  });
}

function bucket(list: ShoppingList, room: RoomId, npc: NpcId, item: Item): void {
  const npcs = list.rooms[room];
  if (!npcs[npc]) npcs[npc] = [];
  npcs[npc]!.push(item);
}
