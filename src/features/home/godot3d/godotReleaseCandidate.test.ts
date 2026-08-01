import { describe, expect, it, vi } from 'vitest';
import {
  GODOT_RELEASE_REQUIRED_ASSETS,
  isGodotReleaseOperationsEnabled,
  isGodotRollbackDrillEnabled,
  loadGodotReleaseCandidateManifest,
  resolveGodotReleaseManifestUrl,
  validateGodotReleaseCandidateManifest,
} from './godotReleaseCandidate';

const releaseId = 'crystal-phase15-20260801';
const acceptanceDigest = 'a'.repeat(64);

function manifestFixture() {
  const assets = GODOT_RELEASE_REQUIRED_ASSETS.map((file, index) => ({
    file,
    bytes: 100 + index,
    sha256: String(index + 1).repeat(64),
  }));
  return {
    version: 'godot-release-candidate-v1',
    phase: 15,
    runtimeVersion: '4.7.1',
    releaseId,
    acceptanceDigest,
    buildSha: 'b'.repeat(40),
    generatedAt: '2026-08-01T12:00:00.000Z',
    assets,
    totalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
  };
}

describe('Godot Phase 15 release candidate', () => {
  it('validates an exact approved manifest', () => {
    const result = validateGodotReleaseCandidateManifest(manifestFixture(), {
      releaseId,
      acceptanceDigest,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.manifest?.assets.map(asset => asset.file)).toEqual(GODOT_RELEASE_REQUIRED_ASSETS);
  });

  it('rejects a manifest bound to another physical report', () => {
    const fixture = manifestFixture();
    fixture.acceptanceDigest = 'c'.repeat(64);
    const result = validateGodotReleaseCandidateManifest(fixture, {
      releaseId,
      acceptanceDigest,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Manifest acceptance digest does not match the physical report.',
    );
  });

  it('rejects missing, duplicated or malformed runtime assets', () => {
    const fixture = manifestFixture();
    fixture.assets = [
      fixture.assets[0],
      fixture.assets[0],
      { file: 'index.wasm', bytes: 0, sha256: 'invalid' },
    ] as typeof fixture.assets;
    fixture.totalBytes = 0;
    const result = validateGodotReleaseCandidateManifest(fixture, {
      releaseId,
      acceptanceDigest,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Manifest asset index.html is duplicated.');
    expect(result.errors).toContain('Manifest asset index.wasm has invalid byte size.');
    expect(result.errors).toContain('Manifest is missing index.js.');
    expect(result.errors).toContain('Manifest is missing index.pck.');
  });

  it('loads the manifest without browser cache', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => manifestFixture(),
    }));
    const manifest = await loadGodotReleaseCandidateManifest({
      url: '/godot/evolution-engine/release-manifest.json',
      expected: { releaseId, acceptanceDigest },
      fetcher,
    });
    expect(manifest.releaseId).toBe(releaseId);
    expect(fetcher).toHaveBeenCalledWith(
      '/godot/evolution-engine/release-manifest.json',
      expect.objectContaining({ cache: 'no-store', credentials: 'same-origin' }),
    );
  });

  it('fails closed when the manifest endpoint is unavailable', async () => {
    await expect(loadGodotReleaseCandidateManifest({
      url: '/godot/evolution-engine/release-manifest.json',
      expected: { releaseId, acceptanceDigest },
      fetcher: async () => ({ ok: false, status: 404, json: async () => ({}) }),
    })).rejects.toThrow('HTTP 404');
  });

  it('resolves a sibling manifest URL without preserving query strings', () => {
    expect(resolveGodotReleaseManifestUrl('/godot/evolution-engine/index.html?v=15')).toBe(
      '/godot/evolution-engine/release-manifest.json',
    );
  });

  it('keeps release operations and rollback drill explicitly query-gated', () => {
    expect(isGodotReleaseOperationsEnabled('?godotReleaseOps=1')).toBe(true);
    expect(isGodotReleaseOperationsEnabled('?godotReleaseOps=0')).toBe(false);
    expect(isGodotRollbackDrillEnabled('?godotRollbackDrill=on')).toBe(true);
    expect(isGodotRollbackDrillEnabled('?godotRollbackDrill=false')).toBe(false);
  });
});
