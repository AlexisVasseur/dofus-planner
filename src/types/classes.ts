export type ClassId =
  | 'iop' | 'cra' | 'sram' | 'eniripsa' | 'sadida' | 'enutrof'
  | 'sacrieur' | 'ecaflip' | 'feca' | 'xelor' | 'pandawa'
  | 'osamodas' | 'roublard' | 'zobal' | 'steamer' | 'eliotrope'
  | 'huppermage' | 'ouginak';

export interface ClassDef {
  id: ClassId;
  name: string;       // "Iop"
  abbrev: string;     // "IOP" (3 letters, uppercase, used in fallback hex art)
}
