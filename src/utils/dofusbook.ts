import type { Card, ItemRef, InvestableStat, StatInvestment } from '@/types/build';
import { SLOT_ORDER, DOFUS_COUNT, type SlotType } from '@/types/slots';
import { randomId } from '@/utils/id';
import { getInvestment, getExo } from '@/utils/statCost';

// Dofusbook characteristic indices in t[0] BaseStats. Keys 0..5 are the six investable
// carac stats (vita / sag / force / inte / chance / agi). Keys 6..32 hold secondary
// caracs the current dofusbook UI reads (damage stats, pods, …). We've verified empirically:
//   - key 6 displays as "Do Eau" (PA=7 there leaked as "7 Do Eau")
//   - key 7 displays as "Do Feu" (PM=3 there leaked as "3 Do Feu")
//   - key 23 holds Pods (missing → "Pods -1000" via dofusbook's 1000-baseline subtraction)
// Other indices that map to "Dommages" / "Do Poussée" haven't been pinpointed; we emit
// zeros across the whole 6..32 range so dofusbook reads 0 instead of NaN for whichever
// slot maps to them.
const DB_VITA = 0;
const DB_SAG = 1;
const DB_FORCE = 2;
const DB_INTE = 3;
const DB_CHANCE = 4;
const DB_AGI = 5;
const DB_PODS = 23;
// Exo PA / PM / PO indices in the dofusbook fm/we array. Writing +1 at these keys
// in t[0] makes the imported build display PA=7 (or 8 at lvl 100+), PM=4, PO=…+1.
const DB_EXO_PA = 22;
const DB_EXO_PM = 26;
const DB_EXO_PO = 27;

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

// t[3] bitfield — defaults match dofusbook's "stuffer" preset.
const FLAG_ALLOW_DAMAGE = 8;
const FLAG_PUISSANCE_CARAC = 16;
const DEFAULT_FLAGS = FLAG_ALLOW_DAMAGE | FLAG_PUISSANCE_CARAC;

const DOFUSBOOK_BASE_URL = 'https://www.dofusbook.net/fr/equipement/dofus-stuffer/objets';

/** Mapping between our investable stat keys and dofusbook's t[0]/t[1] indices.
 *  Order matters for t[1] AdditionalPoints — it's a flat 6-uint array following
 *  dofusbook's carac order: Vita, Sag, Force, Inte, Chance, Agi. */
const STAT_TO_DB_INDEX: Record<InvestableStat, number> = {
  vitalite: DB_VITA,
  sagesse: DB_SAG,
  force: DB_FORCE,
  intelligence: DB_INTE,
  chance: DB_CHANCE,
  agilite: DB_AGI,
};
const DB_INDEX_TO_STAT: Record<number, InvestableStat> = {
  [DB_VITA]: 'vitalite',
  [DB_SAG]: 'sagesse',
  [DB_FORCE]: 'force',
  [DB_INTE]: 'intelligence',
  [DB_CHANCE]: 'chance',
  [DB_AGI]: 'agilite',
};
/** t[1] AdditionalPoints order — dofusbook stores raw POINTS (not stat values) here. */
const ADDITIONAL_POINTS_ORDER: readonly InvestableStat[] = [
  'vitalite', 'sagesse', 'force', 'intelligence', 'chance', 'agilite',
];

/** Per-stat baseline values for t[0] BaseStats. Keys 0..5 carry the six carac stats
 *  (vita gets the per-level 50 + 5*lvl base; the others start at 0). Each stat picks
 *  up +100 when the player applied "Parcho 100" (the `scrolled` flag).
 *
 *  Keys 6..50 are 0-padded because dofusbook's URL-import decoder iterates a fixed
 *  range of carac indices and reads NaN on missing keys. Key 23 (Pods) is restored
 *  to its 1000 baseline so dofusbook's "Pods supplémentaires = key23 - 1000" lands
 *  on 0 (otherwise it shows -1000).
 *
 *  Note: even with this, dofusbook's UI displays "NaN" for Dommages and Do Poussée
 *  on URL-share imports. That's a bug in dofusbook's `su()` function (it computes
 *  `fm[c] - characterStats[name]` for c=9 / c=11, but `characterStats` only carries
 *  ic/pa/pd/pm/pp/pv — `.dmg` and `.dp` are undefined → NaN). Nothing we encode here
 *  can avoid that subtraction. */
