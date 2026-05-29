import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Card, ItemRef, InvestableStat } from '@/types/build';
import { INVESTABLE_STATS } from '@/types/build';
import type { ClassId } from '@/types/classes';
import { SLOT_ORDER, type SlotType, DOFUS_COUNT } from '@/types/slots';
import { randomId } from '@/utils/id';
import { getCachedItem } from '@/composables/useItemCatalog';
import { getInvestment, getExo } from '@/utils/statCost';
import { SLOT_TO_TYPE_IDS } from '@/data/dofusdb';

export type ExoKey = 'pa' | 'pm' | 'po';

// typeId → slot, EXCLUDING the two ring slots (typeId 9 maps to both, handled
// separately in equipItemSet). Every other typeId maps to exactly one slot.
const RING_TYPE_ID = 9;
const TYPE_ID_TO_SLOT: Record<number, SlotType> = (() => {
  const map: Record<number, SlotType> = {};
  for (const slot of SLOT_ORDER) {
    if (slot === 'anneau1' || slot === 'anneau2') continue;
    for (const tid of SLOT_TO_TYPE_IDS[slot]) map[tid] = slot;
  }
  return map;
})();

function emptySlots(): Record<SlotType, ItemRef | null> {
  const result = {} as Record<SlotType, ItemRef | null>;
  for (const s of SLOT_ORDER) result[s] = null;
  return result;
}

function emptyDofus(): Card['dofus'] {
  return [null, null, null, null, null, null];
}

export function makeFreshFirstCard(): Card {
  return {
    id: randomId(),
    classId: null,
    level: 1,
    title: null,
    slots: emptySlots(),
    dofus: emptyDofus(),
  };
}

