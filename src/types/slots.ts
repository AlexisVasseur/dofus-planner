export type SlotType =
  | 'coiffe' | 'cape' | 'amulette' | 'anneau1' | 'anneau2'
  | 'ceinture' | 'bottes' | 'arme' | 'familier';

export const SLOT_ORDER: readonly SlotType[] = [
  'coiffe', 'cape', 'amulette',
  'anneau1', 'anneau2',
  'ceinture', 'bottes', 'arme', 'familier',
] as const;

export const DOFUS_COUNT = 6;

export const SLOT_LABEL: Record<SlotType, string> = {
  coiffe: 'Coiffe',
  cape: 'Cape',
  amulette: 'Amulette',
  anneau1: 'Anneau',
  anneau2: 'Anneau',
  ceinture: 'Ceinture',
  bottes: 'Bottes',
  arme: 'Arme',
  familier: 'Familier',
};
