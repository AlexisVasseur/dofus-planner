import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchItemsBySlot, fetchItem, SLOT_TO_TYPE_IDS } from '@/data/dofusdb';

const MOCK_RESPONSE = {
  total: 2,
  data: [
    {
      id: 1234,
      name: { fr: 'Coiffe Bouftou' },
      level: 25,
      typeId: 16,
      img: 'https://api.dofusdb.fr/img/items/1234.png',
      effects: [
        { description: { fr: '+10 Vitalité' } },
        { description: { fr: '+5 Force' } },
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
      stats: ['+10 Vitalité', '+5 Force'],
    });
  });

  it('fetchItemsBySlot includes the slot typeIds in the query', async () => {
    await fetchItemsBySlot('coiffe', { search: '', limit: 50 });
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    // URLSearchParams URL-encodes keys: typeId[$in][] -> typeId%5B%24in%5D%5B%5D
    const encodedKey = encodeURIComponent('typeId[$in][]');
    for (const tid of SLOT_TO_TYPE_IDS.coiffe) {
      expect(calledUrl).toContain(`${encodedKey}=${tid}`);
    }
    expect(calledUrl).toContain(`${encodeURIComponent('$limit')}=50`);
  });

  it('fetchItemsBySlot URL-encodes the search term', async () => {
    await fetchItemsBySlot('coiffe', { search: 'épée bouftou', limit: 50 });
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    // URLSearchParams emits '+' for spaces (not '%20'), and encodes the key.
    const encodedKey = encodeURIComponent('name.fr[$search]');
    const encodedValue = encodeURIComponent('épée bouftou').replace(/%20/g, '+');
    expect(calledUrl).toContain(`${encodedKey}=${encodedValue}`);
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
