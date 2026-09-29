import { describe, expect, it } from 'vitest';
import { ERUPTION_COOL_S, ERUPTION_FLOW_S, ERUPTION_HOLD_S, ERUPTION_REST, eruptionAt } from './eruption';

// ============================================================
// ADR-0235: лава тече лише після дотику до вулкана (власник).
// ============================================================

describe('виверження на дотик', () => {
  it('у спокої рік немає: до першого дотику фронт у жерлі', () => {
    expect(eruptionAt(null)).toEqual(ERUPTION_REST);
  });

  it('лава біжить від жерла до підніжжя, не повертаючись назад', () => {
    let prev = -1;
    for (let t = 0; t <= ERUPTION_FLOW_S; t += 0.2) {
      const { front } = eruptionAt(t);
      expect(front).toBeGreaterThanOrEqual(prev);
      prev = front;
    }
    expect(eruptionAt(ERUPTION_FLOW_S + 0.01).front).toBe(1);
  });

  it('стоїть повна, потім холоне й зникає', () => {
    expect(eruptionAt(ERUPTION_FLOW_S + ERUPTION_HOLD_S / 2)).toEqual({ front: 1, cool: 0 });
    const cooling = eruptionAt(ERUPTION_FLOW_S + ERUPTION_HOLD_S + ERUPTION_COOL_S / 2);
    expect(cooling.front).toBe(1);
    expect(cooling.cool).toBeCloseTo(0.5, 6);
    expect(eruptionAt(ERUPTION_FLOW_S + ERUPTION_HOLD_S + ERUPTION_COOL_S + 0.1)).toEqual(ERUPTION_REST);
  });

  it('без руху — одразу повна й одразу зникає', () => {
    expect(eruptionAt(0.1, true)).toEqual({ front: 1, cool: 0 });
    expect(eruptionAt(ERUPTION_FLOW_S + ERUPTION_HOLD_S + 0.1, true)).toEqual(ERUPTION_REST);
  });
});
