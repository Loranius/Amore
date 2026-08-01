import { describe, expect, it } from 'vitest';
import {
  isValidSha256Digest,
  parseGodotKillSwitch,
  parseGodotReleaseStage,
  resolveGodotReleaseControl,
} from './godotReleaseControl';

const digest = 'a'.repeat(64);

function resolve(overrides: Partial<Parameters<typeof resolveGodotReleaseControl>[0]> = {}) {
  return resolveGodotReleaseControl({
    mode: 'production',
    requestedRolloutPercent: 100,
    stage: 'canary-5',
    releaseId: 'crystal-phase14-20260801',
    acceptanceDigest: digest,
    killSwitch: false,
    ...overrides,
  });
}

describe('Godot Phase 14 release control', () => {
  it('defaults unknown release stages to blocked', () => {
    expect(parseGodotReleaseStage(undefined)).toBe('blocked');
    expect(parseGodotReleaseStage('experimental')).toBe('blocked');
    expect(parseGodotReleaseStage('25')).toBe('ramp-25');
  });

  it('parses the emergency kill switch conservatively', () => {
    expect(parseGodotKillSwitch('on')).toBe(true);
    expect(parseGodotKillSwitch('kill')).toBe(true);
    expect(parseGodotKillSwitch('off')).toBe(false);
  });

  it('rejects missing or malformed physical report digests', () => {
    expect(isValidSha256Digest(digest)).toBe(true);
    expect(isValidSha256Digest('abc')).toBe(false);
    expect(resolve({ acceptanceDigest: '' }).reason).toBe('missing-physical-digest');
  });

  it('caps a canary release at five percent', () => {
    const result = resolve({ requestedRolloutPercent: 100, stage: 'canary-5' });
    expect(result.gateOpen).toBe(true);
    expect(result.effectiveRolloutPercent).toBe(5);
  });

  it('allows only the declared progressive stage', () => {
    expect(resolve({ stage: 'ramp-25' }).effectiveRolloutPercent).toBe(25);
    expect(resolve({ stage: 'ramp-50' }).effectiveRolloutPercent).toBe(50);
    expect(resolve({ stage: 'released-100' }).effectiveRolloutPercent).toBe(100);
  });

  it('blocks production immediately when the kill switch is active', () => {
    const result = resolve({ killSwitch: true, stage: 'released-100' });
    expect(result.gateOpen).toBe(false);
    expect(result.effectiveRolloutPercent).toBe(0);
    expect(result.reason).toBe('kill-switch');
  });

  it('keeps preview independent from physical production approval', () => {
    const result = resolve({
      mode: 'preview',
      acceptanceDigest: '',
      releaseId: '',
      requestedRolloutPercent: 100,
    });
    expect(result.gateOpen).toBe(true);
    expect(result.reason).toBe('preview-mode');
  });

  it('keeps production blocked by default', () => {
    const result = resolve({ stage: 'blocked' });
    expect(result.gateOpen).toBe(false);
    expect(result.effectiveRolloutPercent).toBe(0);
  });
});
