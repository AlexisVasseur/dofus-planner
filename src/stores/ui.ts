import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SlotType } from '@/types/slots';

export type ItemPickerTarget =
  | { kind: 'slot'; cardId: string; slot: SlotType }
  | { kind: 'dofus'; cardId: string; index: number };

export type ViewMode = 'build' | 'switch' | 'purchase';

export const useUiStore = defineStore('ui', () => {
  const activeCardId = ref<string | null>(null);
  // Bumped on every setActiveCard call so listeners can re-centre even when the id is unchanged
  // (e.g. clicking the already-active card to bring it back to the viewport centre after manual scroll).
  const centerCardTick = ref(0);
  // Explicit shopping-room jump request (used by the Hub cell in the minimap, since the
  // Hub has no card-level mapping). AppPurchasePlanner watches this and scrolls.
  const purchaseScrollTick = ref(0);
  const purchaseScrollRoom = ref<string | null>(null);
  const itemPickerTarget = ref<ItemPickerTarget | null>(null);
  const classPickerCardId = ref<string | null>(null);
  const viewMode = ref<ViewMode>('build');

  function setActiveCard(id: string | null): void {
    activeCardId.value = id;
    if (id !== null) centerCardTick.value++;
  }

  function openItemPicker(target: ItemPickerTarget): void {
    itemPickerTarget.value = target;
    activeCardId.value = target.cardId;
    centerCardTick.value++;
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

  function requestPurchaseScroll(room: string): void {
    purchaseScrollRoom.value = room;
    purchaseScrollTick.value++;
  }

  return {
    activeCardId,
    centerCardTick,
    purchaseScrollTick,
    purchaseScrollRoom,
    requestPurchaseScroll,
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
