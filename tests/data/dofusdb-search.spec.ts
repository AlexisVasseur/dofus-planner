import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchItemsByName } from '@/data/dofusdb';

afterEach(() => vi.unstubAllGlobals());

describe('searchItemsByName', () => {
  it('queries /items by normalized name and maps results', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 694, name: { fr: 'Dofus Pourpre' }, typeId: 23, level: 110 }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const items = await searchItemsByName('Dofus Pourpre');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 694, name: 'Dofus Pourpre', typeId: 23, levelRequired: 110 });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/items');
    expect(url.searchParams.get('slug.fr[$search]')).toBe('dofus pourpre');
    expect(url.searchParams.get('$limit')).toBe('5');
    expect(url.searchParams.get('$sort')).toBe('-level');
  });

  it('omits the search param when the name is blank', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    await searchItemsByName('   ');
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.has('slug.fr[$search]')).toBe(false);
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(searchItemsByName('x')).rejects.toThrow(/503/);
  });
});
