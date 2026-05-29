import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Item } from '@/data/dofusdb';

const searchItemsByName = vi.fn();
const ensureItems = vi.fn().mockResolvedValue(undefined);
vi.mock('@/data/dofusdb', async (orig) => {
  const actual = await orig<typeof import('@/data/dofusdb')>();
  return { ...actual, searchItemsByName: (...a: unknown[]) => searchItemsByName(...a) };
});
vi.mock('@/composables/useItemCatalog', async (orig) => {
  const actual = await orig<typeof import('@/composables/useItemCatalog')>();
  return { ...actual, ensureItems: (...a: unknown[]) => ensureItems(...a) };
});

import { resolveDofusbookItems } from '@/composables/useDofusbookImport';

function item(id: number, name: string, typeId: number, level = 100): Item {
  return { id, name, levelRequired: level, iconUrl: '', stats: [], typeId };
}

beforeEach(() => {
  searchItemsByName.mockReset();
  ensureItems.mockClear();
});

describe('resolveDofusbookItems', () => {
  it('prefers an exact-name match over decoys', async () => {
    searchItemsByName.mockResolvedValue([
      item(20130, 'Réplique du Dofus Pourpre', 15),
      item(694, 'Dofus Pourpre', 23),
    ]);
    const r = await resolveDofusbookItems(['Dofus Pourpre']);
    expect(r.dofus[0]).toEqual({ itemId: 694 });
    expect(r.unresolved).toEqual([]);
  });

  it('places equipment in its homologous slot', async () => {
    searchItemsByName.mockImplementation((name: string) => {
      if (name === 'Coiffe') return Promise.resolve([item(1, 'Coiffe', 16)]);
      if (name === 'Cape') return Promise.resolve([item(2, 'Cape', 17)]);
      return Promise.resolve([]);
    });
    const r = await resolveDofusbookItems(['Coiffe', 'Cape']);
    expect(r.slots.coiffe).toEqual({ itemId: 1 });
    expect(r.slots.cape).toEqual({ itemId: 2 });
    expect(r.resolvedCount).toBe(2);
  });

  it('routes two rings to anneau1 then anneau2; a third is unresolved', async () => {
    searchItemsByName.mockImplementation((name: string) =>
      Promise.resolve([item(name === 'A' ? 10 : name === 'B' ? 11 : 12, name, 9)]));
    const r = await resolveDofusbookItems(['A', 'B', 'C']);
    expect(r.slots.anneau1).toEqual({ itemId: 10 });
    expect(r.slots.anneau2).toEqual({ itemId: 11 });
    expect(r.unresolved).toEqual(['C']);
  });

  it('fills dofus[] with dofus + trophée and overflows to unresolved', async () => {
    searchItemsByName.mockImplementation((name: string) => {
      const idx = Number(name);
      const typeId = idx % 2 === 0 ? 23 : 151;
      return Promise.resolve([item(100 + idx, name, typeId)]);
    });
    const names = ['0', '1', '2', '3', '4', '5', '6'];
    const r = await resolveDofusbookItems(names);
    expect(r.dofus.filter(Boolean)).toHaveLength(6);
    expect(r.unresolved).toEqual(['6']);
  });

  it('marks a name with no result as unresolved', async () => {
    searchItemsByName.mockResolvedValue([]);
    const r = await resolveDofusbookItems(['Nope']);
    expect(r.unresolved).toEqual(['Nope']);
    expect(r.resolvedCount).toBe(0);
  });

  it('marks an item whose typeId maps to no slot as unresolved', async () => {
    searchItemsByName.mockResolvedValue([item(5, 'Cosmétique', 99)]);
    const r = await resolveDofusbookItems(['Cosmétique']);
    expect(r.unresolved).toEqual(['Cosmétique']);
  });

  it('warms the catalog cache with the resolved ids', async () => {
    searchItemsByName.mockResolvedValue([item(1, 'Coiffe', 16)]);
    await resolveDofusbookItems(['Coiffe']);
    expect(ensureItems).toHaveBeenCalledWith([1]);
  });

  it('treats a search failure for one name as unresolved without aborting', async () => {
    searchItemsByName.mockImplementation((name: string) =>
      name === 'Boom' ? Promise.reject(new Error('net')) : Promise.resolve([item(1, 'Coiffe', 16)]));
    const r = await resolveDofusbookItems(['Boom', 'Coiffe']);
    expect(r.unresolved).toEqual(['Boom']);
    expect(r.slots.coiffe).toEqual({ itemId: 1 });
  });
});
