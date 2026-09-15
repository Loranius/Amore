import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

export interface EvolutionRuntimeMetrics {
  frames: number;
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
  /**
   * ХТО САМЕ малює — коротким рядком, наприклад `batch:4,points:1,mesh:7`.
   *
   * З'явилось не для краси. Приймальний тест бюджету кристала рахує його
   * виклики як «усі мінус оточення» й уже півтора місяця падає в CI на
   * `7 > 5`, а сказати, ЩО це за сім, не може ніхто: розклад сцени
   * (`--breakdown`) є лише в dev-збірці, а CI малює продакшн.
   *
   * Це той самий урок, що й із бюджетом дерева: питання «на що витрачені
   * виклики» без обходу сцени доводиться відповідати арифметикою на
   * папері — і саме там і жила помилка.
   *
   * Діагностика й нічого більше: у хеші, рішення чи геометрію це не йде.
   */
  composition: string;
}

/**
 * Ключ, під яким сцена лежить на `window` у dev-збірці.
 *
 * Навіщо. `gl.info.render.triangles` каже, скільки трикутників намальовано, і
 * не каже ЧИМ. Питання «на що витрачені 36 754 трикутники дерева» без цього
 * доводиться відповідати читанням коду й арифметикою на папері — а саме там
 * і жила помилка, яку тут уже ловили: гіпотеза про бюджет дерева обіцяла
 * −40%, дала −5%, бо три названі підозрювані разом важили менше за
 * четвертого, якого ніхто не зважував.
 *
 * Тому обхід сцени — не «зручність», а те, без чого бюджетна робота
 * ворожить. Живий харнес читає це через `--breakdown`.
 *
 * ТІЛЬКИ dev. У продакшн-збірці рядок вирізається разом із гілкою, тож пара
 * ніколи не отримує посилання на сцену в глобальному просторі.
 */
export const EVOLUTION_SCENE_HANDLE = '__amoreEvolutionScene';

/**
 * Крива тонування й експозиція — ті, що застосовані НАСПРАВДІ.
 *
 * Профіль світла (`npm run live -- … --profile`) мусить обернути саме ту
 * криву, якою кадр стиснуто, інакше він «виправляє» те, чого не робили.
 * Припускати її не можна: R3F ставить ACES за замовчуванням, але `flat` на
 * полотні це вимикає, і жодного попередження при цьому не буде.
 */
export const EVOLUTION_TONE_HANDLE = '__amoreEvolutionTone';

/**
 * Хто малюється в цьому кадрі, згрупований за родом.
 *
 * Рід беремо з ІМЕНІ об'єкта, а не з його типу: батч кристала й меш
 * острова — обидва `Mesh`, і різниця між ними саме в тому, чим вони є,
 * а не з чого зроблені. Батчі підписані в `bundle.ts`, іскри — в
 * `innerSparks.ts`; усе інше лишається просто мешем.
 *
 * Невидиме не рахується: об'єкт із `visible = false` не коштує виклику.
 */
function sceneComposition(scene: { traverseVisible: (fn: (node: unknown) => void) => void }): string {
  const counts = new Map<string, number>();
  const bump = (kind: string): void => {
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  };
  scene.traverseVisible((node) => {
    const object = node as { isMesh?: boolean; isPoints?: boolean; isLine?: boolean; name?: string };
    if (object.isPoints) bump('points');
    else if (object.isLine) bump('line');
    else if (object.isMesh) bump(object.name?.startsWith('Evolution crystal batch') ? 'batch' : 'mesh');
  });
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([kind, count]) => `${kind}:${count}`)
    .join(',');
}

export function EvolutionRuntimeProbe({
  onMetrics,
  warmupFrames = 24,
}: {
  onMetrics: (metrics: EvolutionRuntimeMetrics) => void;
  warmupFrames?: number;
}) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const frameRef = useRef(0);
  const lastRef = useRef('');

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    const holder = window as unknown as Record<string, unknown>;
    holder[EVOLUTION_SCENE_HANDLE] = scene;
    holder[EVOLUTION_TONE_HANDLE] = {
      toneMapping: gl.toneMapping,
      exposure: gl.toneMappingExposure,
    };
    return () => {
      delete holder[EVOLUTION_SCENE_HANDLE];
      delete holder[EVOLUTION_TONE_HANDLE];
    };
  }, [scene, gl]);

  useEffect(() => {
    frameRef.current = 0;
    lastRef.current = '';
  }, [gl, warmupFrames]);

  useFrame(() => {
    frameRef.current += 1;
    if (frameRef.current < warmupFrames) return;

    // R3F renders after useFrame callbacks, so renderer.info describes the
    // previous completed frame. That is exactly what the acceptance test needs.
    const metrics: EvolutionRuntimeMetrics = {
      frames: frameRef.current,
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      points: gl.info.render.points,
      lines: gl.info.render.lines,
      composition: sceneComposition(scene),
    };
    const signature = [
      metrics.drawCalls,
      metrics.triangles,
      metrics.points,
      metrics.lines,
      metrics.composition,
    ].join(':');
    if (signature === lastRef.current) return;
    lastRef.current = signature;
    onMetrics(metrics);
  });

  return null;
}
