import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDofusbookText } from '@/utils/dofusbookParse';

const fixture = readFileSync(
  resolve(__dirname, '../fixtures/dofusbook-extract.txt'),
  'utf8',
);

describe('parseDofusbookText', () => {
  it('parses class, level, title from the header', () => {
    const r = parseDofusbookText(fixture);
    expect(r.classId).toBe('feca');
    expect(r.level).toBe(133);
    expect(r.title).toBe('Draegnerys');
  });

  it('extracts the 16 equipped item names in order', () => {
    const r = parseDofusbookText(fixture);
    expect(r.itemNames).toHaveLength(16);
    expect(r.itemNames[0]).toBe('Torque Ancestral');
    expect(r.itemNames).toContain('Bouclier des Brigandins');
    expect(r.itemNames).toContain('Bulbisou');
    expect(r.itemNames).toContain('Dofus Pourpre');
    expect(r.itemNames[r.itemNames.length - 1]).toBe('Ravageur Terre');
  });

  it('parses a simple header', () => {
    const r = parseDofusbookText('Iop 200 - Mon Iop\n\nForgemagie\nRésumé du stuff');
    expect(r.classId).toBe('iop');
    expect(r.level).toBe(200);
    expect(r.title).toBe('Mon Iop');
  });

  it('returns nulls + empty names for unrecognized text', () => {
    const r = parseDofusbookText('just some random text\nwith no anchors');
    expect(r.classId).toBeNull();
    expect(r.level).toBeNull();
    expect(r.title).toBeNull();
    expect(r.itemNames).toEqual([]);
  });

  it('drops exact-duplicate item names', () => {
    const text = 'Coiffe X\nForgemagie\nBoosts actifs (0)\nCoiffe X\nCape Y\nRésumé du stuff';
    const r = parseDofusbookText(text);
    expect(r.itemNames).toEqual(['Coiffe X', 'Cape Y']);
  });
});
