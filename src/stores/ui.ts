import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SlotType } from '@/types/slots';
import type { InvestableStat } from '@/types/build';

export type ItemPickerTarget =
  | { kind: 'slot'; cardId: string; slot: SlotType }
  | { kind: 'dofus'; cardId: string; index: number };

export type ViewMode = 'build' | 'switch' | 'purchase';

export interface StatModalTarget {
  cardId: string;
  stat: InvestableStat;
}

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
  // When set, the import-code modal is open. Value = id of the card after which
  // the imported card will be inserted.
  const codeImportAfterCardId = ref<string | null>(null);
  // When set, the stat investment modal is open for {cardId, stat}.
  const statModalTarget = ref<StatModalTarget | null>(null);

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

  function openCodeImport(afterCardId: string): void {
    codeImportAfterCardId.value = afterCardId;
  }

  function closeCodeImport(): void {
    codeImportAfterCardId.value = null;
  }

  function openStatModal(target: StatModalTarget): void {
    statModalTarget.value = target;
  }

  function closeStatModal(): void {
    statModalTarget.value = null;
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
    codeImportAfterCardId,
    statModalTarget,
    setActiveCard,
    openItemPicker,
    closeItemPicker,
    openClassPicker,
    closeClassPicker,
    setViewMode,
    openCodeImport,
    closeCodeImport,
    openStatModal,
    closeStatModal,
  };
});
