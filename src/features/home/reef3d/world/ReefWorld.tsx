// ============================================================
// Три шари й камера — усе, що є в сцені рифа.
// ------------------------------------------------------------
// Стара сцена мала шістнадцять компонентів середовища й дев'ять
// проходів. Тут три: вода, камінь, риф. Кожен шар відповідає за одне,
// і жоден із них не вирішує геометрії — вона вся приходить із рушія.
// ============================================================
import { useCallback, useMemo, useRef, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { reefCameraFrame, reefStanding } from '@/engine/species/reef/reefStaging';
import type { ReefPlan } from '@/engine/species/reef/reefAssembly';
import type { ReefTheme } from '@/engine/species/reef/coralPalette';
import {
  PORTAL_ORBIT_DAMPING,
  coarsePointerNow,
  portalOrbitRotateSpeed,
} from '../../crystal3d/scene/portalOrbit';
import { ReefColonies } from './ReefColonies';
import { ReefRock } from './ReefRock';
import { ReefSchool } from './ReefSchool';
import { ReefUndergrowth } from './ReefUndergrowth';
import { ReefMotes } from './ReefMotes';
import { DRIFT_RESUME_MS, reefDriftStep } from './reefDrift';
import { ReefWater } from './ReefWater';
import type { ReefMeshes } from './useReefMeshes';

interface ReefWorldProps {
  plan: ReefPlan;
  meshes: ReefMeshes;
  theme: ReefTheme;
  reduceMotion: boolean;
}

export function ReefWorld({ plan, meshes, theme, reduceMotion }: ReefWorldProps): React.JSX.Element {
  const standing = useMemo(() => reefStanding(plan.head), [plan.head]);
  /*
   * Кадр залежить від форми екрана, тож перераховується разом із нею:
   * поворот телефона міняє `aspect`, а з ним і відстань, на якій риф
   * ще вміщається.
   */
  const aspect = useThree((state) => state.viewport.aspect);
  const frame = useMemo(
    () => reefCameraFrame(plan.head, standing, aspect),
    [aspect, plan.head, standing],
  );
  const controls = useRef<OrbitControlsImpl | null>(null);
  const [coarsePointer] = useState(coarsePointerNow);
  const camera = useThree((state) => state.camera);

  /*
   * Камера ставиться ОДИН раз на кожен новий кадр-план, а не щокадру:
   * інакше вона щоразу відкидала б те, куди її повернула пара пальцем.
   */
  const placed = useRef<string>('');
  const key = `${frame.distance}:${frame.target.y}`;
  if (placed.current !== key) {
    placed.current = key;
    camera.position.set(0, frame.target.y + frame.distance * frame.height, frame.distance);
    camera.lookAt(frame.target.x, frame.target.y, frame.target.z);
  }

  /*
   * ДРЕЙФ МОВЧИТЬ, ПОКИ ВЕДЕ ПАЛЕЦЬ. Чому саме — у `reefDrift.ts`:
   * коротко, дрейф щокадру ВИКИДАВ накопичений жест, бо
   * `setAzimuthalAngle` перезаписує зсув, а контроли оновлюються
   * раніше за цей виклик.
   */
  const heldUntil = useRef(0);
  const onInteract = useCallback(() => {
    heldUntil.current = Number.POSITIVE_INFINITY;
  }, []);
  const onRelease = useCallback(() => {
    heldUntil.current = performance.now() + DRIFT_RESUME_MS;
  }, []);

  useFrame((_state, delta) => {
    if (reduceMotion) return;
    const orbit = controls.current;
    if (!orbit) return;
    // Повільний дрейф навколо рифа. Не «анімація заради анімації»: під
    // нерухомою камерою пласке освітлення читається картинкою, а не
    // тілом. Період — понад три хвилини, тобто рух видно лише тому, хто
    // дивиться.
    const step = reefDriftStep(delta, heldUntil.current, performance.now());
    if (step > 0) orbit.setAzimuthalAngle(orbit.getAzimuthalAngle() + step);
  });

  return (
    <>
      <ReefWater theme={theme} sceneRadius={standing.rock.radius} seed={plan.headSeed} />
      <ReefRock standing={standing} seed={plan.headSeed} theme={theme} />
      <ReefColonies plan={plan} meshes={meshes} theme={theme} lift={standing.headLift} />
      <ReefUndergrowth plan={plan} standing={standing} lift={standing.headLift} />
      <ReefSchool plan={plan} lift={standing.headLift} reduceMotion={reduceMotion} />
      <ReefMotes
        reach={standing.rock.radius}
        theme={theme}
        seed={plan.headSeed}
        reduceMotion={reduceMotion}
      />
      <OrbitControls
        ref={controls}
        target={[frame.target.x, frame.target.y, frame.target.z]}
        enablePan={false}
        enableZoom={false}
        enableDamping={!reduceMotion}
        /*
         * Ті самі числа, що в кристала, і з тієї самої причини: три
         * застосовує згасання НА КАДР, тож на телефоні 0.08 давало за
         * 200 мс лише 39% жесту. Мати два різні відчуття від пальця на
         * двох видах одного порталу — гірше, ніж мати одне неідеальне.
         */
        dampingFactor={PORTAL_ORBIT_DAMPING}
        rotateSpeed={portalOrbitRotateSpeed(coarsePointer, false)}
        onStart={onInteract}
        onEnd={onRelease}
        // Під пісок камера не пускається: знизу немає сцени, там
        // тільки виворіт площини.
        minPolarAngle={Math.PI * 0.12}
        maxPolarAngle={Math.PI * 0.48}
      />
    </>
  );
}
