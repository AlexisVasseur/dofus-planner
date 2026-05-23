import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchItemsBySlot, fetchItem, fetchDofusOrTrophees, SLOT_TO_TYPE_IDS, DOFUS_TROPHEE_TYPE_IDS } from '@/data/dofusdb';

const MOCK_RESPONSE = {
  total: 2,
  data: [
    {
      id: 1234,
      name: { fr: 'Coiffe Bouftou' },
      level: 25,
      typeId: 16,
      img: 'https://api.dofusdb.fr/img/items/1234.png',
      // DofusDB returns numeric effect refs only — descriptions live in /effects.
      effects: [
        { from: 8, to: 10, effectId: 125, characteristic: 11 },  // Vitalité
        { from: 4, to: 5, effectId: 118, characteristic: 10 },   // Force
      ],
    },
    {
      id: 5678,
      name: { fr: 'Coiffe du Tofu' },
      level: 15,
      typeId: 16,
      img: 'https://api.dofusdb.fr/img/items/5678.png',
      effects: [],
    },
  ],
};

describe('dofusdb client', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 }),
    );
  });

  it('fetchItemsBySlot maps the response to a normalized Item shape', async () => {
    const items = await fetchItemsBySlot('coiffe', { search: '', limit: 50 });
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      id: 1234,
      name: 'Coiffe Bouftou',
      levelRequired: 25,
      iconUrl: 'https://api.dofusdb.fr/img/items/1234.png',
      // stats[] is the deprecated string list — empty now that we keep the numeric
      // effects array and render strings at display time via effect templates.
      stats: [],
      effects: [
        { from: 8, to: 10, effectId: 125, characteristic: 11 },
        { from: 4, to: 5, effectId: 118, characteristic: 10 },
      ],
      typeId: 16,
    });
  });

  it('fetchItemsBySlot includes the slot typeIds, limit, and level sort in the query', async () => {
    await fetchItemsBySlot('coiffe', { search: '', limit: 50 });
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    // URLSearchParams URL-encodes keys: typeId[$in][] -> typeId%5B%24in%5D%5B%5D
    const encodedKey = encodeURIComponent('typeId[$in][]');
    for (const tid of SLOT_TO_TYPE_IDS.coiffe) {
      expect(calledUrl).toContain(`${encodedKey}=${tid}`);
    }
    expect(calledUrl).toContain(`${encodeURIComponent('$limit')}=50`);
    expect(calledUrl).toContain(`${encodeURIComponent('$sort')}=-level`);
  });

  it('fetchItemsBySlot uses slug.fr[$search] with normalized (lowercased, no diacritics) input', async () => {
    await fetchItemsBySlot('coiffe', { search: 'Épée Bouftou', limit: 50 });
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    // URLSearchParams encodes the brackets and dollar; the value uses '+' for spaces.
    // The search term should be lowercased and stripped of diacritics: 'epee bouftou'
    expect(calledUrl).toContain('slug.fr%5B%24search%5D=epee+bouftou');
  });

  it('fetchDofusOrTrophees includes the dofus/trophée typeIds, limit, and level sort', async () => {
    await fetchDofusOrTrophees({ search: '', limit: 50 });
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    const encodedKey = encodeURIComponent('typeId[$in][]');
    for (const tid of DOFUS_TROPHEE_TYPE_IDS) {
      expect(calledUrl).toContain(`${encodedKey}=${tid}`);
    }
    expect(calledUrl).toContain(`${encodeURIComponent('$limit')}=50`);
    expect(calledUrl).toContain(`${encodeURIComponent('$sort')}=-level`);
  });

  it('fetchItem returns a single Item by id', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_RESPONSE.data[0]), { status: 200 }),
    );
    const item = await fetchItem(1234);
    expect(item.id).toBe(1234);
    expect(item.name).toBe('Coiffe Bouftou');
  });

  it('throws on non-2xx responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('boom', { status: 500 }));
    await expect(fetchItem(1234)).rejects.toThrow(/DofusDB/);
  });
});
