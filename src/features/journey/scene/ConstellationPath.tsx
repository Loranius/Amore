import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  type ShaderMaterial,
} from 'three';
import type { Star3D } from '../constellation3d';
import { hslToRgb, type JourneyPalette } from '../journeyPalette';
import { pathReveal, pulsePosition } from './constellationLife';
import { buildConstellationLines } from './constellationLines';

// ============================================================
// Шлях між подіями — ПРЯМІ, як на зоряній карті (ADR-0214).
// ------------------------------------------------------------
// Історія цього файлу — маятник, і обидва його боки варто знати.
//
// Спершу тут були відрізки без жодного задуму: кожна зірка тягла пряму до
// попередньої, кут ланцюга йшов від порядку створення, і власник назвав
// результат «network graph». Тоді ланцюг став одним сплайном Катмулла —
// Рома, що згинається на зірках.
//
// Власник: «зроби сузір'я схожим на реальні сузір'я з гострими
// геометричними з'єднаннями замість хвилястих». Справжня вада «графа» була
// не в прямих, а в порядку й куті (їх виправив `constellation3d`), тож
// прямі повертаються — вже як на карті неба: злам рівно на зірці, і лінія
// зупиняється трохи до неї (`constellationLines.ts`).
//
// Це справжня геометрія у сцені, а не накладений SVG: ділянка, що має
// пройти ЗА зіркою, ховається за нею, і сузір'я не читається пласким.
//
// **Один виклик малювання на весь шлях.** Меш будується раз на зміну
// набору подій; поява й імпульс живуть в уніформах.
// ============================================================

/**
 * Товщина шляху. Помітно тонша за найдрібнішу зірку — це зв'язок, не подія.
 *
 * Зменшено з 0.16 після виміру у focus-режимі: труба має сталу товщину у
 * СВІТІ, тож здалеку вона стрічка, а впритул — смуга через увесь кадр. На
 * розкритій події вона виходила помітнішою за саму подію.
 *
 * 0.12 → 0.05: власник — «зробити тонші лінії зв'язку». Павутинка, а не
 * стрічка: вона вказує на зірку, а не змагається з нею.
 */
const PATH_RADIUS = 0.05;

const PATH_VERTEX = /* glsl */ `
  varying vec2 vPath;
  void main() {
    vPath = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Поява й імпульс — обидва по ДОВЖИНІ труби, тобто по `uv.x`.
 *
 * `buildConstellationLines` кладе зірку `i` рівно на `uv.x = i / (n − 1)`
 * (та сама угода, що була в сплайна). Саме на цьому й тримається
 * `pathReveal`, і саме тому поява не потребує ні перебудови геометрії, ні
 * `drawRange`.
 */
const PATH_FRAGMENT = /* glsl */ `
  varying vec2 vPath;
  uniform vec3 uColour;
  uniform float uReveal;
  uniform float uPulse;
  uniform float uOpacity;
  void main() {
    if (vPath.x > uReveal) discard;
    // Кінчик прокладеної частини гасне, а не обрізається ножем.
    float tip = smoothstep(uReveal, uReveal - 0.012, vPath.x);
    // Вузька світла смуга, що йде від найдавнішої події до найновішої.
    float band = uPulse < 0.0 ? 0.0 : exp(-pow((vPath.x - uPulse) / 0.045, 2.0));
    vec3 colour = uColour * (1.0 + band * 2.6);
    gl_FragColor = vec4(colour, uOpacity * tip * (1.0 + band * 1.8));
  }
`;

export interface ConstellationPathProps {
  /** Зірки в порядку ЛАНЦЮГА, тобто за датою. */
  chain: readonly Star3D[];
  palette: JourneyPalette;
  /** Секунди від початку сцени. Реф, а не значення: див. шапку `JourneyScene`. */
  clock: { current: number };
  reducedMotion: boolean;
}

export function ConstellationPath({
  chain,
  palette,
  clock,
  reducedMotion,
}: ConstellationPathProps) {
  const materialRef = useRef<ShaderMaterial>(null);

  const geometry = useMemo(() => {
    if (chain.length < 2) return null;
    const lines = buildConstellationLines(chain, PATH_RADIUS);
    const next = new BufferGeometry();
    next.setAttribute('position', new BufferAttribute(lines.positions, 3));
    next.setAttribute('uv', new BufferAttribute(lines.uvs, 2));
    next.setIndex(new BufferAttribute(lines.indices, 1));
    return next;
  }, [chain]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  const orders = useMemo(() => chain.map((star) => star.order), [chain]);
  const colour = useMemo(() => hslToRgb(palette.path), [palette.path]);

  useFrame(() => {
    const material = materialRef.current;
    if (!material) return;
    const revealed = reducedMotion ? 1 : pathReveal(orders, clock.current);
    material.uniforms.uReveal!.value = revealed;
    // Пара просила спокою — імпульсу немає взагалі, а не «повільніший».
    material.uniforms.uPulse!.value = reducedMotion
      ? -1
      : pulsePosition(clock.current, revealed);
  });

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={1}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={PATH_VERTEX}
        fragmentShader={PATH_FRAGMENT}
        uniforms={{
          uColour: { value: colour },
          uReveal: { value: 0 },
          uPulse: { value: -1 },
          // Шлях — це зв'язок, а не подія. Він мусить читатись, лишаючись
          // тихішим за будь-яку зірку, інакше сузір'я стає схемою.
          uOpacity: { value: 0.42 },
        }}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}
