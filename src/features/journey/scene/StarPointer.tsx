import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import type { Star3D } from '../constellation3d';
import { pickStar, type ScreenStar } from '../starPicking';
import { haloSize } from './JourneyConstellation';

// ============================================================
// Що зробив палець.
// ============================================================
// Слухає саме полотно, а не сцену, і з двох причин.
//
// Перша: обертання й дотик живуть на одному елементі, тож їх треба розрізняти
// **рухом**, а не типом події. Палець, який проїхав більше кількох пікселів,
// крутив небо — і зірка під ним не має відкриватись. Порогом тут `DRAG_SLOP`.
//
// Друга: довге натискання по порожньому небу — це прихований вхід у додавання
// події (власник просив саме прихований, без кнопки). Розпізнати його можна
// лише за часом утримання, тобто в тому самому місці, де вже лежить дотик.
//
// Проєкція рахується ЛИШЕ на дотик, не щокадру: сорок зірок помножити на
// матрицю — робота ні за що, коли пара просто дивиться.
// ============================================================

/** Скільки пікселів палець може проїхати, і це все ще дотик, а не перетягування. */
const DRAG_SLOP = 12;
/** Скільки тримати порожнє небо, щоб відкрити додавання, мс. */
const LONG_PRESS = 620;

export interface StarPointerProps {
  stars: readonly Star3D[];
  /** Зірка обрана. `null` — палець не влучив ні в кого. */
  onPick: (id: number | null) => void;
  /** Довге натискання по порожньому небу. */
  onLongPress?: () => void;
  /** Поки камера веде себе сама, дотик нічого не обирає. */
  disabled?: boolean;
}

export function StarPointer({ stars, onPick, onLongPress, disabled = false }: StarPointerProps) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const element = useThree((state) => state.gl.domElement);

  const down = useRef<{ x: number; y: number; at: number } | null>(null);
  const dragged = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scratch = useRef(new Vector3());

  useEffect(() => {
    const projected = (): ScreenStar[] => {
      const point = scratch.current;
      const fov = camera instanceof PerspectiveCamera ? camera.fov : 52;
      const pixelsPerRadian = size.height / (2 * Math.tan((fov * Math.PI) / 360));
      return stars.map((star) => {
        point.set(star.x, star.y, star.z);
        const distance = point.distanceTo(camera.position);
        point.project(camera);
        return {
          id: star.id,
          x: (point.x * 0.5 + 0.5) * size.width,
          y: (-point.y * 0.5 + 0.5) * size.height,
          // Ціль дотику міряється по СЯЙВУ, а не по силуету: пара сприймає
          // ореол як частину зірки й цілиться саме в нього.
          radius: distance > 0.001 ? (haloSize(star.radius) / distance) * pixelsPerRadian * 0.5 : 0,
          // `project` дає z > 1 для того, що позаду камери.
          visible: point.z < 1,
        };
      });
    };

    const clearLongPress = () => {
      if (longPressTimer.current === null) return;
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (disabled) return;
      down.current = { x: event.clientX, y: event.clientY, at: performance.now() };
      dragged.current = false;
      if (!onLongPress) return;
      clearLongPress();
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        if (dragged.current || down.current === null) return;
        const rect = element.getBoundingClientRect();
        const hit = pickStar(projected(), {
          x: down.current.x - rect.left,
          y: down.current.y - rect.top,
        });
        // Тільки порожнє небо: довге натискання по зірці парі нічого не обіцяло.
        if (hit === null) {
          down.current = null;
          onLongPress();
        }
      }, LONG_PRESS);
    };

    const onPointerMove = (event: PointerEvent) => {
      const start = down.current;
      if (start === null) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > DRAG_SLOP) {
        dragged.current = true;
        clearLongPress();
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      clearLongPress();
      const start = down.current;
      down.current = null;
      if (disabled || start === null || dragged.current) return;
      const rect = element.getBoundingClientRect();
      onPick(pickStar(projected(), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }));
    };

    const onPointerCancel = () => {
      clearLongPress();
      down.current = null;
    };

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerCancel);
    return () => {
      clearLongPress();
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [camera, disabled, element, onLongPress, onPick, size.height, size.width, stars]);

  return null;
}
