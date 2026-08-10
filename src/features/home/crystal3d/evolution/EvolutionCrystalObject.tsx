import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { CRYSTAL_SUBSTRATE_BODY_ID, type CrystalGeometryState } from '@/engine/geometry';
import type { CrystalLifeState } from '@/engine/life';
import { sampleCrystalLife } from '@/engine/life';
import type { CrystalMaterialState } from '@/engine/material';
import {
  applyCrystalLifeFrame,
  createThreeCrystalInnerSparks,
  createThreeCrystalRenderBundle,
  setThreeCrystalBodyVisible,
} from '@/engine/renderer/three';
import { isCrystalTap, type CrystalPointerSample } from './tapGesture';

export interface EvolutionCrystalObjectProps {
  geometry: CrystalGeometryState;
  material: CrystalMaterialState;
  life: CrystalLifeState;
  /** Portal presentation may seat the crystals directly in a solid plinth. */
  substrateVisible?: boolean;
}

/**
 * Thin R3F shell around the renderer-independent Phase 1-6 states.
 * It owns no evolution, species, composition, geometry or material decisions.
 */
export function EvolutionCrystalObject({
  geometry,
  material,
  life,
  substrateVisible = true,
}: EvolutionCrystalObjectProps) {
  const pulseUntil = useRef(0);
  const pointerDown = useRef<CrystalPointerSample | null>(null);
  const bundle = useMemo(
    () => {
      const next = createThreeCrystalRenderBundle(geometry, material);
      setThreeCrystalBodyVisible(next, CRYSTAL_SUBSTRATE_BODY_ID, substrateVisible);
      return next;
    },
    [geometry, material, substrateVisible],
  );

  // The lights inside the monarch (brief §9). Built beside the bundle rather
  // than inside it because they depend on the life state, which changes on its
  // own — quality tier, reduced motion — and rebuilding every batch to move a
  // point cloud would throw away the geometry upload with it.
  const sparks = useMemo(
    () => createThreeCrystalInnerSparks(bundle, geometry, life),
    [bundle, geometry, life],
  );

  useEffect(() => () => bundle.dispose(), [bundle]);
  // The factory parents the cloud itself, next to the crystal batches and
  // under the same fit transform, so there is no placement here to get wrong.
  useEffect(() => () => sparks?.dispose(), [sparks]);

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
    // Uniform only, per the brief's §8/§11: no allocation and no geometry
    // rebuild in the frame loop. Each spark's own speed rides in an attribute,
    // so one clock drives a cloud that never blinks in unison — and under
    // reduced motion every speed is zero, which freezes the twinkle without
    // this having to know anything about it.
    if (sparks !== null) sparks.phaseUniform.value = state.clock.elapsedTime;
  });

  return (
    <primitive
      object={bundle.group}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        pointerDown.current = {
          x: event.nativeEvent.clientX,
          y: event.nativeEvent.clientY,
          at: performance.now(),
        };
      }}
      // Пульс тепер на тапі, а не на будь-якому натисканні. Раніше він
      // спрацьовував і коли палець просто крутив орбіту — кристал
      // відповідав на рух, якого до нього не адресували.
      //
      // Тут же буде моушн-зум: тап лишається жестом, який щось означає, і
      // жест уже відділено від перетягування (`tapGesture.ts`).
      onClick={(event: ThreeEvent<MouseEvent>) => {
        const start = pointerDown.current;
        pointerDown.current = null;
        const released = {
          x: event.nativeEvent.clientX,
          y: event.nativeEvent.clientY,
          at: performance.now(),
        };
        if (!isCrystalTap(start, released)) return;
        pulseUntil.current = performance.now() + life.interactionPulseDuration * 1000;
      }}
    />
  );
}
