import { useEffect, useMemo, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { approach } from '@/features/world/sceneDirector';
import { journeyFraming, type JourneyFraming, type JourneyShape } from './journeyFraming';

// ============================================================
// Камера «Нашого шляху».
// ------------------------------------------------------------
// Три роботи, і жодна з них не власна вигадка.
//
// **Кадрування** рахується ТУТ, а не в сторінці, бо його не можна порахувати
// без форми полотна: на телефоні поле зору по горизонталі вдвічі вужче за
// вертикальне, і відстань, обрана без цього, лишає половину подій за краєм
// кадру. Так уже сталось — і саме тому `journeyFraming` тепер питає про кадр.
//
// **Інтро-політ** іде тим самим експоненційним наближенням, що й камера світу
// (`sceneDirector.approach`). У тому файлі прямо пояснено, чому там немає
// твінів: твін доводиться скасовувати або ставити в чергу, коли пара тапнула
// іншу ціль на півдорозі. Тут задача та сама — на другому етапі до цього рига
// прийдуть польоти до подій, — тож і механізм той самий.
//
// **Обертання** — drei `OrbitControls`, як у рифі. Панорамування вимкнене
// свідомо: воно вміє відвести пару від власного сузір'я так, що дороги назад
// вона не знайде.
// ============================================================

/** За скільки секунд політ долає половину решти відстані. */
const INTRO_HALF_LIFE = 0.42;
/**
 * Коли політ вважається завершеним — ЧАСТКА відстані, не одиниці сцени.
 *
 * Стала в одиницях виглядала невинно, але робила тривалість польоту
 * залежною від розміру сузір'я: пара з двома подіями прилітала за секунду, а
 * пара з двадцятьма — за шість, і на програмному рендерері харнеса це
 * впиралось у власну стелю очікування.
 */
const ARRIVED_FRACTION = 0.015;

export interface JourneyCameraRigProps {
  shape: JourneyShape;
  /** Середина сузір'я — те, навколо чого обертається камера. */
  centre: readonly [number, number, number];
  reducedMotion: boolean;
  /** Кличеться, коли кадрування пораховано — заради діагностики на сторінці. */
  onFramed?: (framing: JourneyFraming) => void;
  /** Кличеться один раз, коли камера прибула й керування перейшло парі. */
  onArrived?: () => void;
}

export function JourneyCameraRig({
  shape,
  centre,
  reducedMotion,
  onFramed,
  onArrived,
}: JourneyCameraRigProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const flying = useRef(!reducedMotion);
  const announced = useRef(false);

  const framing = useMemo(() => journeyFraming(shape, {
    aspect: size.height > 0 ? size.width / size.height : 1,
    fovY: camera instanceof PerspectiveCamera ? camera.fov : 52,
  }), [shape, size.width, size.height, camera]);

  useEffect(() => onFramed?.(framing), [framing, onFramed]);

  // Стартова точка ставиться до першого кадру, а не анімацією: інакше пара
  // побачила б один кадр із кінцевого ракурсу перед тим, як політ почнеться.
  useEffect(() => {
    const start = reducedMotion ? framing.distance : framing.introDistance;
    const [dx, dy, dz] = framing.direction;
    const [cx, cy, cz] = centre;
    camera.up.set(...framing.up);
    camera.position.set(cx + dx * start, cy + dy * start, cz + dz * start);
    camera.lookAt(cx, cy, cz);
    controlsRef.current?.target.set(cx, cy, cz);
    controlsRef.current?.update();
    flying.current = !reducedMotion;
    announced.current = false;
    if (reducedMotion) {
      // Прохання про спокій — це прохання про відсутність руху, а не про
      // інший ракурс: пара одразу стоїть там, куди інші прилітають.
      announced.current = true;
      onArrived?.();
    }
  }, [camera, centre, framing, reducedMotion, onArrived]);

  useFrame((_state, delta) => {
    const controls = controlsRef.current;
    if (!flying.current || !controls) return;

    // Відстань міряється від ЦІЛІ, а не від нуля світу: ядро стоїть на початку
    // осі часу, тож нуль лежить збоку від того, на що дивиться пара.
    const offset = camera.position.clone().sub(controls.target);
    const distance = offset.length();
    // Крок обрізається зверху: під програмним рендерером кадр триває третину
    // секунди, і необрізаний крок перестрибнув би весь політ одним стрибком.
    const step = approach(Math.min(delta, 0.05), INTRO_HALF_LIFE);
    const next = distance + (framing.distance - distance) * step;
    camera.position.copy(controls.target).add(offset.setLength(next));
    controls.update();

    if (Math.abs(next - framing.distance) <= framing.distance * ARRIVED_FRACTION) {
      camera.position.copy(controls.target).add(offset.setLength(framing.distance));
      controls.update();
      flying.current = false;
      if (!announced.current) {
        announced.current = true;
        onArrived?.();
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      // Керування вмикається одразу: перервати політ дотиком — це не збій, а
      // те, чого пара природно очікує від сцени, яку їй показують.
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      zoomSpeed={0.6}
      minDistance={framing.minDistance}
      maxDistance={framing.maxDistance}
      target={centre as unknown as [number, number, number]}
      onStart={() => {
        // Пара взялася крутити — політ поступається їй місцем негайно.
        flying.current = false;
        if (!announced.current) {
          announced.current = true;
          onArrived?.();
        }
      }}
    />
  );
}
