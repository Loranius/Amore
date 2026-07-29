import { describe, expect, it } from 'vitest';
import { isEvolutionRendererPreviewEnabled } from './featureFlag';

describe('Evolution renderer preview flag', () => {
  it('enables only the explicit engine=evolution value', () => {
    expect(isEvolutionRendererPreviewEnabled('?engine=evolution')).toBe(true);
    expect(isEvolutionRendererPreviewEnabled('?gfx=off&engine=evolution')).toBe(true);
    expect(isEvolutionRendererPreviewEnabled('engine=evolution')).toBe(true);

    expect(isEvolutionRendererPreviewEnabled('')).toBe(false);
    expect(isEvolutionRendererPreviewEnabled('?engine=legacy')).toBe(false);
    expect(isEvolutionRendererPreviewEnabled('?engine=Evolution')).toBe(false);
    expect(isEvolutionRendererPreviewEnabled('?evolution=true')).toBe(false);
  });
});
