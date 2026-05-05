import { describe, it, expect } from 'vitest';
import { getClassAssets } from '@/composables/useClassAssets';

const HEX6 = /^#[0-9a-f]{6}$/i;

describe('useClassAssets', () => {
  it('returns hero/thumbnail URLs and 6-digit hex colors for a known class', () => {
    const assets = getClassAssets('iop');
    expect(assets).not.toBeNull();
    if (!assets) return;
    expect(typeof assets.hero).toBe('string');
    expect(assets.hero.length).toBeGreaterThan(0);
    expect(typeof assets.thumbnail).toBe('string');
    expect(assets.thumbnail.length).toBeGreaterThan(0);
    expect(assets.colors.dominant).toMatch(HEX6);
    expect(assets.colors.soft).toMatch(HEX6);
    expect(assets.colors.accent).toMatch(HEX6);
  });

  it('returns null for null id or unknown class', () => {
    expect(getClassAssets(null)).toBeNull();
    expect(getClassAssets('not-a-real-class')).toBeNull();
  });
});
