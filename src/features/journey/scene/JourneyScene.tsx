import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { crystalRenderScale } from '@/engine/renderer';
import { readWorldQuality } from '@/features/world/worldDim';
import { buildConstellation3D } from '../constellation3d';
import type { ConstellationEvent } from '../constellationRules';
import { journeyPalette } from '../journeyPalette';
import { ConstellationLines } from './ConstellationLines';
import { JourneyCameraRig } from './JourneyCameraRig';
import { JourneyConstellation, birthDuration } from './JourneyConstellation';
import { JourneyEnvironment, JOURNEY_SKY_RADIUS } from './JourneyEnvironment';
import type { JourneyFraming } from './journeyFraming';

// ============================================================
// Сцена «Наш шлях».
// ------------------------------------------------------------
// Друге полотно WebGL у застосунку — і єдине, яке має право існувати поруч зі
// світовим. Причина в тому, що це не інший ракурс на кристал, а інше місце:
// маршрут не вмикає `data-portal-scene`, тож світу тут не видно взагалі, а
// його цикл кадрів на час занурення зупинений (`useWorldFrameloop`).
//
// **Годинник появи живе в рефі, а не в стані.** Сузір'я народжується секунд
// три; тримати ці секунди станом означало б перемальовувати React-дерево
// щокадру заради чисел, які потрібні лише всередині `useFrame`.
//
// Готовність позначається атрибутом `data-journey="ready"` на обгортці. Це не
// діагностика для краси: живий харнес мусить чекати на ОЗНАКУ, а не на час —
// знімок «через три секунди» вже показував кадр, якого користувач ніколи не
// бачить (пастка №5 у `scripts/live/README.md`).
// ============================================================

export interface JourneySceneProps {
  events: readonly ConstellationEvent[];
  seed: string | null;
  reducedMotion: boolean;
}

/** Секунди від початку сцени, у рефі. */
export type Clock = { current: number };

export interface JourneyRuntime {
  drawCalls: number;
  triangles: number;
}

function SceneClock({
  clock,
  settleAt,
  skyLoaded,
  arrived,
  onSettled,
}: {
  clock: Clock;
  settleAt: number;
  skyLoaded: { current: boolean };
  arrived: { current: boolean };
  onSettled: (runtime: JourneyRuntime) => void;
}) {
  const announced = useRef(false);
  useFrame((state, delta) => {
    // Крок обрізається зверху навмисно: під програмним рендерером кадри йдуть
    // по три на секунду, і необрізаний крок перестрибнув би половину появи —
    // пара на телефоні побачила б рівний рух, а харнес порожнє небо.
    clock.current += Math.min(delta, 0.05);
    if (announced.current) return;
    if (!skyLoaded.current || !arrived.current || clock.current < settleAt) return;
    announced.current = true;
    // Числа беруться зі сцени, а не з очікувань: рахувати виклики малювання
    // «за списком компонентів» уже виявлялось хибним у рифі.
    const { calls, triangles } = state.gl.info.render;
    onSettled({ drawCalls: calls, triangles });
  });
  return null;
}

/** Каже нагору, що небо доїхало. Всередині `Suspense` — інакше його ще немає. */
function SkyLoaded({ flag }: { flag: { current: boolean } }) {
  flag.current = true;
  return null;
}

export function JourneyScene({ events, seed, reducedMotion }: JourneySceneProps) {
  const constellation = useMemo(() => buildConstellation3D(events), [events]);
  const palette = useMemo(() => journeyPalette(seed), [seed]);
  const shape = useMemo(
    () => ({ radial: constellation.radial, axial: constellation.axial }),
    [constellation],
  );
  const centre = useMemo(
    () => [constellation.centre.x, constellation.centre.y, constellation.centre.z] as const,
    [constellation],
  );
  const orderById = useMemo(
    () => new Map(constellation.stars.map((star) => [star.id, star.order])),
    [constellation],
  );

  const clock = useRef(0);
  const skyLoaded = useRef(false);
  const arrived = useRef(false);
  const [runtime, setRuntime] = useState<JourneyRuntime | null>(null);
  const [framing, setFraming] = useState<JourneyFraming | null>(null);

  const markArrived = useCallback(() => {
    arrived.current = true;
  }, []);
  const markSettled = useCallback((measured: JourneyRuntime) => setRuntime(measured), []);
  const markFramed = useCallback((measured: JourneyFraming) => setFraming(measured), []);

  const settleAt = reducedMotion ? 0 : birthDuration(constellation.stars.length);

  // Щільний екран оплачується масштабом рендера, а не оптикою — правило дому
  // (`quality.ts`). Тут воно важить більше, ніж деінде: скайбокс закриває кадр
  // цілком, тож кожен зайвий піксель платиться повною ціною заповнення.
  const [quality] = useState(readWorldQuality);
  const [pixelRatio] = useState(() => crystalRenderScale(
    quality,
    typeof window === 'undefined' ? 1 : window.devicePixelRatio,
  ));

  return (
    <div
      className="journey-scene"
      data-journey={runtime ? 'ready' : 'loading'}
      data-journey-quality={quality}
      data-journey-pixel-ratio={pixelRatio.toFixed(2)}
      data-journey-stars={constellation.stars.length}
      data-journey-edges={constellation.edges.length}
      data-journey-reach={constellation.reach.toFixed(2)}
      data-journey-radial={constellation.radial.toFixed(2)}
      data-journey-axial={constellation.axial.toFixed(2)}
      data-journey-span={constellation.span.toFixed(2)}
      data-journey-distance={framing ? framing.distance.toFixed(2) : ''}
      data-journey-time-axis={framing ? (framing.up[2] === 1 ? 'vertical' : 'horizontal') : ''}
      data-journey-draw-calls={runtime?.drawCalls ?? ''}
      data-journey-triangles={runtime?.triangles ?? ''}
    >
      <Canvas
        dpr={pixelRatio}
        camera={{
          // Справжня позиція ставиться ригом, щойно він дізнається форму
          // полотна; тут потрібне лише щось не в нулі, щоб матриця виду була
          // визначена на найпершому кадрі.
          position: [1, 0, 0],
          fov: 52,
          near: 0.5,
          // Небо на 600 одиниць мусить лишатись усередині кадру відсікання,
          // інакше пара побачить порожнечу там, де мали бути зірки.
          far: JOURNEY_SKY_RADIUS * 2.2,
        }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
        }}
      >
        <SceneClock
          clock={clock}
          settleAt={settleAt}
          skyLoaded={skyLoaded}
          arrived={arrived}
          onSettled={markSettled}
        />

        {/*
          Небо всередині `Suspense`: воно важить 0.71 МБ і приїжджає не миттєво,
          а сузір'я до нього стосунку не має й чекати не мусить.
        */}
        <Suspense fallback={null}>
          <JourneyEnvironment />
          <SkyLoaded flag={skyLoaded} />
        </Suspense>

        <ConstellationLines
          edges={constellation.edges}
          orderById={orderById}
          palette={palette}
          clock={clock}
          reducedMotion={reducedMotion}
        />
        <JourneyConstellation
          stars={constellation.stars}
          palette={palette}
          clock={clock}
          reducedMotion={reducedMotion}
        />

        <JourneyCameraRig
          shape={shape}
          centre={centre}
          reducedMotion={reducedMotion}
          onFramed={markFramed}
          onArrived={markArrived}
        />
      </Canvas>
    </div>
  );
}
