// ============================================================
// Хроніка в сцені (ADR-0238): що кожна з трьох сцен робить однаково.
// ------------------------------------------------------------
//   * публікує вид і знімок, з якого він виріс, — шторці головної;
//   * відкриває хроніку дотиком (не перетягуванням) по об'єкту;
//   * віддає дату, на яку малювати об'єкт (повзунок часу);
//   * переводить опорну точку запису в координати сцени для камери.
// ============================================================
import { useEffect, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { CrystalV2Snapshot } from '@/engine/species/crystalV2/model';
import { isCrystalTap, type CrystalPointerSample } from '@/features/home/crystal3d/evolution/tapGesture';
import type { PortalInspect } from '@/features/home/crystal3d/scene/PortalStage';
import type { HomeArtifact } from '@/features/home/homeArtifact';
import type { ChronicleAnchor, V3 } from './anchors';
import { openChronicle, publishChronicleSubject, useChronicle } from './chronicleStore';

/** Куди вид ставить об'єкт у сцені: з одиниць моделі й з часток острова. */
export interface ChroniclePlacement {
  object: (p: V3) => V3;
  island: (p: V3) => V3;
}

/** Легкий зум відкриття (власник: «легким зумом»). */
const OPEN_ZOOM = 0.82;

export function useChronicleScene(
  species: HomeArtifact,
  snapshot: CrystalV2Snapshot | undefined,
  /** Хроніка живе лише на головній: у модулі об'єкт — тло. */
  home: boolean,
  placement: ChroniclePlacement | null,
) {
  const chronicle = useChronicle();

  useEffect(() => {
    if (home && snapshot) publishChronicleSubject({ species, snapshot });
  }, [home, snapshot, species]);

  const down = useRef<CrystalPointerSample | null>(null);
  const tap = useMemo(() => ({
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      down.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY, at: performance.now() };
    },
    onClick: (event: ThreeEvent<MouseEvent>) => {
      const start = down.current;
      down.current = null;
      if (!home) return;
      if (!isCrystalTap(start, { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY, at: performance.now() })) return;
      openChronicle();
    },
  }), [home]);

  const open = home && chronicle.open;
  const inspect = useMemo<PortalInspect | null>(() => {
    if (!open) return null;
    const anchor: ChronicleAnchor | undefined = chronicle.focus?.anchor;
    if (!anchor || !placement) return { azimuth: chronicle.azimuth, point: null, zoom: OPEN_ZOOM };
    const point = anchor.space === 'island' ? placement.island(anchor.point) : placement.object(anchor.point);
    return { azimuth: chronicle.azimuth, point, zoom: anchor.zoom };
  }, [open, chronicle.azimuth, chronicle.focus, placement]);

  /** Для сцени, що вже сама розрізняє дотик і поворот (вулкан). */
  const onTap = useMemo(() => (home ? openChronicle : undefined), [home]);

  return { tap, onTap, inspect, asOf: open ? chronicle.asOf : null };
}
