import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Card, ItemRef } from '@/types/build';
import type { ClassId } from '@/types/classes';
import { SLOT_ORDER, type SlotType, DOFUS_COUNT } from '@/types/slots';
import { randomId } from '@/utils/id';

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

  function setDofus(cardId: string, index: number, item: ItemRef | null): void {
    if (index < 0 || index >= DOFUS_COUNT) {
      throw new Error(`Dofus index out of range: ${index}`);
    }
    const idx = findIndex(cardId);
    cards.value[idx].dofus[index] = item;
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
    setDofus,
    addEmptyCardAfter,
    addCopyCardAfter,
    removeCard,
    resetBuild,
    replaceCards,
  };
});
