import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { crystalRenderScale } from '@/engine/renderer';
import { readWorldQuality } from '@/features/world/worldDim';
import { buildConstellation3D } from '../constellation3d';
import type { ConstellationEvent } from '../constellationRules';
import {
  INITIAL_JOURNEY_STATE,
  journeyReducer,
  showsFocus,
  type JourneyEvent,
  type JourneyMode,
} from '../journeyMode';
import { hslToRgb, journeyPalette, levelColour } from '../journeyPalette';
import { ConstellationLines } from './ConstellationLines';
import { FocusStar } from './FocusStar';
import { JourneyCameraRig, type JourneyFocusTarget } from './JourneyCameraRig';
import { JourneyConstellation, birthDuration } from './JourneyConstellation';
import { JourneyEnvironment, JOURNEY_SKY_RADIUS } from './JourneyEnvironment';
import { StarPointer } from './StarPointer';
import type { JourneyFraming } from './journeyFraming';

/**
 * Сяйво — окремим чанком, але НЕ за вимогою.
 *
 * `postprocessing` важить сотні кілобайт, тож у головному чанку його немає.
 * Але вантажити його в мить дотику не можна, і це виміряно: браузер тягнув
 * чанк рівно тоді, коли починався політ до події, і найдовший кадр виходив
 * **1367 мс**. Пара бачила ривок саме там, де мала бачити рух.
 *
 * Тому чанк замовляється заздалегідь — поки їде небо, — а композитор
 * монтується, щойно сцена вляглась: у ту мить нічого не рухається, і платити
 * за виділення буферів там непомітно.
 */
const JourneyBloom = lazy(() => import('./JourneyBloom'));
const preloadBloom = () => import('./JourneyBloom');

// ============================================================
// Сцена «Наш шлях».
// ------------------------------------------------------------
// Друге полотно WebGL у застосунку — і єдине, яке має право існувати поруч зі
// світовим. Причина в тому, що це не інший ракурс на кристал, а інше місце:
// маршрут не вмикає `data-portal-scene`, тож світу тут не видно взагалі, а
// його цикл кадрів на час занурення зупинений (`useWorldFrameloop`).
//
// **Годинники живуть у рефах, а не в стані.** Сузір'я народжується секунди зо
// три, сонце проявляється півсекунди; тримати ці числа станом означало б
// перемальовувати React-дерево щокадру заради значень, потрібних лише
// всередині `useFrame`. У стані живе тільки те, що міняє РОЗКЛАДКУ — режим.
//
// Готовність позначається атрибутом `data-journey="ready"`. Це не діагностика
// для краси: живий харнес мусить чекати на ОЗНАКУ, а не на час — знімок «через
// три секунди» вже показував кадр, якого користувач ніколи не бачить (пастка
// №5 у `scripts/live/README.md`).
// ============================================================

export interface JourneySceneProps {
  events: readonly ConstellationEvent[];
  seed: string | null;
  reducedMotion: boolean;
  /** Режим сцени назовні — сторінка малює під нього деталі й розкладку. */
  onMode?: (mode: JourneyMode, focusId: number | null) => void;
  /** Пара попросила додати подію довгим натисканням по порожньому небу. */
  onRequestAdd?: () => void;
  /** Сторінка просить закрити подію. Зростає з кожним натисканням. */
  dismissSignal?: number;
  /** Модалку додавання закрито. Зростає з кожним закриттям. */
  addClosedSignal?: number;
  /** Вимкнути сяйво примусово — для порівняльних знімків. */
  bloom?: boolean;
}

/** Секунди від початку сцени, у рефі. */
export type Clock = { current: number };

export interface JourneyRuntime {
  drawCalls: number;
  triangles: number;
}

/** За скільки секунд сонце проявляється або гасне. */
const REVEAL_SECONDS = 0.5;

/**
 * Скільки прохід сяйва працює вхолосту після монтування, мс.
 *
 * Досить кількох кадрів навіть на найповільнішому пристрої; більше — марна
 * робота, менше — ризик, що жоден кадр не встиг намалюватись.
 */
const BLOOM_WARMUP_MS = 400;

