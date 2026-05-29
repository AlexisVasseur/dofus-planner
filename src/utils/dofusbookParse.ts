import type { ClassId } from '@/types/classes';
import type { InvestableStat } from '@/types/build';
import { normalizeSearch } from '@/data/dofusdb';

// The 19 class ids, used to validate the header's class word (normalized).
const CLASS_IDS: ReadonlySet<string> = new Set<ClassId>([
  'iop', 'cra', 'sram', 'eniripsa', 'sadida', 'enutrof', 'sacrieur', 'ecaflip',
  'feca', 'xelor', 'pandawa', 'osamodas', 'roublard', 'zobal', 'steamer',
  'eliotrope', 'huppermage', 'ouginak', 'forgelance',
]);

// Bare element labels that appear as noise lines in the equipped-item region
// (e.g. the build's element indicator right after "Boosts actifs"). Dropped.
const ELEMENT_NOISE: ReadonlySet<string> = new Set(['air', 'terre', 'feu', 'eau', 'neutre']);

// French stat-table labels → the app's investable stat keys. Order matches the
// Dofusbook stats panel (Puissance is item-only, not investable, so excluded).
const STAT_LABELS: ReadonlyArray<readonly [string, InvestableStat]> = [
  ['Vitalité', 'vitalite'],
  ['Sagesse', 'sagesse'],
  ['Force', 'force'],
  ['Intelligence', 'intelligence'],
  ['Chance', 'chance'],
  ['Agilité', 'agilite'],
];

export interface ParsedDofusbook {
  classId: ClassId | null;
  level: number | null;
  title: string | null;
  itemNames: string[];
  /** Invested characteristic points per stat (the "Base" column). Only stats with
   *  a non-zero invested value are present. */
  investments: Partial<Record<InvestableStat, number>>;
}

function clampLevel(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  return Math.min(200, Math.max(1, Math.round(n)));
}

/** Class + title come from the build header line, which always sits right after the
 *  "Dofusbook" tab line. The header reads "<Class> <rest>" — `rest` may be
 *  "133 - Draegnerys" (level + " - " + name) or just a name like "12 PA Kanni".
 *  We only trust the class word here; the level comes from `parseStuffLevel`. */
function parseClassAndTitle(lines: string[]): { classId: ClassId | null; title: string | null } {
  const tabIdx = lines.findIndex((l) => l === 'Dofusbook');
  if (tabIdx === -1) return { classId: null, title: null };
  const header = lines[tabIdx + 1] ?? '';
  const m = /^(\p{L}+)\s+(.*)$/u.exec(header);
  if (!m) return { classId: null, title: null };
  const norm = normalizeSearch(m[1]);
  if (!CLASS_IDS.has(norm)) return { classId: null, title: null };
  const rest = m[2].trim();
  const dash = rest.indexOf(' - ');
  const t = (dash !== -1 ? rest.slice(dash + 3) : rest).trim();
  return { classId: norm as ClassId, title: t.length > 0 ? t : null };
}

/** Character level = the "Niveau N" under the "Niv. Stuff" section. Handles both
 *  "Niveau 100" (one line) and "Niveau" then "133" (two lines). Never picks up the
 *  panoplie "Niveau 86/90" lines (those sit after "Résumé du stuff"). */
function parseStuffLevel(lines: string[]): number | null {
  const i = lines.findIndex((l) => l === 'Niv. Stuff');
  if (i === -1) return null;
  for (let j = i + 1; j < lines.length; j++) {
    if (lines[j] === '') continue;
    const inline = /^Niveau\s+(\d{1,3})$/.exec(lines[j]);
    if (inline) return clampLevel(Number(inline[1]));
    if (lines[j] === 'Niveau') {
      for (let k = j + 1; k < lines.length; k++) {
        if (lines[k] === '') continue;
        const n = Number(lines[k]);
        return Number.isFinite(n) ? clampLevel(n) : null;
      }
    }
    return null; // first non-empty line after "Niv. Stuff" wasn't a level → give up
  }
  return null;
}

/** Equipped item names live in two regions, both anchored on "Boosts actifs":
 *   - Block 1: the run of item lines just before it (skipping a blank gap and an
 *     optional lone "Forgemagie" line that may sit between block 1 and the anchor).
 *   - Block 2: the non-empty lines between it and "Résumé du stuff".
 *  Element-label noise (air/terre/…) and exact-duplicate names are dropped. */
function parseItemNames(lines: string[]): string[] {
  const idxBoosts = lines.findIndex((l) => l.startsWith('Boosts actifs'));
  const idxResume = lines.findIndex((l) => l === 'Résumé du stuff');
  const names: string[] = [];

  // Block 1: walk up from the anchor, skipping a blank gap + a lone "Forgemagie".
  if (idxBoosts !== -1) {
    let i = idxBoosts - 1;
    while (i >= 0 && (lines[i] === '' || lines[i] === 'Forgemagie')) i--;
    const block1: string[] = [];
    while (i >= 0 && lines[i] !== '' && lines[i] !== 'Forgemagie') {
      block1.push(lines[i]);
      i--;
    }
    block1.reverse();
    names.push(...block1);
  }

  // Block 2: non-empty lines between "Boosts actifs" and "Résumé du stuff".
  if (idxBoosts !== -1 && idxResume !== -1 && idxResume > idxBoosts) {
    for (let i = idxBoosts + 1; i < idxResume; i++) {
      if (lines[i] !== '') names.push(lines[i]);
    }
  }

  const seen = new Set<string>();
  return names.filter((n) => {
    if (ELEMENT_NOISE.has(n.toLowerCase())) return false;
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}

/** Invested points per stat, read from the stats panel's "Base" column. For each
 *  stat label the following numeric lines are `[+⚡ (elementals only), Base, Parcho,
 *  <next stat's total>]`. The next stat's total always trails, so Base is the
 *  third-from-last number (= second-to-last once the trailing total is dropped).
 *  The panoplie bonus lines later in the page read "100 Vitalité" (number + name on
 *  one line), so they never match an exact stat-name line and are ignored. */
function parseInvestments(lines: string[]): Partial<Record<InvestableStat, number>> {
  const out: Partial<Record<InvestableStat, number>> = {};
  for (const [label, stat] of STAT_LABELS) {
    const idx = lines.findIndex((l) => l === label);
    if (idx === -1) continue;
    const nums: number[] = [];
    for (let i = idx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (l === '' || !/^\d+$/.test(l)) break; // stop at the blank gap / next stat name
      nums.push(Number(l));
    }
    if (nums.length < 3) continue; // need at least [Base, Parcho, nextTotal]
    const base = nums[nums.length - 3];
    if (base > 0) out[stat] = base;
  }
  return out;
}

export function parseDofusbookText(text: string): ParsedDofusbook {
  const lines = text.split('\n').map((l) => l.trim());
  const { classId, title } = parseClassAndTitle(lines);
  return {
    classId,
    level: parseStuffLevel(lines),
    title,
    itemNames: parseItemNames(lines),
    investments: parseInvestments(lines),
  };
}
