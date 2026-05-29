import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchItemSets } from '@/data/dofusdb';

const RAW_RESPONSE = {
  total: 1,
  data: [
    {
      id: 1,
      name: { fr: 'Panoplie du Bouftou', en: 'Gobball Set' },
      level: 20,
      items: [
        { id: 2411, typeId: 16, level: 20 },
        { id: 2412, typeId: 17, level: 18 },
        { id: 2413, typeId: 9, level: 15 },
      ],
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchItemSets', () => {
  it('maps the raw /item-sets response to ItemSetSummary[]', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => RAW_RESPONSE,
    });
    vi.stubGlobal('fetch', fetchMock);

    const sets = await fetchItemSets({ search: 'bouftou', limit: 20 });

    expect(sets).toEqual([
      { id: 1, name: 'Panoplie du Bouftou', level: 20, itemIds: [2411, 2412, 2413] },
    ]);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/item-sets?');
    expect(url).toContain('slug.fr%5B%24search%5D=bouftou');
    expect(url).toContain('%24limit=20');
  });

  it('falls back to name.en then empty string, and tolerates missing items', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 2, name: { en: 'Only EN' } }] }),
    }));
    const sets = await fetchItemSets({ search: '', limit: 20 });
    expect(sets).toEqual([{ id: 2, name: 'Only EN', level: 0, itemIds: [] }]);
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchItemSets({ search: 'x', limit: 20 })).rejects.toThrow(/500/);
  });
});
