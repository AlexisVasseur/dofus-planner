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

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/items?');
    expect(url).toContain('slug.fr%5B%24search%5D=dofus%20pourpre');
    expect(url).toContain('%24limit=5');
  });

  it('omits the search param when the name is blank', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    await searchItemsByName('   ');
    expect(fetchMock.mock.calls[0][0] as string).not.toContain('slug.fr');
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(searchItemsByName('x')).rejects.toThrow(/503/);
  });
});
