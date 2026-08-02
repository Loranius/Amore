import { describe, expect, it } from 'vitest';
import { EVOLUTION_ADAPTER_SOURCES } from '../../evolution/adapters';
import { PORTAL_MODULE_COUNT } from './growthModel';

describe('portal module count', () => {
  it('matches the real list of adapter sources', () => {
    // The species measures a year by how many portal modules it touched, so
    // the denominator has to be how many modules exist. It is a plain number
    // in growthModel because Volume II must not reach into Volume I's adapter
    // layer — this test is the seam that keeps the two from drifting.
    expect(PORTAL_MODULE_COUNT).toBe(EVOLUTION_ADAPTER_SOURCES.length);
  });
});
