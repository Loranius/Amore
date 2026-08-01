import { describe, expect, it } from 'vitest';
import type {
  GodotLifecycleMessage,
  GodotStateMessage,
  GodotTelemetryMessage,
} from './godotBridgeProtocol';
import {
  INITIAL_GODOT_INTERACTIONS,
  createGodotDeviceAcceptanceReport,
  incrementGodotInteraction,
  isGodotDiagnosticsEnabled,
} from './godotDeviceAcceptance';
import {
  GODOT_HEALTH_ACCEPTANCE_SAMPLES,
  INITIAL_GODOT_RUNTIME_HEALTH,
  reduceGodotRuntimeHealth,
} from './godotRuntimeHealthPolicy';

const state: GodotStateMessage = {
  type: 'amore:godot:state',
  version: '4.7.1',
  source: 'portal',
  species: 'crystal',
  seed: 582013,
  instructions: 6,
  rendered_instructions: 5,
  input_events: 3,
  history: 9,
  motion: 'full',
  quality: 'balanced',
  render_scale: 0.86,
  life_hz: 30,
  phase: 13,
  signature: '0123456789abcdef',
};

const telemetry: GodotTelemetryMessage = {
  type: 'amore:godot:telemetry',
  version: '4.7.1',
  quality: 'balanced',
  fps: 58,
  frame_ms: 17.2,
  draw_calls: 12,
  primitives: 900,
  static_memory_mb: 96,
  render_scale: 0.86,
  life_hz: 30,
  suspended: false,
  restores: 1,
};

const lifecycle: GodotLifecycleMessage = {
  type: 'amore:godot:lifecycle',
  state: 'pageshow',
  sequence: 2,
  suspended: false,
  restores: 1,
};

const physicalEnvironment = {
  userAgent: 'Pixel 8 Pro test',
  platform: 'Linux armv8l',
  viewportWidth: 412,
  viewportHeight: 915,
  screenWidth: 412,
  screenHeight: 915,
  devicePixelRatio: 2.625,
  automated: false,
};

describe('Godot device acceptance report', () => {
  it('recognizes the explicit diagnostics query only', () => {
    expect(isGodotDiagnosticsEnabled('?godotDiagnostics=1')).toBe(true);
    expect(isGodotDiagnosticsEnabled('?godotDiagnostics=true')).toBe(true);
    expect(isGodotDiagnosticsEnabled('?godotDiagnostics=off')).toBe(false);
    expect(isGodotDiagnosticsEnabled('')).toBe(false);
  });

  it('increments interaction evidence without mutating prior state', () => {
    const next = incrementGodotInteraction(INITIAL_GODOT_INTERACTIONS, 'orbit');
    expect(next.orbit).toBe(1);
    expect(INITIAL_GODOT_INTERACTIONS.orbit).toBe(0);
  });

  it('physically passes only after healthy telemetry, orbit and background restore evidence', () => {
    let health = INITIAL_GODOT_RUNTIME_HEALTH;
    for (let index = 0; index < GODOT_HEALTH_ACCEPTANCE_SAMPLES; index += 1) {
      health = reduceGodotRuntimeHealth(health, telemetry);
    }
    const interactions = incrementGodotInteraction(INITIAL_GODOT_INTERACTIONS, 'orbit');
    const report = createGodotDeviceAcceptanceReport({
      generatedAt: '2026-08-01T10:00:00.000Z',
      environment: physicalEnvironment,
      state,
      health: health.snapshot,
      telemetry,
      lifecycle,
      interactions,
    });

    expect(report.assessment).toBe('physical');
    expect(report.workflowPassed).toBe(true);
    expect(report.passed).toBe(true);
    expect(report.criteria.backgroundRestoreCompleted).toBe(true);
    expect(report.runtime.phase).toBe(13);
    expect(JSON.stringify(report)).not.toContain('memory:first-place');
    expect(report.privacy).toContain('No Artifact DNA');
  });

  it('allows automation to prove the workflow without claiming hardware health', () => {
    const criticalTelemetry: GodotTelemetryMessage = {
      ...telemetry,
      fps: 8,
      frame_ms: 125,
      quality: 'economy',
      render_scale: 0.72,
      life_hz: 20,
    };
    let health = INITIAL_GODOT_RUNTIME_HEALTH;
    for (let index = 0; index < GODOT_HEALTH_ACCEPTANCE_SAMPLES; index += 1) {
      health = reduceGodotRuntimeHealth(health, criticalTelemetry);
    }
    const interactions = incrementGodotInteraction(INITIAL_GODOT_INTERACTIONS, 'orbit');
    const report = createGodotDeviceAcceptanceReport({
      environment: { ...physicalEnvironment, automated: true },
      state,
      health: health.snapshot,
      telemetry: criticalTelemetry,
      lifecycle,
      interactions,
    });

    expect(report.assessment).toBe('automation');
    expect(report.workflowPassed).toBe(true);
    expect(report.criteria.healthyRuntime).toBe(false);
    expect(report.passed).toBe(false);
  });

  it('does not pass a healthy session without orbit evidence', () => {
    let health = INITIAL_GODOT_RUNTIME_HEALTH;
    for (let index = 0; index < GODOT_HEALTH_ACCEPTANCE_SAMPLES; index += 1) {
      health = reduceGodotRuntimeHealth(health, telemetry);
    }
    const report = createGodotDeviceAcceptanceReport({
      environment: physicalEnvironment,
      state,
      health: health.snapshot,
      telemetry,
      lifecycle,
      interactions: INITIAL_GODOT_INTERACTIONS,
    });

    expect(report.workflowPassed).toBe(false);
    expect(report.passed).toBe(false);
    expect(report.criteria.orbitCompleted).toBe(false);
  });
});
