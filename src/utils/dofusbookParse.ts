import type { ClassId } from '@/types/classes';
import { normalizeSearch } from '@/data/dofusdb';

// The 19 class ids, used to validate the header's class word (normalized).
const CLASS_IDS: ReadonlySet<string> = new Set<ClassId>([
  'iop', 'cra', 'sram', 'eniripsa', 'sadida', 'enutrof', 'sacrieur', 'ecaflip',
  'feca', 'xelor', 'pandawa', 'osamodas', 'roublard', 'zobal', 'steamer',
  'eliotrope', 'huppermage', 'ouginak', 'forgelance',
]);

export interface ParsedDofusbook {
  classId: ClassId | null;
  level: number | null;
  title: string | null;
  itemNames: string[];
}

function clampLevel(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  return Math.min(200, Math.max(1, Math.round(n)));
}

function parseHeader(lines: string[]): Omit<ParsedDofusbook, 'itemNames'> {
  const re = /^(\p{L}+)\s+(\d{1,3})\s+-\s+(.+)$/u;
  for (const line of lines) {
    const m = re.exec(line);
    if (!m) continue;
    const norm = normalizeSearch(m[1]);
    if (!CLASS_IDS.has(norm)) continue;
    const title = m[3].trim();
    return {
      classId: norm as ClassId,
      level: clampLevel(Number(m[2])),
      title: title.length > 0 ? title : null,
    };
  }
  return { classId: null, level: null, title: null };
}

function parseItemNames(lines: string[]): string[] {
  const idxForge = lines.findIndex((l) => l === 'Forgemagie');
  const idxBoosts = lines.findIndex((l) => l.startsWith('Boosts actifs'));
  const idxResume = lines.findIndex((l) => l === 'Résumé du stuff');
  const names: string[] = [];

  // Block 1: the run of non-empty lines ending just before "Forgemagie".
  if (idxForge !== -1) {
    let i = idxForge - 1;
    while (i >= 0 && lines[i] === '') i--; // skip the blank gap
    const block1: string[] = [];
    while (i >= 0 && lines[i] !== '') { block1.push(lines[i]); i--; }
    block1.reverse();
    names.push(...block1);
  }

  // Block 2: non-empty lines between "Boosts actifs" and "Résumé du stuff".
  if (idxBoosts !== -1 && idxResume !== -1 && idxResume > idxBoosts) {
    for (let i = idxBoosts + 1; i < idxResume; i++) {
      if (lines[i] !== '') names.push(lines[i]);
    }
  }

  // Drop exact-duplicate names, preserve first-seen order.
  const seen = new Set<string>();
  return names.filter((n) => (seen.has(n) ? false : (seen.add(n), true)));
}

export function parseDofusbookText(text: string): ParsedDofusbook {
  const lines = text.split('\n').map((l) => l.trim());
  return { ...parseHeader(lines), itemNames: parseItemNames(lines) };
}
