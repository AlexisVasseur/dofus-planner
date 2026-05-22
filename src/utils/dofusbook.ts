import type { Card } from '@/types/build';

// Dofusbook characteristic indices (0–51 total). We only emit the ones we know.
// These are NOT the DofusDB ids — they are dofusbook's own ordering used in t[0].
const DB_VITA = 0;
const DB_SAG = 1;
const DB_FORCE = 2;
const DB_INTE = 3;
const DB_CHANCE = 4;
const DB_AGI = 5;
const DB_PA = 6;
const DB_PM = 7;
const DB_INIT = 9;
const DB_INVOC = 11;
const DB_PODS = 23;

// Item category indices in dofusbook's t[5] flat layout. Items are concatenated
// in ascending category order; t[4] (NumPicks) carries the count for every
// category whose value differs from 1.
const CAT_CAPE = 0;
const CAT_COIFFE = 1;
const CAT_CEINTURE = 2;
const CAT_BOTTES = 3;
const CAT_AMULETTE = 4;
const CAT_ANNEAU = 5;
const CAT_DOFUS = 6;
const CAT_BOUCLIER = 7;
const CAT_ARME = 8;
const CAT_MONTURE = 9;
const UNUSED_CATS = [10, 11, 12, 13, 14, 15, 16] as const;

// t[3] bitfield — defaults match dofusbook's "stuffer" preset.
const FLAG_ALLOW_DAMAGE = 8;
const FLAG_PUISSANCE_CARAC = 16;
const DEFAULT_FLAGS = FLAG_ALLOW_DAMAGE | FLAG_PUISSANCE_CARAC;

const DOFUSBOOK_BASE_URL = 'https://www.dofusbook.net/fr/equipement/dofus-stuffer/objets';

/** Mirror of useCardStats.baseStats(), reindexed to dofusbook's t[0] characteristic ids
 * and augmented with the static defaults (Initiative=100, Invocations=1, Pods=1000)
 * that dofusbook expects on every character. */
function buildBaseStats(level: number): Record<number, number> {
  return {
    [DB_VITA]: 50 + 5 * level + 100,
    [DB_SAG]: 100,
    [DB_FORCE]: 100,
    [DB_INTE]: 100,
    [DB_CHANCE]: 100,
    [DB_AGI]: 100,
    [DB_PA]: level >= 100 ? 7 : 6,
    [DB_PM]: 3,
    [DB_INIT]: 100,
    [DB_INVOC]: 1,
    [DB_PODS]: 1000,
  };
}

interface PackedItems {
  items: number[];
  numPicks: Record<number, number>;
}

function buildItemArrayAndPicks(card: Card): PackedItems {
  const byCat: Record<number, number[]> = {};
  const push = (cat: number, id: number | undefined | null): void => {
    if (!id) return;
    (byCat[cat] ??= []).push(id);
  };
  push(CAT_CAPE, card.slots.cape?.itemId);
  push(CAT_COIFFE, card.slots.coiffe?.itemId);
  push(CAT_CEINTURE, card.slots.ceinture?.itemId);
  push(CAT_BOTTES, card.slots.bottes?.itemId);
  push(CAT_AMULETTE, card.slots.amulette?.itemId);
  push(CAT_ANNEAU, card.slots.anneau1?.itemId);
  push(CAT_ANNEAU, card.slots.anneau2?.itemId);
  for (const d of card.dofus) push(CAT_DOFUS, d?.itemId);
  push(CAT_BOUCLIER, card.slots.bouclier?.itemId);
  push(CAT_ARME, card.slots.arme?.itemId);
  // Our familier slot covers Familier / Montilier / Dragodinde / Muldo / Volkorne —
  // dofusbook lumps them into the "monture" category.
  push(CAT_MONTURE, card.slots.familier?.itemId);

  const items: number[] = [];
  const numPicks: Record<number, number> = {};
  for (let cat = 0; cat <= 9; cat++) {
    const arr = byCat[cat] ?? [];
    items.push(...arr);
    if (arr.length !== 1) numPicks[cat] = arr.length;
  }
  for (const cat of UNUSED_CATS) numPicks[cat] = 0;
  return { items, numPicks };
}

// ---- Minimal msgpack encoder (enough for the dofusbook payload) ----------

function encodeUint(n: number, out: number[]): void {
  if (n < 0 || !Number.isInteger(n)) throw new Error(`Bad uint for msgpack: ${n}`);
  if (n <= 0x7f) {
    out.push(n);
  } else if (n <= 0xff) {
    out.push(0xcc, n);
  } else if (n <= 0xffff) {
    out.push(0xcd, (n >> 8) & 0xff, n & 0xff);
  } else if (n <= 0xffffffff) {
    out.push(0xce, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
  } else {
    throw new Error(`Uint too large for msgpack: ${n}`);
  }
}

function encodeArrayHeader(n: number, out: number[]): void {
  if (n <= 15) out.push(0x90 | n);
  else if (n <= 0xffff) out.push(0xdc, (n >> 8) & 0xff, n & 0xff);
  else throw new Error('Array too large for msgpack');
}

function encodeMapHeader(n: number, out: number[]): void {
  if (n <= 15) out.push(0x80 | n);
  else if (n <= 0xffff) out.push(0xde, (n >> 8) & 0xff, n & 0xff);
  else throw new Error('Map too large for msgpack');
}

type MsgpackValue = number | number[] | Record<number, number>;

function encodeValue(v: MsgpackValue, out: number[]): void {
  if (Array.isArray(v)) {
    encodeArrayHeader(v.length, out);
    for (const e of v) encodeUint(e, out);
  } else if (typeof v === 'object' && v !== null) {
    // Sort keys numerically — Object.keys() already returns int-like keys in ascending
    // order, but sorting is cheap and makes the output fully deterministic.
    const keys = Object.keys(v).map((k) => parseInt(k, 10)).sort((a, b) => a - b);
    encodeMapHeader(keys.length, out);
    for (const k of keys) {
      encodeUint(k, out);
      encodeUint(v[k], out);
    }
  } else {
    encodeUint(v, out);
  }
}

function toBase64(bytes: number[]): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

// ---- Public API -----------------------------------------------------------

export function buildDofusbookUrl(card: Card): string {
  const level = card.level ?? 1;
  const root: Record<number, MsgpackValue> = {
    0: buildBaseStats(level),
    1: [0, 0, 0, 0, 0, 0], // AdditionalPoints — V1 doesn't track manual scrolls
    2: level,
    3: DEFAULT_FLAGS,
    4: {} as Record<number, number>,
    5: [] as number[],
  };
  const { items, numPicks } = buildItemArrayAndPicks(card);
  root[4] = numPicks;
  root[5] = items;

  const out: number[] = [];
  encodeMapHeader(6, out);
  for (const k of [0, 1, 2, 3, 4, 5] as const) {
    encodeUint(k, out);
    encodeValue(root[k], out);
  }

  return `${DOFUSBOOK_BASE_URL}?stuff=${toBase64(out)}`;
}
