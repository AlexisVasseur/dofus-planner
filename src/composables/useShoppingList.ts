import { computed, type ComputedRef } from 'vue';
import { useBuildStore } from '@/stores/build';
import { ensureItem, getCachedItem } from '@/composables/useItemCatalog';
import {
  ROOM_ORDER, type RoomId,
  type NpcId,
  TYPE_ID_DOFUS, TYPE_ID_TROPHEE,
  slotToNpc, levelToRoom,
} from '@/types/rooms';
import { SLOT_ORDER, DOFUS_COUNT } from '@/types/slots';
import type { Item } from '@/data/dofusdb';

export interface ShoppingList {
  rooms: Record<RoomId, Partial<Record<NpcId, Item[]>>>;
  totals: {
    items: number;
    activeRooms: number;
    perRoom: Record<RoomId, number>;
  };
}

function emptyShoppingList(): ShoppingList {
  const rooms = {} as ShoppingList['rooms'];
  const perRoom = {} as ShoppingList['totals']['perRoom'];
  for (const r of ROOM_ORDER) {
    rooms[r] = {};
    perRoom[r] = 0;
  }
  return { rooms, totals: { items: 0, activeRooms: 0, perRoom } };
}

export function useShoppingList(): ComputedRef<ShoppingList> {
  const build = useBuildStore();
  return computed(() => {
    const result = emptyShoppingList();
    const seen = new Set<number>(); // itemIds already bucketed (first-occurrence wins)

    for (const card of build.cards) {
      if (card.level === null) continue;
      const cardRoom = levelToRoom(card.level);

      // Equipment slots (10 slot types).
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
        const npc = slotToNpc(slot);
        bucket(result, cardRoom, npc, item);
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
        let room: RoomId = cardRoom;
        if (item.typeId === TYPE_ID_DOFUS) {
          npc = 'dofus';
          room = '200'; // forced
        } else if (item.typeId === TYPE_ID_TROPHEE) {
          npc = 'trophee';
          if (room === '1-50') room = '51-100'; // bumped (no trophée NPC in 1-50)
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

    // Compute totals.
    let totalItems = 0;
    let activeRooms = 0;
    for (const room of ROOM_ORDER) {
      let n = 0;
      for (const npc of Object.keys(result.rooms[room]) as NpcId[]) {
        n += result.rooms[room][npc]!.length;
      }
      result.totals.perRoom[room] = n;
      totalItems += n;
      if (n > 0) activeRooms += 1;
    }
    result.totals.items = totalItems;
    result.totals.activeRooms = activeRooms;
    return result;
  });
}

function bucket(list: ShoppingList, room: RoomId, npc: NpcId, item: Item): void {
  const npcs = list.rooms[room];
  if (!npcs[npc]) npcs[npc] = [];
  npcs[npc]!.push(item);
}
