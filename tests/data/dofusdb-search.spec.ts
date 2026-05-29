import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchItemsByNames } from '@/data/dofusdb';

afterEach(() => vi.unstubAllGlobals());

describe('fetchItemsByNames', () => {
  it('batches all names into one slug.fr[$in] request and maps results', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 694, name: { fr: 'Dofus Pourpre' }, typeId: 23, level: 110 },
          { id: 2, name: { fr: 'Voyageur' }, typeId: 151, level: 100 },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const items = await fetchItemsByNames(['Dofus Pourpre', 'Voyageur']);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: 694, name: 'Dofus Pourpre', typeId: 23, levelRequired: 110 });

    expect(fetchMock).toHaveBeenCalledTimes(1); // one batched request
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/items');
    expect(url.searchParams.getAll('slug.fr[$in][]')).toEqual(['dofus pourpre', 'voyageur']);
  });

  it('normalizes (lowercase + strips diacritics) and de-duplicates the slugs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    await fetchItemsByNames(['Dragodinde Ebène et Ivoire', 'Dragodinde Ébène et Ivoire']);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    // both inputs normalize to the same slug → queried once
    expect(url.searchParams.getAll('slug.fr[$in][]')).toEqual(['dragodinde ebene et ivoire']);
  });

  it('returns [] without a request when there are no usable names', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchItemsByNames([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchItemsByNames(['x'])).rejects.toThrow(/503/);
  });
});