export const useBuildStore = defineStore('build', () => {
  const cards = ref<Card[]>([makeFreshFirstCard()]);

  function findIndex(cardId: string): number {
    const idx = cards.value.findIndex((c) => c.id === cardId);
    if (idx === -1) throw new Error(`Card not found: ${cardId}`);
    return idx;
  }

  function setClass(cardId: string, classId: ClassId): void {
    const idx = findIndex(cardId);
    cards.value[idx].classId = classId;
  }

  function setLevel(cardId: string, level: number | null): void {
    const idx = findIndex(cardId);
    cards.value[idx].level = level;
  }

  function setTitle(cardId: string, title: string | null): void {
    const idx = findIndex(cardId);
    const trimmed = title?.trim() ?? '';
    cards.value[idx].title = trimmed.length > 0 ? trimmed : null;
  }

  function setSlot(cardId: string, slot: SlotType, item: ItemRef | null): void {
    const idx = findIndex(cardId);
    cards.value[idx].slots[slot] = item;
  }

  /** Equip a full panoplie. Each piece overwrites its homologous slot; slots not
   *  covered by the set are left intact. Rings (typeId 9): one ring goes to the
   *  first empty ring slot (else overwrites anneau1); two rings fill both slots.
   *  Pieces whose typeId maps to no slot, or items absent from the cache, are
   *  skipped (the caller warms the cache beforehand). */
  function equipItemSet(cardId: string, itemIds: number[]): void {
    const idx = findIndex(cardId);
    const card = cards.value[idx];
    const rings: number[] = [];
    for (const id of itemIds) {
      const item = getCachedItem(id);
      if (!item) continue;
      if (item.typeId === RING_TYPE_ID) {
        rings.push(id);
        continue;
      }
      const slot = TYPE_ID_TO_SLOT[item.typeId];
      if (!slot) continue;
      card.slots[slot] = { itemId: id };
    }
    if (rings.length === 1) {
      if (card.slots.anneau1 === null) card.slots.anneau1 = { itemId: rings[0] };
      else if (card.slots.anneau2 === null) card.slots.anneau2 = { itemId: rings[0] };
      else card.slots.anneau1 = { itemId: rings[0] };
    } else if (rings.length >= 2) {
      card.slots.anneau1 = { itemId: rings[0] };
      card.slots.anneau2 = { itemId: rings[1] };
    }
  }

  function setDofus(cardId: string, index: number, item: ItemRef | null): void {
    if (index < 0 || index >= DOFUS_COUNT) {
      throw new Error(`Dofus index out of range: ${index}`);
    }
    const idx = findIndex(cardId);
    cards.value[idx].dofus[index] = item;
  }

  /**
   * Bulk-apply an item to the same slot on every card whose level lies in [from, to]
   * AND can equip the item (card.level >= item.levelRequired). Skipped cards: those
   * with a null level, out-of-range, or under-leveled. Range bounds are auto-swapped
   * if from > to. Returns the count of cards actually updated.
   */
  function setSlotRange(
    slot: SlotType,
    range: [number, number],
    item: ItemRef,
  ): number {
    const [from, to] = range[0] <= range[1] ? range : [range[1], range[0]];
    const minLevel = getCachedItem(item.itemId)?.levelRequired ?? 0;
    let updated = 0;
    for (const card of cards.value) {
      if (card.level === null) continue;
      if (card.level < from || card.level > to) continue;
      if (card.level < minLevel) continue;
      card.slots[slot] = { ...item };
      updated++;
    }
    return updated;
  }

  /** Same as setSlotRange but for the positional dofus[index] cell. */
  function setDofusRange(
    index: number,
    range: [number, number],
    item: ItemRef,
  ): number {
    if (index < 0 || index >= DOFUS_COUNT) {
      throw new Error(`Dofus index out of range: ${index}`);
    }
    const [from, to] = range[0] <= range[1] ? range : [range[1], range[0]];
    const minLevel = getCachedItem(item.itemId)?.levelRequired ?? 0;
    let updated = 0;
    for (const card of cards.value) {
      if (card.level === null) continue;
      if (card.level < from || card.level > to) continue;
      if (card.level < minLevel) continue;
      card.dofus[index] = { ...item };
      updated++;
    }
    return updated;
  }

  function addEmptyCardAfter(cardId: string): void {
    const idx = findIndex(cardId);
    const prev = cards.value[idx];
    const next: Card = {
      id: randomId(),
      classId: prev.classId,
      level: null,
      title: null,
      slots: emptySlots(),
      dofus: emptyDofus(),
    };
    cards.value.splice(idx + 1, 0, next);
  }

  function addCopyCardAfter(cardId: string): void {
    const idx = findIndex(cardId);
    const prev = cards.value[idx];
    const copy: Card = {
      id: randomId(),
      classId: prev.classId,
      level: prev.level === null ? null : prev.level + 1,
      title: prev.title,
      slots: { ...prev.slots },
      dofus: [...prev.dofus] as Card['dofus'],
    };
    cards.value.splice(idx + 1, 0, copy);
  }

  function setStatInvested(cardId: string, stat: InvestableStat, value: number): void {
    const idx = findIndex(cardId);
    const card = cards.value[idx];
    const prev = getInvestment(card, stat);
    card.investments ??= {};
    card.investments[stat] = { ...prev, invested: Math.max(0, Math.round(value)) };
  }

  function setStatScrolled(cardId: string, stat: InvestableStat, scrolled: boolean): void {
    const idx = findIndex(cardId);
    const card = cards.value[idx];
    const prev = getInvestment(card, stat);
    card.investments ??= {};
    card.investments[stat] = { ...prev, scrolled };
  }

  function setCardExo(cardId: string, key: ExoKey, value: boolean): void {
    const idx = findIndex(cardId);
    const card = cards.value[idx];
    const prev = getExo(card);
    card.exo = { ...prev, [key]: value };
  }

  /** Bulk: set the `scrolled` flag of every investable stat on every card. */
  function applyScrollAll(scrolled: boolean): void {
    for (const card of cards.value) {
      card.investments ??= {};
      for (const stat of INVESTABLE_STATS) {
        const prev = getInvestment(card, stat);
        card.investments[stat] = { ...prev, scrolled };
      }
    }
  }

  /** Bulk: set one Exo flag (PA / PM / PO) on every card. */
  function applyExoAll(key: ExoKey, value: boolean): void {
    for (const card of cards.value) {
      const prev = getExo(card);
      card.exo = { ...prev, [key]: value };
    }
  }

  /** Insert an externally-built card (e.g. decoded from a base64 code) right after
   *  `cardId`. The caller owns id generation — pass a fresh one. ClassId falls back
   *  to the previous card's class when the imported card has none. */
  function addCardAfter(cardId: string, card: Card): void {
    const idx = findIndex(cardId);
    const prev = cards.value[idx];
    const next: Card = {
      ...card,
      classId: card.classId ?? prev.classId,
    };
    cards.value.splice(idx + 1, 0, next);
  }

  function removeCard(cardId: string): void {
    const idx = findIndex(cardId);
    cards.value.splice(idx, 1);
    if (cards.value.length === 0) {
      cards.value.push(makeFreshFirstCard());
    }
  }

  function resetBuild(): void {
    cards.value = [makeFreshFirstCard()];
  }

  function replaceCards(next: Card[]): void {
    cards.value = next;
  }

  return {
    cards,
    setClass,
    setLevel,
    setTitle,
    setSlot,
    equipItemSet,
    setDofus,
    setSlotRange,
    setDofusRange,
    addEmptyCardAfter,
    addCopyCardAfter,
    addCardAfter,
    setStatInvested,
    setStatScrolled,
    setCardExo,
    applyScrollAll,
    applyExoAll,
    removeCard,
    resetBuild,
    replaceCards,
  };
});
