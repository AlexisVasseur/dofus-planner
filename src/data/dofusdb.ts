import type { SlotType } from '@/types/slots';

export interface Item {
  id: number;
  name: string;
  levelRequired: number;
  iconUrl: string;
  stats: string[];
  typeId: number;
}

function normalizeSearch(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
}

// DofusDB exposes itemTypes; these are the typeId values we expect to filter by.
// Verify against the live API before going to prod (Task 18).
// The familier slot holds: 18 Familier · 121 Montilier (petsmount) · 97 Dragodinde ·
// 196 Muldo · 207 Volkorne. They are all equipped in the same slot in-game, so the
// picker shows them all when picking a familier.
export const SLOT_TO_TYPE_IDS: Record<SlotType, number[]> = {
  coiffe: [16],
  cape: [17],
  amulette: [1],
  anneau1: [9],
  anneau2: [9],
  ceinture: [10],
  bottes: [11],
  arme: [2, 3, 4, 5, 6, 7, 8, 19, 20, 21, 22],
  bouclier: [82],
  familier: [18, 121, 97, 196, 207],
};

const BASE_URL = (import.meta.env.VITE_DOFUSDB_BASE_URL as string | undefined) ?? 'https://api.dofusdb.fr';

interface RawItem {
  id: number;
  name: { fr?: string; en?: string };
  level: number;
  img?: string;
  imgUrl?: string;
  typeId: number;
  effects?: Array<{ description?: { fr?: string; en?: string } }>;
}

function mapItem(raw: RawItem): Item {
  const stats = (raw.effects ?? [])
    .map((e) => e.description?.fr ?? '')
    .filter((s) => s.length > 0);
  return {
    id: raw.id,
    name: raw.name?.fr ?? raw.name?.en ?? `Item ${raw.id}`,
    levelRequired: raw.level ?? 0,
    iconUrl: raw.img ?? raw.imgUrl ?? '',
    stats,
    typeId: raw.typeId ?? 0,
  };
}

export interface FetchItemsOpts {
  search: string;
  limit: number;
}

export async function fetchItemsBySlot(slot: SlotType, opts: FetchItemsOpts): Promise<Item[]> {
  const params = new URLSearchParams();
  for (const tid of SLOT_TO_TYPE_IDS[slot]) {
    params.append('typeId[$in][]', String(tid));
  }
  params.append('$limit', String(opts.limit));
  params.append('$sort', 'level');
  const normalizedSearch = normalizeSearch(opts.search);
  if (normalizedSearch.length > 0) {
    params.append('slug.fr[$search]', normalizedSearch);
  }
  const url = `${BASE_URL}/items?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DofusDB request failed: ${res.status}`);
  const json = (await res.json()) as { data?: RawItem[] };
  const data = json.data ?? [];
  return data.map(mapItem);
}

// DofusDB itemTypes: 23 = Dofus, 151 = Trophée. Verified live against /item-types.
export const DOFUS_TROPHEE_TYPE_IDS: number[] = [23, 151];

export async function fetchDofusOrTrophees(opts: FetchItemsOpts): Promise<Item[]> {
  const params = new URLSearchParams();
  for (const tid of DOFUS_TROPHEE_TYPE_IDS) {
    params.append('typeId[$in][]', String(tid));
  }
  params.append('$limit', String(opts.limit));
  params.append('$sort', 'level');
  const normalizedSearch = normalizeSearch(opts.search);
  if (normalizedSearch.length > 0) {
    params.append('slug.fr[$search]', normalizedSearch);
  }
  const url = `${BASE_URL}/items?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DofusDB request failed: ${res.status}`);
  const json = (await res.json()) as { data?: RawItem[] };
  return (json.data ?? []).map(mapItem);
}

export async function fetchItem(id: number): Promise<Item> {
  const res = await fetch(`${BASE_URL}/items/${id}`);
  if (!res.ok) throw new Error(`DofusDB request failed: ${res.status}`);
  const raw = (await res.json()) as RawItem;
  return mapItem(raw);
}
