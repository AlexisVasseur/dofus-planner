export type SlotType =
  | 'coiffe' | 'cape' | 'amulette' | 'anneau1' | 'anneau2'
  | 'ceinture' | 'bottes' | 'arme' | 'bouclier' | 'familier';

export const SLOT_ORDER = [
  'coiffe', 'cape', 'amulette',
  'anneau1', 'anneau2',
  'ceinture', 'bottes', 'arme', 'bouclier', 'familier',
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
  bouclier: 'Bouclier',
  familier: 'Familier',
};

// "Choisir <article + nom>" — French gendered articles for the picker title.
// "bottes" stays plural; anneau slots keep their index for disambiguation.
export const SLOT_PICK_PHRASE: Record<SlotType, string> = {
  coiffe: 'une coiffe',
  cape: 'une cape',
  amulette: 'une amulette',
  anneau1: 'un anneau (1)',
  anneau2: 'un anneau (2)',
  ceinture: 'une ceinture',
  bottes: 'des bottes',
  arme: 'une arme',
  bouclier: 'un bouclier',
  familier: 'un familier',
};
