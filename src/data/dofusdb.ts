import type { SlotType } from '@/types/slots';

export interface Item {
  id: number;
  name: string;
  levelRequired: number;
  iconUrl: string;
  stats: string[];
}

// DofusDB exposes itemTypes; these are the typeId values we expect to filter by.
// Verify against the live API before going to prod (Task 18).
export const SLOT_TO_TYPE_IDS: Record<SlotType, number[]> = {
  coiffe: [16],
  cape: [17],
  amulette: [1],
  anneau1: [10],
  anneau2: [10],
  ceinture: [11],
  bottes: [9],
  arme: [2, 3, 4, 5, 6, 7, 8, 19, 20, 22, 24, 25, 83, 84, 85, 86],
  familier: [18, 121],
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
  if (opts.search.trim().length > 0) {
    params.append('name.fr[$search]', opts.search.trim());
  }
  const url = `${BASE_URL}/items?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DofusDB request failed: ${res.status}`);
  const json = (await res.json()) as { data?: RawItem[] };
  const data = json.data ?? [];
  return data.map(mapItem);
}

export async function fetchItem(id: number): Promise<Item> {
  const res = await fetch(`${BASE_URL}/items/${id}`);
  if (!res.ok) throw new Error(`DofusDB request failed: ${res.status}`);
  const raw = (await res.json()) as RawItem;
  return mapItem(raw);
}
