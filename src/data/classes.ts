import type { ClassDef } from '@/types/classes';

export const CLASSES: readonly ClassDef[] = [
  { id: 'iop',        name: 'Iop',        abbrev: 'IOP' },
  { id: 'cra',        name: 'Cra',        abbrev: 'CRA' },
  { id: 'sram',       name: 'Sram',       abbrev: 'SRA' },
  { id: 'eniripsa',   name: 'Eniripsa',   abbrev: 'ENI' },
  { id: 'sadida',     name: 'Sadida',     abbrev: 'SAD' },
  { id: 'enutrof',    name: 'Enutrof',    abbrev: 'ENU' },
  { id: 'sacrieur',   name: 'Sacrieur',   abbrev: 'SAC' },
  { id: 'ecaflip',    name: 'Ecaflip',    abbrev: 'ECA' },
  { id: 'feca',       name: 'Féca',       abbrev: 'FCA' },
  { id: 'xelor',      name: 'Xélor',      abbrev: 'XEL' },
  { id: 'pandawa',    name: 'Pandawa',    abbrev: 'PAN' },
  { id: 'osamodas',   name: 'Osamodas',   abbrev: 'OSA' },
  { id: 'roublard',   name: 'Roublard',   abbrev: 'ROU' },
  { id: 'zobal',      name: 'Zobal',      abbrev: 'ZOB' },
  { id: 'steamer',    name: 'Steamer',    abbrev: 'STE' },
  { id: 'eliotrope',  name: 'Eliotrope',  abbrev: 'ELI' },
  { id: 'huppermage', name: 'Huppermage', abbrev: 'HUP' },
  { id: 'ouginak',    name: 'Ouginak',    abbrev: 'OUG' },
  { id: 'forgelance', name: 'Forgelance', abbrev: 'FGL' },
] as const;

export const CLASSES_BY_ID: Record<string, ClassDef> = Object.fromEntries(
  CLASSES.map((c) => [c.id, c]),
);