function buildBaseStats(card: Card): Record<number, number> {
  const level = card.level ?? 1;
  const result: Record<number, number> = {
    [DB_VITA]: 50 + 5 * level,
    [DB_SAG]: 0,
    [DB_FORCE]: 0,
    [DB_INTE]: 0,
    [DB_CHANCE]: 0,
    [DB_AGI]: 0,
  };
  for (const [stat, dbIdx] of Object.entries(STAT_TO_DB_INDEX) as [InvestableStat, number][]) {
    if (getInvestment(card, stat).scrolled) result[dbIdx] += 100;
  }
  for (let k = 6; k <= 50; k++) {
    if (!(k in result)) result[k] = 0;
  }
  result[DB_PODS] = 1000;
  // Exo +1 PA / PM / PO override the zero-padding for the corresponding fm index.
  const exo = getExo(card);
  if (exo.pa) result[DB_EXO_PA] = 1;
  if (exo.pm) result[DB_EXO_PM] = 1;
  if (exo.po) result[DB_EXO_PO] = 1;
  return result;
}

/** Per-stat invested STAT values (NOT raw points), ordered for t[1] AdditionalPoints.
 *  Despite the field name, dofusbook stores the stat bonus you bought, not the point
 *  cost — verified against a build that invested 300 stats: t[1] reads 300, not 600. */