function SceneClock({
  clock,
  reveal,
  revealing,
  settleAt,
  skyLoaded,
  arrived,
  onSettled,
}: {
  clock: Clock;
  reveal: Clock;
  revealing: { current: boolean };
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
    const step = Math.min(delta, 0.05);
    clock.current += step;

    // Сонце проявляється й гасне тим самим числом в обидва боки: перехід туди
    // й назад мусить читатись однаково, інакше повернення виглядає різкішим.
    const direction = revealing.current ? 1 : -1;
    reveal.current = Math.max(0, Math.min(1, reveal.current + (direction * step) / REVEAL_SECONDS));

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
function SkyLoaded({ onLoaded }: { onLoaded: () => void }) {
  useEffect(onLoaded, [onLoaded]);
  return null;
}

export function JourneyScene({
  events,
  seed,
  reducedMotion,
  onMode,
  onRequestAdd,
  dismissSignal = 0,
  addClosedSignal = 0,
  bloom = true,
}: JourneySceneProps) {
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

  const [state, dispatch] = useReducer(journeyReducer, INITIAL_JOURNEY_STATE);
  const send = useCallback((event: JourneyEvent) => dispatch(event), []);

  const clock = useRef(0);
  const reveal = useRef(0);
  const revealing = useRef(false);
  revealing.current = state.mode === 'focusing' || state.mode === 'eventFocus';

  const skyLoaded = useRef(false);
  const arrived = useRef(false);
  const [runtime, setRuntime] = useState<JourneyRuntime | null>(null);
  const [framing, setFraming] = useState<JourneyFraming | null>(null);

  const markSkyLoaded = useCallback(() => {
    skyLoaded.current = true;
    send({ type: 'skyReady' });
  }, [send]);
  const markArrived = useCallback(() => {
    arrived.current = true;
    send({ type: 'introDone' });
  }, [send]);
  const markSettled = useCallback((measured: JourneyRuntime) => setRuntime(measured), []);
  const markFramed = useCallback((measured: JourneyFraming) => setFraming(measured), []);
  const markFocusArrived = useCallback(() => send({ type: 'focusArrived' }), [send]);
  const markReturnArrived = useCallback(() => send({ type: 'returnArrived' }), [send]);

  const focusStar = useMemo(
    () => (state.focusId === null
      ? null
      : constellation.stars.find((star) => star.id === state.focusId) ?? null),
    [constellation.stars, state.focusId],
  );

  /**
   * Сонце помітно більше за зірку, але не втричі.
   *
   * Стала частина переважає: якби розмір ішов пропорційно рівню, ключова подія
   * і звичайна відкривались би в різному масштабі, і розкладка деталей
   * стрибала б залежно від того, що пара тапнула.
   */
  const focusRadius = focusStar ? 2.6 + focusStar.radius * 0.9 : 0;

  const focusTarget: JourneyFocusTarget | null = useMemo(
    () => (focusStar
      ? { position: [focusStar.x, focusStar.y, focusStar.z] as const, radius: focusRadius }
      : null),
    [focusStar, focusRadius],
  );

  const focusColour = useMemo(
    () => (focusStar
      ? hslToRgb(focusStar.core ? palette.keyCore : levelColour(palette, focusStar.level))
      : ([1, 1, 1] as [number, number, number])),
    [focusStar, palette],
  );

  useEffect(() => onMode?.(state.mode, state.focusId), [onMode, state.mode, state.focusId]);

  /*
   * Відкриту подію видалили — сцені треба повернутись.
   *
   * Знайдено аудитом, не екраном: партнер може стерти подію, поки вона
   * розкрита. Тоді `focusId` лишався вказувати в порожнечу, ціль польоту
   * ставала `null`, і камера зависала в «летить» НАЗАВЖДИ — з вимкненим
   * керуванням, тобто пара лишалась у кадрі, з якого нічого не видно.
   */
  useEffect(() => {
    if (state.focusId !== null && focusStar === null) send({ type: 'dismiss' });
  }, [focusStar, send, state.focusId]);

  // Сторінка просить закрити подію. Нуль — початкове значення, не сигнал.
  useEffect(() => {
    if (dismissSignal > 0) send({ type: 'dismiss' });
  }, [dismissSignal, send]);

  // Модалку закрито. Без цього машина лишалась би в `addingEvent` назавжди, і
  // друге довге натискання вже нічого не відкривало б.
  useEffect(() => {
    if (addClosedSignal > 0) send({ type: 'addClosed' });
  }, [addClosedSignal, send]);

  const handlePick = useCallback((id: number | null) => {
    // Дотик повз зірку закриває відкриту подію — те саме, що зробив би дотик
    // повз будь-що відкрите. У спокої машина його просто проігнорує.
    if (id === null) send({ type: 'dismiss' });
    else send({ type: 'selectStar', id });
  }, [send]);

  const handleLongPress = useCallback(() => {
    send({ type: 'requestAdd' });
    onRequestAdd?.();
  }, [onRequestAdd, send]);

  const settleAt = reducedMotion ? 0 : birthDuration(constellation.stars.length);

  // Щільний екран оплачується масштабом рендера, а не оптикою — правило дому
  // (`quality.ts`). Тут воно важить більше, ніж деінде: скайбокс закриває кадр
  // цілком, тож кожен зайвий піксель платиться повною ціною заповнення.
  const [quality] = useState(readWorldQuality);
  const [pixelRatio] = useState(() => crystalRenderScale(
    quality,
    typeof window === 'undefined' ? 1 : window.devicePixelRatio,
  ));

  const bloomEligible = bloom && quality === 'high';
  /*
   * Композитор МОНТУЄТЬСЯ у спокої, а ПРАЦЮЄ лише поки подія в кадрі.
   *
   * Три виміри знадобилось, щоб розділити ці дві речі:
   *   — монтування за вимогою → браузер тягне чанк у мить дотику, 1367 мс;
   *   — увімкнений назавжди → мережа зникла, але середній кадр 574 → 1013 мс;
   *   — знову за focus → середній кадр повернувся, найгірший став 1962 мс,
   *     бо буфери й шейдери проходу народжувались рівно на дотику.
   *
   * `enabled` вимикає прохід, не звільняючи його ресурсів, тож налаштування
   * платиться один раз у спокої, а кадр — лише там, де сяйво видно.
   */
  const bloomMounted = bloomEligible && runtime !== null;
  const bloomVisible = bloomEligible && showsFocus(state.mode);

  /*
   * Прогрів: перші кадри після монтування прохід працює з нульовою
   * інтенсивністю. Кадр від цього не змінюється, але шейдери компілюються —
   * а компілювались вони інакше рівно в мить дотику.
   */
  const [bloomWarming, setBloomWarming] = useState(false);
  useEffect(() => {
    if (!bloomMounted) return undefined;
    setBloomWarming(true);
    const timer = setTimeout(() => setBloomWarming(false), BLOOM_WARMUP_MS);
    return () => clearTimeout(timer);
  }, [bloomMounted]);

  const bloomActive = bloomVisible || bloomWarming;

  // Чанк замовляється поки їде небо: до першого дотику він уже в кеші, і
  // монтування композитора не тягне за собою мережу.
  useEffect(() => {
    if (bloomEligible) void preloadBloom();
  }, [bloomEligible]);

  return (
    <div
      className="journey-scene"
      data-journey={runtime ? 'ready' : 'loading'}
      data-journey-mode={state.mode}
      data-journey-focus={state.focusId ?? ''}
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
      data-journey-bloom={bloomMounted ? (bloomVisible ? 'active' : 'idle') : 'off'}
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
          reveal={reveal}
          revealing={revealing}
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
          <SkyLoaded onLoaded={markSkyLoaded} />
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
          focusId={state.focusId}
          reveal={reveal}
        />

        {/*
          Сонце змонтоване ЗАВЖДИ, а не лише коли подія відкрита.
          
          Причина та сама, що й у сяйва: матеріал зі своїм шейдером компілюється
          при першому малюванні, і якщо це малювання припадає на дотик, пара
          дістає ривок. У спокої сонце має нульовий масштаб — один виклик
          малювання, який не зафарбовує жодного пікселя, і прогрітий шейдер.
        */}
        <Suspense fallback={null}>
          <FocusStar
            position={focusStar ? [focusStar.x, focusStar.y, focusStar.z] : centre}
            colour={focusColour}
            radius={focusRadius}
            reveal={reveal}
            reducedMotion={reducedMotion}
          />
        </Suspense>

        {/*
          Сяйво живе лише поки подія в кадрі й лише на сильному профілі. Прохід
          читає й пише повний екран щокадру — саме те, чого слабкому телефону
          бракує найперше.
        */}
        {bloomMounted && (
          <Suspense fallback={null}>
            <JourneyBloom active={bloomActive} visible={bloomVisible} />
          </Suspense>
        )}

        <StarPointer
          stars={constellation.stars}
          onPick={handlePick}
          onLongPress={handleLongPress}
          /*
           * Дотик лишається живим і під час польоту.
           *
           * Спершу тут стояв `cameraLocked`, і це змішувало дві різні речі:
           * замкнути ОРБІТУ, поки камера веде себе сама, — правильно; відмовити
           * в дотику — ні. Машина станів навмисно дозволяє перецілитись на іншу
           * зірку на півдорозі (і це покрито тестом), а стара умова робила ту
           * гілку недосяжною.
           */
          disabled={state.mode === 'loading' || state.mode === 'addingEvent'}
        />

        <JourneyCameraRig
          shape={shape}
          centre={centre}
          reducedMotion={reducedMotion}
          mode={state.mode}
          focus={focusTarget}
          saveView={state.saveView}
          onFramed={markFramed}
          onArrived={markArrived}
          onFocusArrived={markFocusArrived}
          onReturnArrived={markReturnArrived}
        />
      </Canvas>
    </div>
  );
}
