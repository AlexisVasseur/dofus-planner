export type SlotType =
  | 'coiffe' | 'cape' | 'amulette' | 'anneau1' | 'anneau2'
  | 'ceinture' | 'bottes' | 'arme' | 'familier';

export const SLOT_ORDER = [
  'coiffe', 'cape', 'amulette',
  'anneau1', 'anneau2',
  'ceinture', 'bottes', 'arme', 'familier',
] as const satisfies readonly SlotType[];

export const DOFUS_COUNT = 6;

export const SLOT_LABEL: Record<SlotType, string> = {
  coiffe: 'Coiffe',
  cape: 'Cape',
  amulette: 'Amulette',
  anneau1: 'Anneau 1',
  anneau2: 'Anneau 2',
  ceinture: 'Ceinture',
  bottes: 'Bottes',
  arme: 'Arme',
  familier: 'Familier',
};