function buildAdditionalPoints(card: Card): number[] {
  return ADDITIONAL_POINTS_ORDER.map((stat) => getInvestment(card, stat).invested);
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
  // Previously we also wrote { 10..16 → 0 } as a defensive default, but those slots
  // are interpreted by the current dofusbook UI as forgemagie damage stats, producing
  // parasitic "NaN Dommages" / "NaN Do Poussée" lines on the imported build.
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

function fromBase64(b64: string): number[] {
  const s = atob(b64.trim());
  const out: number[] = new Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// ---- Minimal msgpack decoder (mirrors the encoder above) -----------------

interface Cursor { i: number; }

function decodeUint(bytes: number[], c: Cursor): number {
  const head = bytes[c.i++];
  if (head <= 0x7f) return head;
  if (head === 0xcc) return bytes[c.i++];
  if (head === 0xcd) { const v = (bytes[c.i] << 8) | bytes[c.i + 1]; c.i += 2; return v; }
  if (head === 0xce) {
    const v = (bytes[c.i] * 0x1000000) + ((bytes[c.i + 1] << 16) | (bytes[c.i + 2] << 8) | bytes[c.i + 3]);
    c.i += 4;
    return v >>> 0;
  }
  throw new Error(`msgpack: not a uint at offset ${c.i - 1} (head=${head.toString(16)})`);
}

/** Read a map KEY which may be encoded as either a uint (our format) or a fixstr/str8
 *  (the older dofusbook export format that serialised every JS object key as a string).
 *  Strings are parsed back into numbers so callers can keep treating keys as ints. */
function decodeMapKey(bytes: number[], c: Cursor): number {
  const head = bytes[c.i];
  // fixstr: 0xa0 | length (length 0..31)
  if ((head & 0xe0) === 0xa0) {
    c.i++;
    const len = head & 0x1f;
    let s = '';
    for (let k = 0; k < len; k++) s += String.fromCharCode(bytes[c.i + k]);
    c.i += len;
    return Number(s);
  }
  // str8: 0xd9 + length byte
  if (head === 0xd9) {
    c.i++;
    const len = bytes[c.i++];
    let s = '';
    for (let k = 0; k < len; k++) s += String.fromCharCode(bytes[c.i + k]);
    c.i += len;
    return Number(s);
  }
  return decodeUint(bytes, c);
}

function decodeArrayHeader(bytes: number[], c: Cursor): number {
  const head = bytes[c.i++];
  if ((head & 0xf0) === 0x90) return head & 0x0f;
  if (head === 0xdc) { const v = (bytes[c.i] << 8) | bytes[c.i + 1]; c.i += 2; return v; }
  throw new Error(`msgpack: not an array at offset ${c.i - 1}`);
}

function decodeMapHeader(bytes: number[], c: Cursor): number {
  const head = bytes[c.i++];
  if ((head & 0xf0) === 0x80) return head & 0x0f;
  if (head === 0xde) { const v = (bytes[c.i] << 8) | bytes[c.i + 1]; c.i += 2; return v; }
  throw new Error(`msgpack: not a map at offset ${c.i - 1}`);
}

/** Skip an arbitrary value — used when we don't care about a given map slot
 *  (e.g. baseStats and additional-points blocks aren't needed for decode). */
function skipValue(bytes: number[], c: Cursor): void {
  const head = bytes[c.i];
  if (head <= 0x7f || head === 0xcc || head === 0xcd || head === 0xce) {
    decodeUint(bytes, c);
    return;
  }
  if ((head & 0xe0) === 0xa0) {
    // fixstr — payload bytes after the head.
    const len = head & 0x1f;
    c.i += 1 + len;
    return;
  }
  if (head === 0xd9) {
    c.i++;
    const len = bytes[c.i++];
    c.i += len;
    return;
  }
  if (head === 0xc0 || head === 0xc2 || head === 0xc3) {
    // nil / false / true — single byte values some encoders use as null payloads.
    c.i++;
    return;
  }
  if ((head & 0xf0) === 0x90 || head === 0xdc) {
    const n = decodeArrayHeader(bytes, c);
    for (let i = 0; i < n; i++) skipValue(bytes, c);
    return;
  }
  if ((head & 0xf0) === 0x80 || head === 0xde) {
    const n = decodeMapHeader(bytes, c);
    for (let i = 0; i < n; i++) { skipValue(bytes, c); skipValue(bytes, c); }
    return;
  }
  throw new Error(`msgpack: unsupported head 0x${head.toString(16)} at offset ${c.i}`);
}

// ---- Public API -----------------------------------------------------------

/** Encode a card to dofusbook's base64 "stuff" payload (msgpack inside).
 *  Format is round-trip compatible with dofusbook — pasting a code here that
 *  was generated by dofusbook.net works too. */
export function encodeCardCode(card: Card): string {
  const level = card.level ?? 1;
  const root: Record<number, MsgpackValue> = {
    0: buildBaseStats(card),
    1: buildAdditionalPoints(card),
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
  return toBase64(out);
}

/** Map dofusbook category index → SlotType (or 'dofus' for the dofus array).
 *  Anneau category holds up to 2 items, dofus up to 6. */
const CAT_TO_SLOTS: Record<number, SlotType[] | 'dofus'> = {
  [CAT_CAPE]: ['cape'],
  [CAT_COIFFE]: ['coiffe'],
  [CAT_CEINTURE]: ['ceinture'],
  [CAT_BOTTES]: ['bottes'],
  [CAT_AMULETTE]: ['amulette'],
  [CAT_ANNEAU]: ['anneau1', 'anneau2'],
  [CAT_DOFUS]: 'dofus',
  [CAT_BOUCLIER]: ['bouclier'],
  [CAT_ARME]: ['arme'],
  [CAT_MONTURE]: ['familier'],
};

/** Decode a dofusbook base64 "stuff" code into a fresh Card.
 *  classId and title aren't part of the dofusbook format → returned as null;
 *  caller is expected to fetch any unknown item ids before display. */
export function decodeCardCode(code: string): Card {
  const bytes = fromBase64(code);
  const c: Cursor = { i: 0 };
  const mapLen = decodeMapHeader(bytes, c);
  let level: number | null = null;
  let items: number[] = [];
  const numPicks: Record<number, number> = {};
  const baseStatsMap: Record<number, number> = {};
  let additionalPoints: number[] = [];

  for (let i = 0; i < mapLen; i++) {
    // Some dofusbook exports encode root + nested map keys as strings (fixstr) instead
    // of msgpack uints — we route every map key through decodeMapKey to accept both.
    const key = decodeMapKey(bytes, c);
    if (key === 0) {
      // t[0] BaseStats — a map of dofusbook carac index → starting stat value.
      const n = decodeMapHeader(bytes, c);
      for (let j = 0; j < n; j++) {
        const k = decodeMapKey(bytes, c);
        const v = decodeUint(bytes, c);
        baseStatsMap[k] = v;
      }
    } else if (key === 1) {
      // t[1] AdditionalPoints — flat array of raw points per stat (carac order).
      const n = decodeArrayHeader(bytes, c);
      additionalPoints = new Array(n);
      for (let j = 0; j < n; j++) additionalPoints[j] = decodeUint(bytes, c);
    } else if (key === 2) {
      level = decodeUint(bytes, c);
    } else if (key === 4) {
      const n = decodeMapHeader(bytes, c);
      for (let j = 0; j < n; j++) {
        const k = decodeMapKey(bytes, c);
        const v = decodeUint(bytes, c);
        numPicks[k] = v;
      }
    } else if (key === 5) {
      const n = decodeArrayHeader(bytes, c);
      items = new Array(n);
      for (let j = 0; j < n; j++) items[j] = decodeUint(bytes, c);
    } else {
      skipValue(bytes, c);
    }
  }

  const slots = {} as Record<SlotType, ItemRef | null>;
  for (const s of SLOT_ORDER) slots[s] = null;
  const dofus: (ItemRef | null)[] = Array.from({ length: DOFUS_COUNT }, () => null);

  let cursor = 0;
  for (let cat = 0; cat <= 9; cat++) {
    // numPicks omits cat when count===1, so missing => 1 (matching the encoder).
    const count = numPicks[cat] ?? 1;
    const target = CAT_TO_SLOTS[cat];
    for (let n = 0; n < count; n++) {
      const id = items[cursor++];
      if (typeof id !== 'number') continue;
      if (target === 'dofus') {
        if (n < DOFUS_COUNT) dofus[n] = { itemId: id };
      } else if (Array.isArray(target) && n < target.length) {
        slots[target[n]] = { itemId: id };
      }
    }
  }

  // Reconstruct per-stat investment + scroll flag from t[0] base + t[1] values.
  // - Scrolled is detected by the +100 bump above the level-derived baseline (Vitalité
  //   has a per-level base of 50 + 5*lvl; the other 5 have a base of 0). Anything ≥ 100
  //   over that is read as "scroll applied".
  // - Invested is read directly from t[1] — dofusbook stores stat values there (not
  //   raw points), so no statCost inversion is needed.
  const investments: Partial<Record<InvestableStat, StatInvestment>> = {};
  const vitaBaseline = 50 + 5 * (level ?? 1);
  for (let i = 0; i < ADDITIONAL_POINTS_ORDER.length; i++) {
    const stat = ADDITIONAL_POINTS_ORDER[i];
    const dbIdx = STAT_TO_DB_INDEX[stat];
    const baseline = stat === 'vitalite' ? vitaBaseline : 0;
    const baseValue = baseStatsMap[dbIdx] ?? baseline;
    const scrolled = baseValue - baseline >= 100;
    const invested = Math.max(0, additionalPoints[i] ?? 0);
    if (invested !== 0 || !scrolled) {
      // Persist the entry whenever it differs from the default {0, true} — that way
      // imported cards keep their scroll/invest choice instead of falling back to the
      // implicit "fully scrolled" default on missing keys.
      investments[stat] = { invested, scrolled };
    }
  }
  // Map index → stat lookup is only used to satisfy the unused-import linter when no
  // entries make it into `investments` (e.g. an all-default code).
  void DB_INDEX_TO_STAT;

  // Exo PA / PM / PO are encoded as +1 at fixed t[0] indices.
  const exo = {
    pa: (baseStatsMap[DB_EXO_PA] ?? 0) >= 1,
    pm: (baseStatsMap[DB_EXO_PM] ?? 0) >= 1,
    po: (baseStatsMap[DB_EXO_PO] ?? 0) >= 1,
  };
  const hasExo = exo.pa || exo.pm || exo.po;

  return {
    id: randomId(),
    classId: null,
    level,
    title: null,
    slots,
    dofus: dofus as Card['dofus'],
    investments: Object.keys(investments).length > 0 ? investments : undefined,
    exo: hasExo ? exo : undefined,
  };
}

export function buildDofusbookUrl(card: Card): string {
  return `${DOFUSBOOK_BASE_URL}?stuff=${encodeCardCode(card)}`;
}
