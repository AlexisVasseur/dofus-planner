import { describe, it, expect } from 'vitest';
import { maxRollOnly, renderEffectMax, effectMaxRoll } from '@/utils/stats';
import type { RawEffect, EffectTemplate } from '@/data/dofusdb';

describe('maxRollOnly', () => {
  it('collapses a leading "A à B" range to just B', () => {
    expect(maxRollOnly('10 à 15 Vitalité')).toBe('15 Vitalité');
    expect(maxRollOnly('5 à 10 Force')).toBe('10 Force');
    expect(maxRollOnly('1 à 1 Sagesse')).toBe('1 Sagesse');
  });

  it('handles negative ranges (max = upper bound, closer to zero)', () => {
    expect(maxRollOnly('-5 à -1 Soins')).toBe('-1 Soins');
    expect(maxRollOnly('-10 à -3 Dommages')).toBe('-3 Dommages');
  });

  it('leaves non-range stats untouched', () => {
    expect(maxRollOnly('5 PA')).toBe('5 PA');
    expect(maxRollOnly('1 PM')).toBe('1 PM');
    expect(maxRollOnly('+5 Tacle')).toBe('+5 Tacle');
    expect(maxRollOnly('-3 Esquive PA')).toBe('-3 Esquive PA');
  });

  it('preserves everything after the range (stat name with spaces, signs, etc.)', () => {
    expect(maxRollOnly('10 à 15 Dommages Feu')).toBe('15 Dommages Feu');
    expect(maxRollOnly('1 à 3 Résistance Eau %')).toBe('3 Résistance Eau %');
  });

  it('only collapses the leading range, not later numbers', () => {
    expect(maxRollOnly('10 à 15 Vitalité (Lv 50)')).toBe('15 Vitalité (Lv 50)');
  });

  it('returns the original string when no range is present', () => {
    expect(maxRollOnly('Texte arbitraire')).toBe('Texte arbitraire');
    expect(maxRollOnly('')).toBe('');
  });
});

describe('effectMaxRoll', () => {
  const e = (from: number, to: number): RawEffect => ({ from, to, effectId: 0 });

  it('returns `to` for normal ranges (positive)', () => {
    expect(effectMaxRoll(e(41, 45))).toBe(45);
    expect(effectMaxRoll(e(1, 1))).toBe(1);
  });

  it('returns `to` for normal ranges (negative — closer to zero wins)', () => {
    expect(effectMaxRoll(e(-5, -1))).toBe(-1);
  });

  it('returns `from` when DofusDB stores the fixed-value shape (to === 0, from !== 0)', () => {
    expect(effectMaxRoll(e(1, 0))).toBe(1);    // +1 PA
    expect(effectMaxRoll(e(-1, 0))).toBe(-1);  // -1 PO
    expect(effectMaxRoll(e(-10, 0))).toBe(-10); // -10 resistance
  });

  it('returns 0 when both ends are zero', () => {
    expect(effectMaxRoll(e(0, 0))).toBe(0);
  });

  it('respects `to` when it is a valid value and from is 0', () => {
    expect(effectMaxRoll(e(0, 5))).toBe(5);
  });
});

describe('renderEffectMax', () => {
  const effect = (from: number, to: number, effectId = 125): RawEffect => ({ from, to, effectId });
  const tpl = (descFr: string, id = 125): EffectTemplate => ({ id, descFr });

  it('renders a positive range to "{to} {statName}"', () => {
    expect(renderEffectMax(effect(41, 45), tpl('#1{{~1~2 à }}#2 Vitalité'))).toBe('45 Vitalité');
  });

  it('renders a negative range to "{to} {statName}" (closer to zero)', () => {
    expect(renderEffectMax(effect(-5, -1), tpl('#1{{~1~2 à }}#2 Soins'))).toBe('-1 Soins');
  });

  it('renders a single-value effect (from == to)', () => {
    expect(renderEffectMax(effect(10, 10), tpl('#1{{~1~2 à }}#2 Sagesse'))).toBe('10 Sagesse');
  });

  it('handles templates with no #2 (flat flavor text)', () => {
    expect(renderEffectMax(effect(0, 0), tpl('Permet de monter sur la zone'))).toBe('Permet de monter sur la zone');
  });

  it('returns empty when the template is null or empty', () => {
    expect(renderEffectMax(effect(1, 5), null)).toBe('');
    expect(renderEffectMax(effect(1, 5), tpl(''))).toBe('');
  });

  it('preserves units / suffixes after the stat name', () => {
    expect(renderEffectMax(effect(1, 3), tpl('#1{{~1~2 à }}#2 Résistance Eau %'))).toBe('3 Résistance Eau %');
  });

  it('handles {{~ps}} plural marker — adds "s" when |to| > 1', () => {
    const t = tpl('Rend #1{{~1~2 à }}#2 point{{~ps}}{{~zs}} d\'énergie');
    expect(renderEffectMax(effect(1, 5), t)).toBe('Rend 5 points d\'énergie');
    expect(renderEffectMax(effect(1, 1), t)).toBe('Rend 1 point d\'énergie');
  });

  it('handles templates with only #1 (single-value, no range)', () => {
    expect(renderEffectMax(effect(3, 3), tpl('Repousse de #1 case{{~ps}}'))).toBe('Repousse de 3 cases');
    expect(renderEffectMax(effect(1, 1), tpl('Repousse de #1 case{{~ps}}'))).toBe('Repousse de 1 case');
  });

  it('strips any unknown {{...}} directive (defensive)', () => {
    expect(renderEffectMax(effect(1, 5), tpl('#1{{~1~2 à }}#2 PA {{unknown}}'))).toBe('5 PA');
  });

  it('treats negative-only values as singular when |to| ≤ 1', () => {
    expect(renderEffectMax(effect(-3, -1), tpl('#1{{~1~2 à }}#2 case{{~ps}}'))).toBe('-1 case');
  });

  it('handles the DofusDB fixed-value encoding (to=0, from=value) — e.g. +1 PA', () => {
    expect(renderEffectMax(effect(1, 0), tpl('#1{{~1~2 à }}#2 PA'))).toBe('1 PA');
    expect(renderEffectMax(effect(-1, 0), tpl('#1{{~1~2 à }}#2 PO'))).toBe('-1 PO');
  });
});
