import { describe, it, expect } from 'vitest';
import { parseDofusbookText } from '@/utils/dofusbookParse';
import fixture from '../fixtures/dofusbook-extract.txt?raw';
import fixture2 from '../fixtures/dofusbook-extract-2.txt?raw';

describe('parseDofusbookText', () => {
  // Fixture 1: header is "Feca 133 - Draegnerys" (class + level + " - " + name),
  // level also appears under "Niv. Stuff" as "Niveau" then "133" (two lines),
  // and a lone "Forgemagie" line sits between block 1 and "Boosts actifs".
  describe('fixture 1 (Feca, dash header, Forgemagie anchor)', () => {
    it('parses class, level, title', () => {
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
  });

  // Fixture 2: header is "Cra 12 PA Kanni" (NO " - ", the "12" is part of the build
  // name, NOT the level); level is "Niveau 100" (one line) under "Niv. Stuff"; there
  // is NO "Forgemagie" before the items; block 2 starts with an "air" noise line.
  describe('fixture 2 (Cra, dashless header, no Forgemagie, element noise)', () => {
    it('parses class from the header and level from Niv. Stuff (not the header number)', () => {
      const r = parseDofusbookText(fixture2);
      expect(r.classId).toBe('cra');
      expect(r.level).toBe(100); // NOT 12 — "12 PA Kanni" is the build name
      expect(r.title).toBe('12 PA Kanni');
    });

    it('extracts both blocks even without a Forgemagie anchor, dropping element noise', () => {
      const r = parseDofusbookText(fixture2);
      // block1 (before "Boosts actifs"): 5 items; block2 (after, minus "air"): 11 → 16
      expect(r.itemNames).toHaveLength(16);
      // block 1 items (would have been missed by the old Forgemagie-only anchor)
      expect(r.itemNames).toContain('Amublop Multicolore Royale');
      expect(r.itemNames).toContain('Blopture Multicolore Royale');
      expect(r.itemNames).toContain('Bloptes Multicolores Royales');
      // block 2 items
      expect(r.itemNames).toContain('Casque du Craqueleur Légendaire');
      expect(r.itemNames).toContain('Geish\'Arc');
      expect(r.itemNames).toContain('Dofus Cawotte');
      // the bare "air" element label is dropped
      expect(r.itemNames).not.toContain('air');
    });
  });

  describe('synthetic edge cases', () => {
    it('parses class/title after the Dofusbook tab and level from Niv. Stuff', () => {
      const text = [
        'Dofusbook',
        'Iop 200 - Mon Iop',
        '',
        'Niv. Stuff',
        'Niveau 200',
        '',
        'Boosts actifs (0)',
        'Résumé du stuff',
      ].join('\n');
      const r = parseDofusbookText(text);
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

    it('drops exact-duplicate item names across the two blocks', () => {
      const text = 'Coiffe X\nForgemagie\nBoosts actifs (0)\nCoiffe X\nCape Y\nRésumé du stuff';
      const r = parseDofusbookText(text);
      expect(r.itemNames).toEqual(['Coiffe X', 'Cape Y']);
    });
  });
});
