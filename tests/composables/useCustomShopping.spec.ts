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

import { parseCustomLines, resolveCustomNames } from '@/composables/useCustomShopping';

function item(id: number, name: string, typeId: number, level = 30): Item {
  return { id, name, levelRequired: level, iconUrl: '', stats: [], typeId };
}

beforeEach(() => { fetchItemsByNames.mockReset(); ensureItems.mockClear(); });

describe('parseCustomLines', () => {
  it('parses a plain one-name-per-line list', () => {
    expect(parseCustomLines("Anneau d'Allister\nMasque de Klime")).toEqual([
      "Anneau d'Allister", 'Masque de Klime',
    ]);
  });

  it('parses CSV "nom;type;niveau" keeping only the name, dropping the header', () => {
    const csv = 'nom;type;niveau\nAlliance de Silimelle;Anneau;26\nDragolyre;Amulette;32';
    expect(parseCustomLines(csv)).toEqual(['Alliance de Silimelle', 'Dragolyre']);
  });

  it('drops empty lines and de-dups by normalized name', () => {
    expect(parseCustomLines('Dragolyre\n\n  dragolyre  \nMasque de Klime')).toEqual([
      'Dragolyre', 'Masque de Klime',
    ]);
  });
});

describe('resolveCustomNames', () => {
  it('maps found names to itemId, missing to null, in one batched fetch', async () => {
    fetchItemsByNames.mockResolvedValue([item(1, 'Dragolyre', 1)]); // amulette typeId 1
    const r = await resolveCustomNames(['Dragolyre', 'Inexistant']);
    expect(r).toEqual([{ name: 'Dragolyre', itemId: 1 }, { name: 'Inexistant', itemId: null }]);
    expect(fetchItemsByNames).toHaveBeenCalledTimes(1);
    expect(ensureItems).toHaveBeenCalledWith([1]);
  });

  it('keeps only routable matches (a found but unroutable typeId → null)', async () => {
    fetchItemsByNames.mockResolvedValue([item(5, 'Potion', 99)]); // typeId 99 routes nowhere
    const r = await resolveCustomNames(['Potion']);
    expect(r).toEqual([{ name: 'Potion', itemId: null }]);
    expect(ensureItems).not.toHaveBeenCalled();
  });

  it('prefers a routable item when a name maps to several', async () => {
    fetchItemsByNames.mockResolvedValue([item(8, 'Dragolyre', 99), item(9, 'Dragolyre', 1)]);
    const r = await resolveCustomNames(['Dragolyre']);
    expect(r).toEqual([{ name: 'Dragolyre', itemId: 9 }]);
  });

  it('returns [] for no names without fetching', async () => {
    const r = await resolveCustomNames([]);
    expect(r).toEqual([]);
    expect(fetchItemsByNames).not.toHaveBeenCalled();
  });
});
