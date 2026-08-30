import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

export interface EvolutionRuntimeMetrics {
  frames: number;
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
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
    };
    const signature = [
      metrics.drawCalls,
      metrics.triangles,
      metrics.points,
      metrics.lines,
    ].join(':');
    if (signature === lastRef.current) return;
    lastRef.current = signature;
    onMetrics(metrics);
  });

  return null;
}
