import { useEffect, useMemo, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { approach } from '@/features/world/sceneDirector';
import { cameraLocked, type JourneyMode } from '../journeyMode';
import {
  focusDistance,
  journeyFraming,
  type JourneyBody,
  type JourneyFraming,
} from './journeyFraming';

// ============================================================
// Камера «Нашого шляху».
// ------------------------------------------------------------
// Чотири роботи, і жодна з них не власна вигадка.
//
// **Кадрування** рахується ТУТ, а не в сторінці, бо його не можна порахувати
// без форми полотна: на телефоні поле зору по горизонталі вдвічі вужче за
// вертикальне, і відстань, обрана без цього, лишає половину подій за краєм.
//
// **Інтро-політ, політ до події й повернення** ідуть ОДНИМ механізмом —
// експоненційним наближенням із `sceneDirector.approach`. У тому файлі прямо
// пояснено, чому там немає твінів: твін доводиться скасовувати або ставити в
// чергу, коли пара тапнула другу ціль на півдорозі. Тут це не гіпотетичний
// випадок, а звичайний — сузір'я саме й запрошує перестрибувати з зірки на
// зірку. Наближення просто дістає нову ціль і йде до неї з того місця, де було.
//
// **Точку повернення** камера запам'ятовує, коли пара йде зі спокою, і НЕ
// перезаписує при стрибку з події на подію. Рішення ухвалює машина станів
// (`saveView`), тут воно лише виконується: інакше друга подія затерла б точку
// повернення, і «назад» вивело б пару не туди, звідки вона прийшла.
//
// **Обертання** — drei `OrbitControls`, як у рифі. Панорамування вимкнене: воно
// вміє відвести пару від власного сузір'я так, що дороги назад вона не знайде.
//
// Один поділ обов'язків, який варто назвати окремо: **поки триває політ, камеру
// веде тільки він.** `controls.update()` виводить позицію зі свого сферичного
// стану й залишкового демпфування, тож виклик його щокадру означав би двох
// господарів на одну позицію — і саме це дає дрижання. Орбіта дізнається, де
// опинилась камера, один раз, на прибутті.
// ============================================================

/** За скільки секунд політ долає половину решти відстані. */
const INTRO_HALF_LIFE = 0.42;
/** Політ до події коротший: пара вже знає, куди дивиться. */
const FOCUS_HALF_LIFE = 0.3;
/**
 * Коли політ вважається завершеним — ЧАСТКА відстані, не одиниці сцени.
 *
 * Стала в одиницях робила тривалість польоту залежною від розміру сузір'я:
 * пара з двома подіями прилітала за секунду, а пара з двадцятьма — за шість.
 */
const ARRIVED_FRACTION = 0.015;
/**
 * Абсолютна підлога для межі прибуття, одиниці сцени.
 *
 * Сама межа береться від ВІДСТАНІ ПОЛЬОТУ, а не від розміру події. Спершу
 * було від радіуса сонця — і виміряно: подія радіуса 3.4 давала межу 0.05, тобто
 * дві десятих відсотка шляху. Експонента доходить туди нескінченно довго, і на
 * живому екрані сцена так і лишалась у «летить» через півхвилини після дотику.
 */
const ARRIVED_MIN = 0.05;

/**
 * Наскільки подія зсувається з центру кадру, щоб звільнити місце деталям.
 *
 * Частка ПІВсторони кадру: 0.38 ставить сонце приблизно на третину висоти від
 * верху — вище за центр, як просив власник, але не впритул до шапки.
 *
 * Зсувається КАМЕРА, а не полотно. Спокуса стиснути полотно через CSS велика —
 * розкладка тоді описується одним правилом, — але кожен крок такої анімації
 * перевиділяє буфер малювання, і на телефоні це помітний ривок посеред
 * переходу. Камера ж і так летить: зсув їде разом із польотом задарма.
 */
const SPLIT_SHIFT = 0.38;

/**
 * Синхронізує стан орбіти з тим, куди камеру поставив політ.
 *
 * Кличеться РАЗ на прибуття, а не щокадру. `OrbitControls.update()` виводить
 * позицію камери зі свого внутрішнього сферичного стану й залишкового
 * демпфування — тобто під час польоту він переписував би те, що щойно поставив
 * `lerp`. Два господарі на одну позицію камери й дають дрижання.
 */
function syncOrbit(controls: OrbitControlsImpl, target: Vector3): void {
  controls.target.copy(target);
  controls.update();
}

export interface JourneyFocusTarget {
  position: readonly [number, number, number];
  /** Радіус сонця події — з нього рахується відстань. */
  radius: number;
}

export interface JourneyCameraRigProps {
  /** Зірки сузір'я відносно його середини — те, що камера мусить умістити. */
  bodies: readonly JourneyBody[];
  /** Середина сузір'я — те, навколо чого обертається камера у спокої. */
  centre: readonly [number, number, number];
  reducedMotion: boolean;
  mode: JourneyMode;
  focus: JourneyFocusTarget | null;
  /** Машина сказала запам'ятати ракурс перед цим польотом. */
  saveView: boolean;
  onFramed?: (framing: JourneyFraming) => void;
  /** Інтро завершилось — керування перейшло парі. */
  onArrived?: () => void;
  onFocusArrived?: () => void;
  onReturnArrived?: () => void;
}

export function JourneyCameraRig({
  bodies,
  centre,
  reducedMotion,
  mode,
  focus,
  saveView,
  onFramed,
  onArrived,
  onFocusArrived,
  onReturnArrived,
}: JourneyCameraRigProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const introFlying = useRef(!reducedMotion);
  const announced = useRef(false);

  /** Ракурс, у який треба повернути пару. */
  const saved = useRef<{ position: Vector3; target: Vector3 } | null>(null);
  /** Напрямок «від цілі до камери», зафіксований на початку польоту. */
  const approachDirection = useRef(new Vector3(1, 0, 0));
  /**
   * Куди зсунути точку прицілу, щоб подія пішла з центру кадру.
   *
   * Рахується РАЗ на початку польоту й лишається світовим вектором. Якби він
   * перераховувався щокадру з поточної орієнтації камери, вийшов би зворотний
   * зв'язок: приціл рухає камеру, камера рухає приціл.
   */
  const splitShift = useRef(new Vector3());
  const scratch = useRef({ desired: new Vector3(), spare: new Vector3(), aim: new Vector3() });

  const viewport = useMemo(() => ({
    aspect: size.height > 0 ? size.width / size.height : 1,
    fovY: camera instanceof PerspectiveCamera ? camera.fov : 52,
  }), [size.width, size.height, camera]);

  const framing = useMemo(() => journeyFraming(bodies, viewport), [bodies, viewport]);

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
    introFlying.current = !reducedMotion;
    announced.current = false;
    if (reducedMotion) {
      // Прохання про спокій — це прохання про відсутність руху, а не про
      // інший ракурс: пара одразу стоїть там, куди інші прилітають.
      announced.current = true;
      onArrived?.();
    }
  }, [camera, centre, framing, reducedMotion, onArrived]);

  // Політ починається — фіксуємо, звідки летимо й куди повертатись.
  useEffect(() => {
    const controls = controlsRef.current;
    if (mode !== 'focusing' || !controls || !focus) return;
    if (saveView) {
      saved.current = { position: camera.position.clone(), target: controls.target.clone() };
    }
    // Напрямок підльоту береться з ПОТОЧНОГО ракурсу: камера має під'їхати до
    // події, а не облетіти її. Вироджений випадок (камера рівно в цілі) дає
    // запасний напрямок кадрування.
    const offset = camera.position.clone().sub(new Vector3(...focus.position));
    approachDirection.current.copy(
      offset.lengthSq() > 1e-6 ? offset.normalize() : new Vector3(...framing.direction),
    );

    // На вузькому екрані деталі стають унизу, тож подія йде вгору; на широкому
    // деталі стають праворуч, тож подія йде ліворуч.
    const distance = focusDistance(focus.radius, viewport);
    const halfFovY = (viewport.fovY * Math.PI) / 360;
    const forward = approachDirection.current.clone().negate();
    const right = new Vector3().crossVectors(forward, camera.up).normalize();
    const trueUp = new Vector3().crossVectors(right, forward);
    if (viewport.aspect < 1) {
      // Приціл нижче за подію — отже подія вище за центр кадру.
      splitShift.current.copy(trueUp).multiplyScalar(-SPLIT_SHIFT * distance * Math.tan(halfFovY));
    } else {
      splitShift.current.copy(right)
        .multiplyScalar(-SPLIT_SHIFT * distance * Math.tan(halfFovY) * viewport.aspect);
    }
  }, [mode, focus, saveView, camera, framing.direction, viewport]);

  useFrame((_state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    // Крок обрізається зверху: під програмним рендерером кадр триває третину
    // секунди, і необрізаний крок перестрибнув би весь політ одним стрибком.
    const step = Math.min(delta, 0.05);
    const { desired, spare, aim } = scratch.current;

    if (mode === 'focusing' && focus) {
      // Камера цілиться не в саму подію, а поруч: так подія йде з центру кадру
      // й лишає місце деталям, а полотно не доводиться стискати.
      aim.set(focus.position[0], focus.position[1], focus.position[2]).add(splitShift.current);
      desired.copy(aim).addScaledVector(
        approachDirection.current,
        focusDistance(focus.radius, viewport),
      );
      const rate = approach(step, FOCUS_HALF_LIFE);
      controls.target.lerp(aim, rate);
      camera.position.lerp(desired, rate);
      // Камеру наводить політ, а не орбіта: `controls.update()` тут переписав
      // би позицію власним сферичним станом і залишковим демпфуванням.
      camera.lookAt(controls.target);
      const close = Math.max(ARRIVED_MIN, focusDistance(focus.radius, viewport) * ARRIVED_FRACTION);
      if (camera.position.distanceTo(desired) <= close) {
        camera.position.copy(desired);
        syncOrbit(controls, aim);
        onFocusArrived?.();
      }
      return;
    }

    if (mode === 'returning') {
      const home = saved.current;
      const target = home?.target ?? spare.set(centre[0], centre[1], centre[2]);
      const position = home?.position ?? desired
        .set(centre[0], centre[1], centre[2])
        .addScaledVector(
          new Vector3(framing.direction[0], framing.direction[1], framing.direction[2]),
          framing.distance,
        );
      const rate = approach(step, FOCUS_HALF_LIFE);
      controls.target.lerp(target, rate);
      camera.position.lerp(position, rate);
      camera.lookAt(controls.target);
      const close = Math.max(ARRIVED_MIN, framing.distance * ARRIVED_FRACTION);
      if (camera.position.distanceTo(position) <= close) {
        camera.position.copy(position);
        syncOrbit(controls, target);
        saved.current = null;
        onReturnArrived?.();
      }
      return;
    }

    if (!introFlying.current) return;

    // Інтро: відстань міряється від ЦІЛІ, а не від нуля світу — ядро стоїть на
    // початку осі часу, тож нуль лежить збоку від того, на що дивиться пара.
    spare.copy(camera.position).sub(controls.target);
    const distance = spare.length();
    const next = distance + (framing.distance - distance) * approach(step, INTRO_HALF_LIFE);
    camera.position.copy(controls.target).add(spare.setLength(next));
    camera.lookAt(controls.target);

    if (Math.abs(next - framing.distance) <= framing.distance * ARRIVED_FRACTION) {
      camera.position.copy(controls.target).add(spare.setLength(framing.distance));
      syncOrbit(controls, controls.target.clone());
      introFlying.current = false;
      if (!announced.current) {
        announced.current = true;
        onArrived?.();
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      // Поки камера веде себе сама, пара її не чіпає — інакше вона опиниться в
      // проміжному ракурсі, з якого не видно ні сузір'я, ні події. Інтро при
      // цьому лишається перервним: див. `journeyMode.cameraLocked`.
      enabled={!cameraLocked(mode)}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      zoomSpeed={0.6}
      minDistance={framing.minDistance}
      maxDistance={framing.maxDistance}
      target={centre as unknown as [number, number, number]}
      onStart={() => {
        // Пара взялася крутити — інтро поступається їй місцем негайно.
        introFlying.current = false;
        if (!announced.current) {
          announced.current = true;
          onArrived?.();
        }
      }}
    />
  );
}
