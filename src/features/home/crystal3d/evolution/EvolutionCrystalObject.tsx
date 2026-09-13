import { useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
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
import { applyCrystalRefraction, crystalBodyWidth } from '../render/refraction';
import { isCrystalTap, type CrystalPointerSample } from './tapGesture';

export interface EvolutionCrystalObjectProps {
  geometry: CrystalGeometryState;
  material: CrystalMaterialState;
  life: CrystalLifeState;
  /** Portal presentation may seat the crystals directly in a solid plinth. */
  substrateVisible?: boolean;
  /**
   * Карта оточення — ТІЛЬКИ ДІАГНОСТИКА (`?gfx=env`), ADR-0171.
   *
   * Матеріал артефакта вже публікує `envMapIntensity`, тобто місце для
   * карти в ньому було завжди — не було лише самої карти. Вона лишається
   * підозрюваною в білому фоні на пристрої власника
   * (`render/gfxProfile.ts`), тож приходить ззовні й за прапорцем, а не
   * будується тут.
   */
  envMap?: THREE.Texture | null;
  /**
   * Справжнє заломлення — ТІЛЬКИ ДІАГНОСТИКА (`?gfx=refraction`), ADR-0178.
   *
   * Приходить ззовні тією ж дорогою, що й карта оточення, і з тієї ж
   * причини: рушій публікує `transmission: 0`, і це лишається правдою.
   * Знімає заборону адаптер, і лише тоді, коли небо в сцені — інакше
   * `three` заллє його місце білим.
   */
  refraction?: boolean;
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
  envMap = null,
  refraction = false,
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
    () => createThreeCrystalInnerSparks(
      bundle,
      geometry,
      life,
      // Рівень нутра монарха — того тіла, у якому ці вогні й горять
      // (ADR-0175). Вогні адитивні, тож без цього вони світили б проти
      // темнішого каменю сильніше, ніж світили проти світлого.
      material.bodies.find((body) => body.bodyId === 'crystal:mother')?.shader.interiorLevel ?? 1,
    ),
    [bundle, geometry, life, material],
  );

  /*
   * Карта чіпляється ПІСЛЯ побудови батчів, а не всередині неї: батч
   * будується з опублікованого стану матеріалу (Volume VI), а карта
   * оточення — властивість перегляду, не стану. Тримати її в стані
   * означало б, що діагностичний прапорець міняє те, що хешується.
   */
  useEffect(() => {
    for (const material of bundle.materials.values()) {
      material.envMap = envMap;
      material.needsUpdate = true;
    }
  }, [bundle, envMap]);

  /*
   * Ширина монарха у власних одиницях меша: `three` множить товщину на
   * масштаб моделі, тож число мусить бути там, де стоїть геометрія, а не
   * там, де її видно.
   */
  const bodyWidth = useMemo(() => crystalBodyWidth(geometry), [geometry]);
  useEffect(() => {
    applyCrystalRefraction(bundle.materials.values(), { on: refraction, width: bodyWidth });
  }, [bundle, refraction, bodyWidth]);

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
