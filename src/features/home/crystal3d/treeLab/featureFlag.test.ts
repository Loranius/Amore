import { describe, expect, it } from 'vitest';
import { isTreeLabPreviewEnabled, resolveTreeLabLod } from './featureFlag';

describe('Tree Lab preview flags', () => {
  it('requires an explicit tree-lab renderer value', () => {
    expect(isTreeLabPreviewEnabled('')).toBe(false);
    expect(isTreeLabPreviewEnabled('?engine=evolution')).toBe(false);
    expect(isTreeLabPreviewEnabled('?engine=tree-lab')).toBe(true);
  });

  it('accepts only published LOD values', () => {
    expect(resolveTreeLabLod('?treeLod=high')).toBe('high');
    expect(resolveTreeLabLod('?treeLod=medium')).toBe('medium');
    expect(resolveTreeLabLod('?treeLod=low')).toBe('low');
    expect(resolveTreeLabLod('?treeLod=ultra')).toBe('medium');
    expect(resolveTreeLabLod('', 'low')).toBe('low');
  });
});
