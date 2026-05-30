import { describe, it, expect } from 'vitest';
import { routeItemByType, TYPE_ID_DOFUS, TYPE_ID_TROPHEE } from '@/types/rooms';

describe('routeItemByType', () => {
  it('dofus → room 200 / dofus', () => {
    expect(routeItemByType({ typeId: TYPE_ID_DOFUS, levelRequired: 60 })).toEqual({ room: '200', npc: 'dofus' });
  });
  it('trophée at lvl 30 → bumped 50-99 / trophee', () => {
    expect(routeItemByType({ typeId: TYPE_ID_TROPHEE, levelRequired: 30 })).toEqual({ room: '50-99', npc: 'trophee' });
  });
  it('trophée at lvl 120 → 100-149 / trophee', () => {
    expect(routeItemByType({ typeId: TYPE_ID_TROPHEE, levelRequired: 120 })).toEqual({ room: '100-149', npc: 'trophee' });
  });
  it('familier (18) → hub / familier', () => {
    expect(routeItemByType({ typeId: 18, levelRequired: 60 })).toEqual({ room: 'hub', npc: 'familier' });
  });
  it('monture (97) → hub / monture', () => {
    expect(routeItemByType({ typeId: 97, levelRequired: 100 })).toEqual({ room: 'hub', npc: 'monture' });
  });
  it('ring (9) → room by level / anneau', () => {
    expect(routeItemByType({ typeId: 9, levelRequired: 26 })).toEqual({ room: '1-49', npc: 'anneau' });
  });
  it('coiffe (16) at lvl 60 → 50-99 / coiffe', () => {
    expect(routeItemByType({ typeId: 16, levelRequired: 60 })).toEqual({ room: '50-99', npc: 'coiffe' });
  });
  it('unknown typeId → null', () => {
    expect(routeItemByType({ typeId: 99, levelRequired: 50 })).toBeNull();
  });
});
