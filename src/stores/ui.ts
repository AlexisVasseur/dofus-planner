import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SlotType } from '@/types/slots';

export type ItemPickerTarget =
  | { kind: 'slot'; cardId: string; slot: SlotType }
  | { kind: 'dofus'; cardId: string; index: number };

export type ViewMode = 'build' | 'switch';

export const useUiStore = defineStore('ui', () => {
  const activeCardId = ref<string | null>(null);
  const itemPickerTarget = ref<ItemPickerTarget | null>(null);
  const classPickerCardId = ref<string | null>(null);
  const viewMode = ref<ViewMode>('build');

  function setActiveCard(id: string | null): void {
    activeCardId.value = id;
  }

  function openItemPicker(target: ItemPickerTarget): void {
    itemPickerTarget.value = target;
    activeCardId.value = target.cardId;
  }

  function closeItemPicker(): void {
    itemPickerTarget.value = null;
  }

  function openClassPicker(cardId: string): void {
    classPickerCardId.value = cardId;
  }

  function closeClassPicker(): void {
    classPickerCardId.value = null;
  }

  function setViewMode(mode: ViewMode): void {
    viewMode.value = mode;
  }

  return {
    activeCardId,
    itemPickerTarget,
    classPickerCardId,
    viewMode,
    setActiveCard,
    openItemPicker,
    closeItemPicker,
    openClassPicker,
    closeClassPicker,
    setViewMode,
  };
});
