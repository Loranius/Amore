import { describe, expect, it } from 'vitest';
import {
  parseHomeArtifact,
  resolveHomeArtifact,
  withHomeArtifactSearch,
} from './homeArtifact';

describe('Home artifact selection', () => {
  it('accepts only published artifact IDs', () => {
    expect(parseHomeArtifact('crystal')).toBe('crystal');
    expect(parseHomeArtifact('tree')).toBe('tree');
    expect(parseHomeArtifact('reef')).toBe('reef');
    expect(parseHomeArtifact('coral')).toBeNull();
    expect(parseHomeArtifact(null)).toBeNull();
  });

  it('resolves explicit preview flags before query, storage and default', () => {
    expect(resolveHomeArtifact('?engine=tree-lab&artifact=crystal', 'reef')).toBe('tree');
    expect(resolveHomeArtifact('?engine=evolution&artifact=tree', 'reef')).toBe('crystal');
    expect(resolveHomeArtifact('?artifact=reef', 'tree')).toBe('reef');
    expect(resolveHomeArtifact('', 'tree')).toBe('tree');
    expect(resolveHomeArtifact('', 'unknown')).toBe('crystal');
  });

  it('publishes a shareable selection and clears obsolete lab flags', () => {
    const search = withHomeArtifactSearch(
      '?engine=tree-lab&treeSource=fixture&treeLod=low&debug=1',
      'reef',
    );
    const params = new URLSearchParams(search);

    expect(params.get('artifact')).toBe('reef');
    expect(params.get('debug')).toBe('1');
    expect(params.has('engine')).toBe(false);
    expect(params.has('treeSource')).toBe(false);
    expect(params.has('treeLod')).toBe(false);
  });
});
