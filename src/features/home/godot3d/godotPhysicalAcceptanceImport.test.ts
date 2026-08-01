import { describe, expect, it } from 'vitest';
import {
  createGodotReleaseEnvSnippet,
  sha256Hex,
  validateGodotPhysicalAcceptanceReport,
} from './godotPhysicalAcceptanceImport';

function physicalPassFixture() {
  return {
    version: 'godot-device-acceptance-v2',
    generatedAt: '2026-08-01T11:00:00.000Z',
    assessment: 'physical',
    environment: { automated: false },
    runtime: {
      phase: 13,
      species: 'crystal',
      signature: '0123456789abcdef',
      motion: 'full',
    },
    health: {
      status: 'healthy',
      sampleCount: 30,
      shouldFallback: false,
      restores: 1,
    },
    criteria: {
      runtimeAccepted: true,
      stableThirtySecondWindow: true,
      healthyRuntime: true,
      orbitCompleted: true,
      backgroundRestoreCompleted: true,
      deterministicSignaturePresent: true,
      motionProfileCaptured: true,
    },
    workflowPassed: true,
    passed: true,
    privacy: 'No Artifact DNA, Evolution Events, Supabase data or relationship content included.',
  };
}

describe('Godot physical acceptance import', () => {
  it('accepts a complete physical PASS report', () => {
    const result = validateGodotPhysicalAcceptanceReport(physicalPassFixture());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects automation reports even when their workflow passes', () => {
    const fixture = physicalPassFixture();
    fixture.assessment = 'automation';
    fixture.environment.automated = true;
    const result = validateGodotPhysicalAcceptanceReport(fixture);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Report assessment must be physical.');
  });

  it('rejects unhealthy or incomplete physical sessions', () => {
    const fixture = physicalPassFixture();
    fixture.health.status = 'degraded';
    fixture.health.sampleCount = 18;
    fixture.criteria.orbitCompleted = false;
    const result = validateGodotPhysicalAcceptanceReport(fixture);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Runtime health must be healthy.');
    expect(result.errors).toContain('At least 30 telemetry samples are required.');
    expect(result.errors).toContain('Acceptance criterion failed: orbitCompleted.');
  });

  it('produces a stable SHA-256 digest for the exact report bytes', async () => {
    expect(await sha256Hex('amore-phase-14')).toBe(
      '9c46aff64ee35a41919bcb78190c842356a64130583900c40380ea3f0186812b',
    );
  });

  it('generates a canary-first production environment snippet', () => {
    const snippet = createGodotReleaseEnvSnippet({
      releaseId: 'crystal-phase14-20260801',
      acceptanceDigest: 'a'.repeat(64),
    });
    expect(snippet).toContain('VITE_EVOLUTION_GODOT_RELEASE_STAGE=canary-5');
    expect(snippet).toContain('VITE_EVOLUTION_GODOT_ROLLOUT=5');
    expect(snippet).toContain(`VITE_EVOLUTION_GODOT_ACCEPTANCE_SHA256=${'a'.repeat(64)}`);
  });
});
