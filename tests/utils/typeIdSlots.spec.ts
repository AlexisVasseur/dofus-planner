import { describe, it, expect } from 'vitest';
import { TYPE_ID_TO_SLOT, RING_TYPE_ID, DOFUS_TYPE_ID, TROPHEE_TYPE_ID } from '@/utils/typeIdSlots';

describe('typeIdSlots', () => {
  it('maps equipment typeIds to their slot', () => {
    expect(TYPE_ID_TO_SLOT[16]).toBe('coiffe');
    expect(TYPE_ID_TO_SLOT[17]).toBe('cape');
    expect(TYPE_ID_TO_SLOT[1]).toBe('amulette');
    expect(TYPE_ID_TO_SLOT[10]).toBe('ceinture');
    expect(TYPE_ID_TO_SLOT[11]).toBe('bottes');
    expect(TYPE_ID_TO_SLOT[2]).toBe('arme');
    expect(TYPE_ID_TO_SLOT[82]).toBe('bouclier');
    expect(TYPE_ID_TO_SLOT[18]).toBe('familier');
  });
  it('excludes the ring typeId (handled separately)', () => {
    expect(TYPE_ID_TO_SLOT[RING_TYPE_ID]).toBeUndefined();
  });
  it('exposes ring / dofus / trophée typeId constants', () => {
    expect(RING_TYPE_ID).toBe(9);
    expect(DOFUS_TYPE_ID).toBe(23);
    expect(TROPHEE_TYPE_ID).toBe(151);
  });
});
