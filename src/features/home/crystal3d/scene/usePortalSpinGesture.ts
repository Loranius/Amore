import { useEffect, useRef, type MutableRefObject } from 'react';
import { useThree } from '@react-three/fiber';
import {
  PORTAL_SPIN_REST,
  portalSpinDrag,
  portalSpinGrab,
  portalSpinRelease,
  type PortalSpinState,
} from './portalSpin';

// ============================================================
// Жест повороту на полотні порталу (ADR-0211).
// ------------------------------------------------------------
// Лише переклад пікселів у кути й подій у виклики `portalSpin.ts`. Уся
// поведінка — плавність, інерція, доводка — там, чиста й перевірена
// тестом; тут лишилось те, що без браузера не існує.
//
// Чутливість та сама, що була в `OrbitControls`: повний оберт — свайп на
// висоту полотна, помножений на швидкість (`portalOrbitRotateSpeed`).
// Власник скаржився на ривки, а не на швидкість, тож її не чіпаємо.
// ============================================================

/** Межі підйому — ті самі, що тримав `OrbitControls` (полярний кут 0.22π…0.5π). */
export const PORTAL_SPIN_ELEVATION_MIN = 0;
export const PORTAL_SPIN_ELEVATION_MAX = Math.sin(Math.PI * (0.5 - 0.22));

export interface PortalSpinHandle {
  state: PortalSpinState;
  /** Поточний сумарний підйом камери — його пише риг щокадру. */
  elevation: number;
}

export function usePortalSpinGesture(
  enabled: boolean,
  rotateSpeed: number,
  reduceMotion: boolean,
): MutableRefObject<PortalSpinHandle> {
  const element = useThree((state) => state.gl.domElement);
  const handle = useRef<PortalSpinHandle>({ state: PORTAL_SPIN_REST, elevation: 0 });
  const speed = useRef(rotateSpeed);
  speed.current = rotateSpeed;
  const reduced = useRef(reduceMotion);
  reduced.current = reduceMotion;

  useEffect(() => {
    if (!enabled) return;
    const active = new Map<number, { x: number; y: number }>();
    // Другий палець — це щипок, і він належить масштабу. Поворот
    // відпускається БЕЗ інерції й чекає, поки піднімуться всі пальці:
    // інакше розведення пальців кидало б острів убік.
    let blocked = false;
    const seconds = (event: PointerEvent) => event.timeStamp / 1000;

    const down = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      active.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (active.size > 1) {
        blocked = true;
        handle.current.state = portalSpinRelease(handle.current.state, seconds(event), { cancelled: true });
        return;
      }
      if (blocked) return;
      try { element.setPointerCapture(event.pointerId); } catch { /* вказівник уже зник — жест і так скінчився */ }
      handle.current.state = portalSpinGrab(handle.current.state, seconds(event));
    };

    const move = (event: PointerEvent) => {
      const last = active.get(event.pointerId);
      if (last === undefined) return;
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      active.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (blocked || active.size !== 1) return;
      const height = Math.max(1, element.clientHeight);
      const perPixel = (2 * Math.PI * speed.current) / height;
      const current = handle.current;
      // Підйом у частках синуса, як у директора: d(sin φ) = cos φ · dφ.
      const pitchCos = Math.sqrt(Math.max(0, 1 - current.elevation * current.elevation));
      const shown = current.state.elevation;
      const bounds: [number, number] = [
        shown - (current.elevation - PORTAL_SPIN_ELEVATION_MIN),
        shown + (PORTAL_SPIN_ELEVATION_MAX - current.elevation),
      ];
      current.state = portalSpinDrag(
        current.state,
        seconds(event),
        // Праворуч — азимут камери зменшується: так само, як в `OrbitControls`.
        -dx * perPixel,
        dy * perPixel * pitchCos,
        bounds,
      );
    };

    const up = (event: PointerEvent) => {
      if (!active.delete(event.pointerId)) return;
      if (active.size === 0) {
        if (!blocked) {
          handle.current.state = portalSpinRelease(handle.current.state, seconds(event), {
            cancelled: event.type === 'pointercancel',
            reduceMotion: reduced.current,
          });
        }
        blocked = false;
      }
    };

    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    return () => {
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
      handle.current.state = portalSpinRelease(handle.current.state, performance.now() / 1000, { cancelled: true });
    };
  }, [enabled, element]);

  return handle;
}
