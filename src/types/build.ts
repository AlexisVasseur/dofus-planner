import type { ClassId } from './classes';
import type { SlotType } from './slots';

export interface ItemRef {
  itemId: number;
}

export interface Card {
  id: string;
  classId: ClassId | null;
  level: number | null;
  title: string | null;
  slots: Record<SlotType, ItemRef | null>;
  dofus: [
    ItemRef | null,
    ItemRef | null,
    ItemRef | null,
    ItemRef | null,
    ItemRef | null,
    ItemRef | null,
  ];
}

export interface Build {
  version: 1;
  cards: Card[];
}
