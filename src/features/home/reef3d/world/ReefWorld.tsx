// ============================================================
// Три шари й камера — усе, що є в сцені рифа.
// ------------------------------------------------------------
// Стара сцена мала шістнадцять компонентів середовища й дев'ять
// проходів. Тут три: вода, камінь, риф. Кожен шар відповідає за одне,
// і жоден із них не вирішує геометрії — вона вся приходить із рушія.
// ============================================================
import { useMemo, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { reefCameraFrame, reefStanding } from '@/engine/species/reef/reefStaging';
import type { ReefPlan } from '@/engine/species/reef/reefAssembly';
import type { ReefTheme } from '@/engine/species/reef/coralPalette';
import { ReefColonies } from './ReefColonies';
import { ReefRock } from './ReefRock';
import { ReefSchool } from './ReefSchool';
import { ReefUndergrowth } from './ReefUndergrowth';
import { ReefWater } from './ReefWater';
import type { ReefMeshes } from './useReefMeshes';

/** Оберт за скільки секунд, коли рух не приглушений. */
const DRIFT_PERIOD_SECONDS = 190;

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

  useFrame((_state, delta) => {
    if (reduceMotion) return;
    const orbit = controls.current;
    if (!orbit) return;
    // Повільний дрейф навколо рифа. Не «анімація заради анімації»: під
    // нерухомою камерою пласке освітлення читається картинкою, а не
    // тілом. Період — понад три хвилини, тобто рух видно лише тому, хто
    // дивиться.
    orbit.setAzimuthalAngle(orbit.getAzimuthalAngle() + (Math.PI * 2 * delta) / DRIFT_PERIOD_SECONDS);
  });

  return (
    <>
      <ReefWater theme={theme} sceneRadius={standing.rock.radius} seed={plan.headSeed} />
      <ReefRock standing={standing} seed={plan.headSeed} theme={theme} />
      <ReefColonies plan={plan} meshes={meshes} theme={theme} lift={standing.headLift} />
      <ReefUndergrowth plan={plan} standing={standing} lift={standing.headLift} />
      <ReefSchool plan={plan} lift={standing.headLift} reduceMotion={reduceMotion} />
      <OrbitControls
        ref={controls}
        target={[frame.target.x, frame.target.y, frame.target.z]}
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
        // Під пісок камера не пускається: знизу немає сцени, там
        // тільки виворіт площини.
        minPolarAngle={Math.PI * 0.12}
        maxPolarAngle={Math.PI * 0.48}
      />
    </>
  );
}
