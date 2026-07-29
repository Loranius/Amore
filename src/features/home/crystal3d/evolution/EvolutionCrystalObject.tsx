import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import type { CrystalGeometryState } from '@/engine/geometry';
import type { CrystalLifeState } from '@/engine/life';
import { sampleCrystalLife } from '@/engine/life';
import type { CrystalMaterialState } from '@/engine/material';
import {
  applyCrystalLifeFrame,
  createThreeCrystalRenderBundle,
} from '@/engine/renderer/three';

export interface EvolutionCrystalObjectProps {
  geometry: CrystalGeometryState;
  material: CrystalMaterialState;
  life: CrystalLifeState;
  onOpen?: () => void;
}

/**
 * Thin R3F shell around the renderer-independent Phase 1-6 states.
 * It owns no evolution, species, composition, geometry or material decisions.
 */
export function EvolutionCrystalObject({ geometry, material, life, onOpen }: EvolutionCrystalObjectProps) {
  const pulseUntil = useRef(0);
  const bundle = useMemo(
    () => createThreeCrystalRenderBundle(geometry, material),
    [geometry, material],
  );

  useEffect(() => () => bundle.dispose(), [bundle]);

  useFrame((state) => {
    const now = performance.now();
    const remaining = Math.max(0, pulseUntil.current - now);
    const durationMs = Math.max(1, life.interactionPulseDuration * 1000);
    const pulse = remaining / durationMs;
    applyCrystalLifeFrame(bundle, sampleCrystalLife({
      life,
      elapsedSeconds: state.clock.elapsedTime,
      interactionPulse: pulse,
    }));
  });

  return (
    <primitive
      object={bundle.group}
      onPointerDown={() => {
        pulseUntil.current = performance.now() + life.interactionPulseDuration * 1000;
      }}
      onClick={onOpen}
    >
      {life.sparkleCount > 0 && (
        <Sparkles
          count={life.sparkleCount}
          scale={3.2}
          size={1.8}
          speed={life.sparkleSpeed}
          color="#ffe9f2"
          position={[0, 0.2, 0]}
        />
      )}
    </primitive>
  );
}
