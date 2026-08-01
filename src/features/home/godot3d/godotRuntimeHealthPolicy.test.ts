import { describe, expect, it } from 'vitest';
import type { GodotTelemetryMessage } from './godotBridgeProtocol';
import {
  GODOT_HEALTH_ACCEPTANCE_SAMPLES,
  GODOT_HEALTH_FALLBACK_STREAK,
  INITIAL_GODOT_RUNTIME_HEALTH,
  isGodotHealthAcceptanceReady,
  reduceGodotRuntimeHealth,
} from './godotRuntimeHealthPolicy';

function telemetry(overrides: Partial<GodotTelemetryMessage> = {}): GodotTelemetryMessage {
  return {
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
    restores: 0,
    ...overrides,
  };
}

describe('Godot runtime health policy', () => {
  it('warms up, becomes healthy and reaches the 30-sample acceptance gate', () => {
    let state = INITIAL_GODOT_RUNTIME_HEALTH;
    for (let index = 0; index < GODOT_HEALTH_ACCEPTANCE_SAMPLES; index += 1) {
      state = reduceGodotRuntimeHealth(state, telemetry());
    }

    expect(state.snapshot.status).toBe('healthy');
    expect(state.snapshot.sampleCount).toBe(GODOT_HEALTH_ACCEPTANCE_SAMPLES);
    expect(state.snapshot.averageFps).toBe(58);
    expect(isGodotHealthAcceptanceReady(state.snapshot)).toBe(true);
  });

  it('does not treat brief critical samples as a fatal runtime failure', () => {
    let state = INITIAL_GODOT_RUNTIME_HEALTH;
    for (let index = 0; index < 10; index += 1) {
      state = reduceGodotRuntimeHealth(state, telemetry());
    }
    for (let index = 0; index < GODOT_HEALTH_FALLBACK_STREAK - 1; index += 1) {
      state = reduceGodotRuntimeHealth(state, telemetry({ fps: 12, frame_ms: 84 }));
    }

    expect(state.snapshot.status).toBe('critical');
    expect(state.snapshot.shouldFallback).toBe(false);
  });

  it('requests fallback only after a sustained critical streak', () => {
    let state = INITIAL_GODOT_RUNTIME_HEALTH;
    for (let index = 0; index < 10; index += 1) {
      state = reduceGodotRuntimeHealth(state, telemetry());
    }
    for (let index = 0; index < GODOT_HEALTH_FALLBACK_STREAK; index += 1) {
      state = reduceGodotRuntimeHealth(state, telemetry({ fps: 10, frame_ms: 100 }));
    }

    expect(state.snapshot.shouldFallback).toBe(true);
    expect(state.snapshot.reason).toBe('low-fps');
    expect(isGodotHealthAcceptanceReady(state.snapshot)).toBe(false);
  });

  it('ignores suspended telemetry and recovers after stable samples', () => {
    let state = INITIAL_GODOT_RUNTIME_HEALTH;
    for (let index = 0; index < 12; index += 1) {
      state = reduceGodotRuntimeHealth(state, telemetry());
    }
    const beforeSuspend = state;
    state = reduceGodotRuntimeHealth(state, telemetry({ suspended: true, fps: 0, frame_ms: 0 }));
    expect(state).toBe(beforeSuspend);

    for (let index = 0; index < 3; index += 1) {
      state = reduceGodotRuntimeHealth(state, telemetry({ static_memory_mb: 420 }));
    }
    expect(state.snapshot.status).toBe('degraded');

    state = reduceGodotRuntimeHealth(state, telemetry());
    expect(state.snapshot.status).toBe('healthy');
    expect(state.snapshot.degradedStreak).toBe(0);
  });
});
