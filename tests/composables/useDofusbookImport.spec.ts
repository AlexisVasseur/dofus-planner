import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Item } from '@/data/dofusdb';

const fetchItemsByNames = vi.fn();
const ensureItems = vi.fn().mockResolvedValue(undefined);
vi.mock('@/data/dofusdb', async (orig) => {
  const actual = await orig<typeof import('@/data/dofusdb')>();
  return { ...actual, fetchItemsByNames: (...a: unknown[]) => fetchItemsByNames(...a) };
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
  fetchItemsByNames.mockReset();
  ensureItems.mockClear();
});

describe('resolveDofusbookItems', () => {
  it('places equipment in its homologous slot', async () => {
    fetchItemsByNames.mockResolvedValue([item(1, 'Coiffe', 16), item(2, 'Cape', 17)]);
    const r = await resolveDofusbookItems(['Coiffe', 'Cape']);
    expect(r.slots.coiffe).toEqual({ itemId: 1 });
    expect(r.slots.cape).toEqual({ itemId: 2 });
    expect(r.resolvedCount).toBe(2);
  });

  it('routes two rings to anneau1 then anneau2; a third is unresolved', async () => {
    fetchItemsByNames.mockResolvedValue([item(10, 'A', 9), item(11, 'B', 9), item(12, 'C', 9)]);
    const r = await resolveDofusbookItems(['A', 'B', 'C']);
    expect(r.slots.anneau1).toEqual({ itemId: 10 });
    expect(r.slots.anneau2).toEqual({ itemId: 11 });
    expect(r.unresolved).toEqual(['C']);
  });

  it('fills dofus[] with dofus + trophée and overflows to unresolved', async () => {
    const names = ['0', '1', '2', '3', '4', '5', '6'];
    fetchItemsByNames.mockResolvedValue(
      names.map((n) => item(100 + Number(n), n, Number(n) % 2 === 0 ? 23 : 151)),
    );
    const r = await resolveDofusbookItems(names);
    expect(r.dofus.filter(Boolean)).toHaveLength(6);
    expect(r.unresolved).toEqual(['6']);
  });

  it('marks a name with no matching item as unresolved', async () => {
    fetchItemsByNames.mockResolvedValue([]); // pool has nothing for "Nope"
    const r = await resolveDofusbookItems(['Nope']);
    expect(r.unresolved).toEqual(['Nope']);
    expect(r.resolvedCount).toBe(0);
  });

  it('marks an item whose typeId maps to no slot as unresolved', async () => {
    fetchItemsByNames.mockResolvedValue([item(5, 'Cosmétique', 99)]);
    const r = await resolveDofusbookItems(['Cosmétique']);
    expect(r.unresolved).toEqual(['Cosmétique']);
  });

  it('matches by exact normalized name — gear with a different name is never picked', async () => {
    // The batch slug[$in] query only returns exact-slug matches, so a "Voyageur"
    // (prysmaradite, type 151) is never confused with "Ceinture des Voyageurs".
    fetchItemsByNames.mockResolvedValue([item(2, 'Voyageur', 151)]);
    const r = await resolveDofusbookItems(['Voyageur']);
    expect(r.dofus[0]).toEqual({ itemId: 2 });
    expect(r.slots.ceinture).toBeNull();
    expect(r.unresolved).toEqual([]);
  });

  it('picks an equippable item when a name maps to several (e.g. a mount under two typeIds)', async () => {
    // "Dragodinde Ebène et Ivoire" exists under legacy typeId 97 and current 331 —
    // both familier-slot typeIds; either is fine, the first usable wins.
    fetchItemsByNames.mockResolvedValue([
      item(97, 'Dragodinde Ebène et Ivoire', 97),
      item(331, 'Dragodinde Ebène et Ivoire', 331),
    ]);
    const r = await resolveDofusbookItems(['Dragodinde Ebène et Ivoire']);
    expect(r.slots.familier).toEqual({ itemId: 97 });
    expect(r.unresolved).toEqual([]);
  });

  it('warms the catalog cache with the resolved ids', async () => {
    fetchItemsByNames.mockResolvedValue([item(1, 'Coiffe', 16)]);
    await resolveDofusbookItems(['Coiffe']);
    expect(ensureItems).toHaveBeenCalledWith([1]);
  });

  it('treats a batch fetch failure as everything unresolved (no crash)', async () => {
    fetchItemsByNames.mockRejectedValue(new Error('net'));
    const r = await resolveDofusbookItems(['Coiffe', 'Cape']);
    expect(r.resolvedCount).toBe(0);
    expect(r.unresolved).toEqual(['Coiffe', 'Cape']);
  });
});
