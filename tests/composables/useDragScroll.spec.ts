import { describe, it, expect } from 'vitest';
import { computeScrollFromDrag } from '@/composables/useDragScroll';

describe('computeScrollFromDrag', () => {
  it('returns 0 when delta is 0', () => {
    expect(computeScrollFromDrag({ startScrollLeft: 0, deltaX: 0, ratio: 1 })).toBe(0);
  });

  it('scales delta by the track-to-content ratio', () => {
    expect(computeScrollFromDrag({ startScrollLeft: 0, deltaX: 50, ratio: 5 })).toBe(250);
  });

  it('adds delta to startScrollLeft', () => {
    expect(computeScrollFromDrag({ startScrollLeft: 100, deltaX: 30, ratio: 2 })).toBe(160);
  });

  it('never returns a negative scroll', () => {
    expect(computeScrollFromDrag({ startScrollLeft: 50, deltaX: -1000, ratio: 1 })).toBe(0);
  });
});
