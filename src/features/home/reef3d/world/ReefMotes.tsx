// ============================================================
// Завись і бульбашки — те, від чого вода стає товщею.
// ------------------------------------------------------------
// Під водою між оком і предметом ЗАВЖДИ щось є: пил, планктон, дрібні
// уламки. Саме вони й видають середовище: у повітрі порошинку видно
// лише в промені, у воді — скрізь.
//
// Дві системи точок, два виклики малювання на всю сцену:
//   ЗАВІСЬ повільно дрейфує вниз і вбік, як осідає планктон;
//   БУЛЬБАШКИ йдуть угору з-під рифа, розгойдуючись.
//
// Обидві — `Points` без текстури: круглу крапку малює сам `gl_PointSize`
// з `sizeAttenuation`, тобто далекі частки дрібніші за ближні. Текстура
// тут не дала б нічого, крім зайвого мегабайта.
// ============================================================
import { useLayoutEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, type Points } from 'three';
import { useFrame } from '@react-three/fiber';
import type { ReefTheme } from '@/engine/species/reef/coralPalette';

const MOTE_COUNT = 340;
const BUBBLE_COUNT = 46;

/** Наскільки повільно осідає завись і як швидко йдуть бульбашки. */
const MOTE_FALL = 0.012;
const BUBBLE_RISE = 0.14;

const MOTE_TONE: Readonly<Record<ReefTheme, string>> = {
  dark: '#cfe9f7',
  light: '#ffffff',
};

/** Детермінований дріб: та сама завись у тієї самої пари. */
function unit(seed: number, salt: number): number {
  let value = Math.imul(seed ^ (salt * 0x27d4eb2d), 0x165667b1) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x2545f491) >>> 0;
  return ((value ^ (value >>> 13)) >>> 0) / 4_294_967_296;
}

interface ReefMotesProps {
  /** Розмір сцени: завись висить навколо рифа, а не в абстрактному кубі. */
  reach: number;
  theme: ReefTheme;
  seed: number;
  reduceMotion: boolean;
}

export function ReefMotes({ reach, theme, seed, reduceMotion }: ReefMotesProps): React.JSX.Element {
  const motes = useRef<Points>(null);
  const bubbles = useRef<Points>(null);

  /*
   * Обидві системи будуються раз. Рухаються вони переписуванням
   * позицій — 386 точок на кадр, тобто менше, ніж коштує один зайвий
   * виклик малювання.
   */
  const moteGeometry = useMemo(() => cloud(MOTE_COUNT, seed, reach, 1), [reach, seed]);
  const bubbleGeometry = useMemo(() => cloud(BUBBLE_COUNT, seed ^ 0xb0bb1e, reach, 0.55), [reach, seed]);
  useLayoutEffect(() => () => {
    moteGeometry.dispose();
    bubbleGeometry.dispose();
  }, [bubbleGeometry, moteGeometry]);

  useFrame((state, delta) => {
    if (reduceMotion) return;
    const time = state.clock.elapsedTime;
    drift(motes.current, delta * MOTE_FALL * reach, reach, time, false);
    drift(bubbles.current, -delta * BUBBLE_RISE * reach, reach, time, true);
  });

  return (
    <>
      <points ref={motes} geometry={moteGeometry} renderOrder={3}>
        <pointsMaterial
          color={MOTE_TONE[theme]}
          size={reach * 0.006}
          sizeAttenuation
          transparent
          opacity={theme === 'dark' ? 0.5 : 0.38}
          depthWrite={false}
          blending={AdditiveBlending}
          fog={false}
        />
      </points>
      <points ref={bubbles} geometry={bubbleGeometry} renderOrder={3}>
        <pointsMaterial
          color={MOTE_TONE[theme]}
          size={reach * 0.014}
          sizeAttenuation
          transparent
          opacity={theme === 'dark' ? 0.34 : 0.28}
          depthWrite={false}
          blending={AdditiveBlending}
          fog={false}
        />
      </points>
    </>
  );
}

/** Хмара точок навколо рифа: ширша за нього й нижча за поверхню. */
function cloud(count: number, seed: number, reach: number, spreadShare: number): BufferGeometry {
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const angle = unit(seed, index * 3) * Math.PI * 2;
    // Корінь із частки — щоб точки лягли рівно по ПЛОЩІ, а не збились
    // до центру, як буває при рівномірному радіусі.
    const distance = reach * (0.4 + 2.4 * spreadShare * Math.sqrt(unit(seed, index * 3 + 1)));
    positions[index * 3] = Math.cos(angle) * distance;
    positions[index * 3 + 1] = unit(seed, index * 3 + 2) * reach * 2.6;
    positions[index * 3 + 2] = Math.sin(angle) * distance;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Зсув хмари з поверненням на місце.
 *
 * Частка, що вийшла за межі, повертається з протилежного боку — так
 * хмара не рідшає з часом і не потребує ані створення, ані знищення
 * жодної точки.
 */
function drift(
  points: Points | null,
  step: number,
  reach: number,
  time: number,
  wobble: boolean,
): void {
  if (!points) return;
  const attribute = points.geometry.getAttribute('position') as BufferAttribute;
  const array = attribute.array as Float32Array;
  const ceiling = reach * 2.6;
  for (let index = 0; index < array.length; index += 3) {
    array[index + 1] = (array[index + 1] ?? 0) - step;
    if (array[index + 1]! < 0) array[index + 1] = ceiling;
    if (array[index + 1]! > ceiling) array[index + 1] = 0;
    if (wobble) {
      // Бульбашка йде не по прямій: вода зносить її вбік.
      array[index] = (array[index] ?? 0) + Math.sin(time * 0.9 + index) * reach * 0.0004;
    }
  }
  attribute.needsUpdate = true;
}
